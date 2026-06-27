import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { getCandidates } from "../../lib/candidates-api";
import { getDocumentTypes, uploadDocument } from "../../lib/documents-api";
import { useLanguage, useT } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { ApiError } from "../../lib/http";
import { candidateKeys } from "../../lib/queries/use-candidates";
import type {
  CandidateResponse,
  DocumentMetadataField,
  DocumentTypeResponse,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { FileDropInput } from "../ui/FileDropInput";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { CameraIcon, ScannerIcon } from "../icons";
import { DocumentScannerModal } from "./DocumentScannerModal";

const uploadDocumentSchema = z.object({
  candidateId: z.string(),
  documentTypeId: z.string(),
  file: z.instanceof(File).nullable(),
  isPhysicallyAvailable: z.boolean(),
  note: z.string(),
});

type UploadDocumentForm = z.infer<typeof uploadDocumentSchema>;

type UploadDocumentModalProps = {
  open: boolean;
  canManage?: boolean;
  candidateId: string | null;
  candidateName?: string;
  initialDocumentTypeId?: string;
  lockedDocumentTypeKey?: string;
  documentTypes?: DocumentTypeResponse[];
  title?: string;
  onClose: () => void;
  onUploaded: () => void;
};

const ACCEPT = "image/jpeg,image/png,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;
const MIN_CROP_SIZE = 12;
const HEALTH_REPORT_META_KEYS = {
  disability: "disability",
} as const;
const HEALTH_REPORT_DEFAULT_METADATA: Record<string, string> = {
  [HEALTH_REPORT_META_KEYS.disability]: "none",
};

function createCapturedFileName(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  return `evrak-${stamp}.jpg`;
}

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CropDragMode = "move" | "nw" | "ne" | "sw" | "se";

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function defaultCropRect(): CropRect {
  return { x: 0, y: 0, width: 100, height: 100 };
}

function toJpegFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "evrak";
  return `${baseName}.jpg`;
}

function drawVideoFrameToFile(video: HTMLVideoElement): Promise<File> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width <= 0 || height <= 0) {
    return Promise.reject(new Error("camera-frame-not-ready"));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("canvas-not-supported"));
  context.drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("capture-failed"));
          return;
        }
        resolve(new File([blob], createCapturedFileName(), { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}

function cropImageFile(file: File, image: HTMLImageElement, crop: CropRect): Promise<File> {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const sourceX = Math.round((crop.x / 100) * naturalWidth);
  const sourceY = Math.round((crop.y / 100) * naturalHeight);
  const sourceWidth = Math.round((crop.width / 100) * naturalWidth);
  const sourceHeight = Math.round((crop.height / 100) * naturalHeight);
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return Promise.reject(new Error("invalid-crop"));
  }

  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("canvas-not-supported"));
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("crop-failed"));
          return;
        }
        resolve(new File([blob], toJpegFileName(file.name), { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}

function isCropSupportedUpload(file: File): boolean {
  return file.type === "image/jpeg" || file.type === "image/png";
}

const emptyForm = (
  candidateId?: string | null,
  initialDocumentTypeId?: string
): UploadDocumentForm => ({
  candidateId: candidateId ?? "",
  documentTypeId: initialDocumentTypeId ?? "",
  file: null,
  isPhysicallyAvailable: false,
  note: "",
});

function applyDocumentMetadataDefaults(
  documentType: DocumentTypeResponse | null,
  metadata: Record<string, string>
): Record<string, string> {
  if (documentType?.key !== "health_report") return metadata;

  return {
    ...HEALTH_REPORT_DEFAULT_METADATA,
    ...metadata,
  };
}

export function UploadDocumentModal({
  open,
  canManage = true,
  candidateId,
  candidateName,
  initialDocumentTypeId,
  lockedDocumentTypeKey,
  documentTypes: documentTypesProp,
  title,
  onClose,
  onUploaded,
}: UploadDocumentModalProps) {
  const queryClient = useQueryClient();
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const { showToast } = useToast();
  const noPermissionTitle = t("common.noPermission");
  const candidateSelectId = useId();
  const documentTypeSelectId = useId();
  const noteInputId = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropViewportRef = useRef<HTMLDivElement | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    mode: CropDragMode;
    startX: number;
    startY: number;
    startCrop: CropRect;
  } | null>(null);

  const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>(
    documentTypesProp ?? []
  );
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect>(() => defaultCropRect());
  const [cropSaving, setCropSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const invalidateUploadDocumentDependents = (resolvedCandidateId: string) => {
    void queryClient.invalidateQueries({
      queryKey: ["candidates", "documents", resolvedCandidateId],
    });
    void queryClient.invalidateQueries({
      queryKey: candidateKeys.detail(resolvedCandidateId),
    });
    void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<UploadDocumentForm>({
    defaultValues: emptyForm(candidateId, initialDocumentTypeId),
    resolver: zodResolver(uploadDocumentSchema),
  });

  const selectedCandidateId = watch("candidateId");
  const selectedDocumentTypeId = watch("documentTypeId");
  const isPhysicallyAvailable = watch("isPhysicallyAvailable");

  const stopCamera = () => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const setSelectedFile = (file: File | null) => {
    setValue("file", file, { shouldDirty: true, shouldValidate: true });
  };

  const clearCapture = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedFile(null);
    setCrop(defaultCropRect());
    setCropSaving(false);
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setCameraLoading(false);
    setCameraError(null);
  };

  const openCropForFile = (file: File) => {
    stopCamera();
    setCameraOpen(false);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedFile(file);
    setCapturedUrl(URL.createObjectURL(file));
    setCrop(defaultCropRect());
    setCropSaving(false);
  };

  const handleSelectedFile = (file: File | null) => {
    if (!file) {
      clearCapture();
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      clearCapture();
      setSelectedFile(file);
      return;
    }
    if (isCropSupportedUpload(file)) {
      openCropForFile(file);
      return;
    }
    clearCapture();
    setSelectedFile(file);
  };

  const startCamera = async (facing: "environment" | "user" = cameraFacing) => {
    setCameraOpen(true);
    setCameraFacing(facing);
    setCameraLoading(true);
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraLoading(false);
      setCameraError("Bu cihazda kamera desteklenmiyor.");
      return;
    }

    stopCamera();
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      stopCamera();
      setCameraError(t("candidateDetail.documents.upload.cameraError"));
    } finally {
      setCameraLoading(false);
    }
  };

  const switchCamera = () => {
    const next = cameraFacing === "environment" ? "user" : "environment";
    void startCamera(next);
  };

  const captureCameraPhoto = async () => {
    if (!videoRef.current) return;
    try {
      const file = await drawVideoFrameToFile(videoRef.current);
      openCropForFile(file);
    } catch {
      setCameraError(t("candidateDetail.documents.upload.photoError"));
    }
  };

  const handleCropPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    dragMode: CropDragMode
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: dragMode,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: crop,
    };
  };

  const handleCropPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const viewport = cropViewportRef.current;
    if (!drag || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    const start = drag.startCrop;
    let next = { ...start };

    if (drag.mode === "move") {
      next.x = clampNumber(start.x + dx, 0, 100 - start.width);
      next.y = clampNumber(start.y + dy, 0, 100 - start.height);
    } else {
      const left = start.x;
      const top = start.y;
      const right = start.x + start.width;
      const bottom = start.y + start.height;
      const nextLeft = drag.mode.includes("w")
        ? clampNumber(left + dx, 0, right - MIN_CROP_SIZE)
        : left;
      const nextRight = drag.mode.includes("e")
        ? clampNumber(right + dx, left + MIN_CROP_SIZE, 100)
        : right;
      const nextTop = drag.mode.includes("n")
        ? clampNumber(top + dy, 0, bottom - MIN_CROP_SIZE)
        : top;
      const nextBottom = drag.mode.includes("s")
        ? clampNumber(bottom + dy, top + MIN_CROP_SIZE, 100)
        : bottom;
      next = {
        x: nextLeft,
        y: nextTop,
        width: nextRight - nextLeft,
        height: nextBottom - nextTop,
      };
    }
    setCrop(next);
  };

  const handleCropPointerUp = () => {
    dragRef.current = null;
  };

  const saveCroppedFile = async () => {
    if (!capturedFile || !cropImageRef.current || cropSaving) return;
    setCropSaving(true);
    try {
      const file = await cropImageFile(capturedFile, cropImageRef.current, crop);
      setSelectedFile(file);
      clearCapture();
    } catch {
      showToast(t("candidateDetail.documents.upload.photoError"), "error");
      setCropSaving(false);
    }
  };

  useEffect(() => {
    if (open) {
      reset(emptyForm(candidateId, initialDocumentTypeId));
      closeCamera();
      clearCapture();
    }
  }, [candidateId, initialDocumentTypeId, open, reset]);

  useEffect(() => {
    if (!open) {
      closeCamera();
      clearCapture();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  useEffect(() => {
    if (!open) return;

    if (documentTypesProp && documentTypesProp.length > 0) {
      setDocumentTypes(documentTypesProp);
      return;
    }

    const controller = new AbortController();
    getDocumentTypes(undefined, controller.signal)
      .then(setDocumentTypes)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(t("uploadDoc.errors.typesLoadFailed"), "error");
      });
    return () => controller.abort();
  }, [documentTypesProp, open, showToast, t]);

  useEffect(() => {
    if (!open || candidateId) {
      setCandidates([]);
      return;
    }

    const controller = new AbortController();
    getCandidates({ status: "active", page: 1, pageSize: 100 }, controller.signal)
      .then((result) => setCandidates(result.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(t("uploadDoc.errors.candidatesLoadFailed"), "error");
      });
    return () => controller.abort();
  }, [candidateId, open, showToast, t]);

  const lockedDocumentType = lockedDocumentTypeKey
    ? documentTypes.find((documentType) => documentType.key === lockedDocumentTypeKey)
    : null;

  const resolvedDocumentTypeId = lockedDocumentType?.id ?? selectedDocumentTypeId;
  const activeDocumentType = useMemo(
    () => documentTypes.find((dt) => dt.id === resolvedDocumentTypeId) ?? null,
    [documentTypes, resolvedDocumentTypeId]
  );
  const metadataFields: DocumentMetadataField[] = activeDocumentType?.metadataFields ?? [];

  // Reset collected metadata whenever the selected document type changes —
  // different types have different schemas, so stale values could otherwise
  // leak across selections.
  useEffect(() => {
    setMetadataValues({});
    setMetadataErrors({});
  }, [resolvedDocumentTypeId]);

  // Clear all metadata state whenever the modal is reopened.
  useEffect(() => {
    if (!open) {
      setMetadataValues({});
      setMetadataErrors({});
    }
  }, [open]);

  const setMetadataValue = (key: string, value: string) => {
    setMetadataValues((current) => ({ ...current, [key]: value }));
    if (metadataErrors[key]) {
      setMetadataErrors((current) => {
        const { [key]: _, ...rest } = current;
        return rest;
      });
    }
  };

  const validateMetadata = (): boolean => {
    const errorsNext: Record<string, string> = {};
    for (const field of metadataFields) {
      const value = (metadataValues[field.key] ?? "").trim();
      if (field.isRequired && value === "") {
        errorsNext[field.key] = t("uploadDoc.errors.metadataRequired").replace(
          "{label}",
          field.label
        );
      }
    }
    setMetadataErrors(errorsNext);
    return Object.keys(errorsNext).length === 0;
  };

  const submit = handleSubmit(async (data) => {
    if (!canManage) return;

    const resolvedCandidateId = candidateId ?? data.candidateId;
    if (!resolvedCandidateId) {
      setError("candidateId", { message: t("uploadDoc.errors.candidateRequired") });
      return;
    }

    const resolvedSubmitDocumentTypeId =
      lockedDocumentType?.id ??
      (lockedDocumentTypeKey ? "" : data.documentTypeId);
    if (!resolvedSubmitDocumentTypeId) {
      setError("documentTypeId", {
        message: lockedDocumentTypeKey
          ? t("uploadDocument.error.biometricMissing")
          : t("uploadDoc.errors.docTypeRequired"),
      });
      return;
    }

    if (!validateMetadata()) return;

    let metadataToSend: Record<string, string> = {};
    for (const field of metadataFields) {
      const value = (metadataValues[field.key] ?? "").trim();
      if (value !== "") metadataToSend[field.key] = value;
    }
    metadataToSend = applyDocumentMetadataDefaults(activeDocumentType, metadataToSend);

    if (!data.file && !data.isPhysicallyAvailable) {
      setError("file", { message: t("uploadDoc.errors.fileRequired") });
      return;
    }
    if (data.file && !data.isPhysicallyAvailable && data.file.size > MAX_BYTES) {
      setError("file", { message: t("uploadDoc.errors.fileTooLarge") });
      return;
    }

    setSubmitting(true);
    try {
      await uploadDocument({
        candidateId: resolvedCandidateId,
        documentTypeId: resolvedSubmitDocumentTypeId,
        file: data.file,
        isPhysicallyAvailable: data.isPhysicallyAvailable,
        note: data.note.trim() || undefined,
        metadata:
          Object.keys(metadataToSend).length > 0 ? metadataToSend : undefined,
      });
      invalidateUploadDocumentDependents(resolvedCandidateId);
      onUploaded();
    } catch (error) {
      if (error instanceof ApiError && error.status === 413) {
        setError("file", { message: t("uploadDoc.errors.fileTooLarge") });
        showToast(t("uploadDoc.errors.fileTooLarge"), "error");
        return;
      }

      const { unmappedMessages } = applyApiErrorsToForm(error, setError);
      showToast(unmappedMessages[0] ?? t("documents.uploadFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      open={open}
      title={title ?? t("uploadDoc.title")}
    >
      <form onSubmit={submit}>
        {candidateId ? (
          candidateName && (
            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">{t("uploadDoc.candidate")}</label>
                <div className="form-readonly">{candidateName}</div>
              </div>
            </div>
          )
        ) : (
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label" htmlFor={candidateSelectId}>{t("uploadDoc.candidate")}</label>
              <CustomSelect
                id={candidateSelectId}
                className={fieldClass(!!errors.candidateId, "form-select")}
                value={selectedCandidateId}
                {...register("candidateId")}
              >
                <option value="">{t("uploadDoc.candidatePlaceholder")}</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.firstName} {candidate.lastName}
                  </option>
                ))}
              </CustomSelect>
              {errors.candidateId && <div className="form-error">{errors.candidateId.message}</div>}
            </div>
          </div>
        )}

        {lockedDocumentTypeKey ? (
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">{t("uploadDoc.docType")}</label>
              <div className="form-readonly">
                {lockedDocumentType?.name ?? "Biometric Photo"}
              </div>
              {errors.documentTypeId && (
                <div className="form-error">{errors.documentTypeId.message}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label" htmlFor={documentTypeSelectId}>{t("uploadDoc.docType")}</label>
              <CustomSelect
                id={documentTypeSelectId}
                className={fieldClass(!!errors.documentTypeId, "form-select")}
                value={selectedDocumentTypeId}
                {...register("documentTypeId")}
              >
                <option value="">{t("uploadDoc.docTypePlaceholder")}</option>
                {documentTypes.map((documentType) => (
                  <option key={documentType.id} value={documentType.id}>
                    {documentType.name}
                  </option>
                ))}
              </CustomSelect>
              {errors.documentTypeId && (
                <div className="form-error">{errors.documentTypeId.message}</div>
              )}
            </div>
          </div>
        )}

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("uploadDoc.file")}</label>
            <div className="upload-doc-source-actions">
              <button
                className="candidate-doc-upload-option"
                disabled={submitting || !canManage}
                onClick={() => setScannerOpen(true)}
                type="button"
              >
                <span className="candidate-doc-upload-option-icon" aria-hidden="true">
                  <ScannerIcon size={15} />
                </span>
                <span>
                  <strong>{t("candidateDetail.documents.upload.scanner")}</strong>
                  <small>{t("candidateDetail.documents.upload.scannerHint")}</small>
                </span>
              </button>
              <button
                className="candidate-doc-upload-option"
                disabled={submitting || !canManage}
                onClick={() => void startCamera("environment")}
                type="button"
              >
                <span className="candidate-doc-upload-option-icon" aria-hidden="true">
                  <CameraIcon size={15} />
                </span>
                <span>
                  <strong>{t("candidateDetail.documents.upload.camera")}</strong>
                  <small>{t("candidateDetail.documents.upload.cameraHint")}</small>
                </span>
              </button>
              <Controller
                control={control}
                name="file"
                render={({ field, fieldState }) => (
                  <FileDropInput
                    accept={ACCEPT}
                    error={!!fieldState.error}
                    file={field.value ?? undefined}
                    hint={
                      isPhysicallyAvailable
                        ? t("uploadDoc.physicallyAvailableHint")
                        : t("uploadDoc.fileHint")
                    }
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(list) => handleSelectedFile(list?.[0] ?? null)}
                    onClear={() => handleSelectedFile(null)}
                    ref={field.ref}
                    variant="button"
                  />
                )}
              />
            </div>
            <DocumentScannerModal
              onClose={() => setScannerOpen(false)}
              onScanned={(file) => handleSelectedFile(file)}
              open={scannerOpen}
            />
            {cameraOpen ? (
              <div className="candidate-doc-camera-panel upload-doc-camera-panel">
                <div className="candidate-doc-camera-frame">
                  {cameraLoading ? <span>{t("candidateDetail.documents.upload.cameraLoading")}</span> : null}
                  {cameraError ? <span>{cameraError}</span> : null}
                  <video
                    autoPlay
                    className={cameraError || cameraLoading ? "is-hidden" : ""}
                    muted
                    playsInline
                    ref={videoRef}
                  />
                </div>
                <div className="candidate-doc-camera-actions">
                  <button className="btn btn-secondary btn-sm" onClick={switchCamera} type="button">
                    Kamera Değiştir
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={cameraLoading || Boolean(cameraError)}
                    onClick={() => void captureCameraPhoto()}
                    type="button"
                  >
                    Çek
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={closeCamera} type="button">
                    İptal
                  </button>
                </div>
              </div>
            ) : null}
            {capturedUrl ? (
              <div className="candidate-doc-crop-panel upload-doc-crop-panel">
                <div className="candidate-doc-upload-popover-head">
                  <div>
                    <div className="candidate-doc-upload-popover-title">
                      {t("candidateDetail.documents.upload.cropTitle")}
                    </div>
                    <div className="candidate-doc-upload-popover-subtitle">
                      {t("candidateDetail.documents.upload.cropSubtitle")}
                    </div>
                  </div>
                  <button
                    aria-label="Kapat"
                    className="candidate-doc-upload-popover-close"
                    onClick={clearCapture}
                    type="button"
                  >
                    ×
                  </button>
                </div>
                <div
                  className="candidate-doc-crop-stage"
                  onPointerCancel={handleCropPointerUp}
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={handleCropPointerUp}
                >
                  <div className="candidate-doc-crop-viewport" ref={cropViewportRef}>
                    <img
                      alt={t("candidateDetail.documents.upload.capturedAlt")}
                      ref={cropImageRef}
                      src={capturedUrl}
                    />
                    <div
                      className="candidate-doc-crop-box"
                      onPointerDown={(event) => handleCropPointerDown(event, "move")}
                      style={{
                        left: `${crop.x}%`,
                        top: `${crop.y}%`,
                        width: `${crop.width}%`,
                        height: `${crop.height}%`,
                      }}
                    >
                      {(["nw", "ne", "sw", "se"] as CropDragMode[]).map((handle) => (
                        <span
                          className={`candidate-doc-crop-handle ${handle}`}
                          key={handle}
                          onPointerDown={(event) => handleCropPointerDown(event, handle)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="candidate-doc-camera-actions">
                  <button className="btn btn-secondary btn-sm" onClick={clearCapture} type="button">
                    İptal
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={cropSaving}
                    onClick={() => void saveCroppedFile()}
                    type="button"
                  >
                    {cropSaving ? t("common.loading") : t("uploadDoc.cropAndAttach")}
                  </button>
                </div>
              </div>
            ) : null}
            {errors.file && <div className="form-error">{errors.file.message}</div>}
          </div>
        </div>

        {metadataFields.length > 0 && (
          <div className="upload-doc-metadata">
            {metadataFields.map((field) => (
              <MetadataFieldRow
                dateInputLang={dateInputLang}
                error={metadataErrors[field.key]}
                field={field}
                fieldClass={fieldClass}
                key={field.key}
                onChange={(next) => setMetadataValue(field.key, next)}
                selectPlaceholderFallback={t("uploadDoc.metadataSelectPlaceholder")}
                value={metadataValues[field.key] ?? ""}
              />
            ))}
          </div>
        )}

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={noteInputId}>{t("uploadDoc.note")}</label>
            <textarea
              id={noteInputId}
              className="form-input"
              placeholder={t("uploadDoc.notePlaceholder")}
              rows={3}
              {...register("note")}
            />
          </div>
        </div>
        <div className="upload-doc-actions">
          <label className="switch-toggle upload-doc-toggle">
            <input type="checkbox" {...register("isPhysicallyAvailable")} />
            <span className="switch-toggle-control" aria-hidden="true" />
            <span>{t("uploadDoc.physicallyAvailable")}</span>
          </label>
          <button
            className="btn btn-secondary"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            {t("uploadDoc.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting || !canManage}
            onClick={submit}
            title={!canManage ? noPermissionTitle : undefined}
            type="button"
          >
            {submitting ? t("uploadDoc.submitting") : t("uploadDoc.submit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export type MetadataFieldRowProps = {
  field: DocumentMetadataField;
  value: string;
  error?: string;
  disabled?: boolean;
  dateInputLang?: string;
  selectPlaceholderFallback: string;
  fieldClass: (hasError: boolean, base: "form-input" | "form-select") => string;
  onChange: (value: string) => void;
};

export function MetadataFieldRow({
  field,
  value,
  error,
  disabled = false,
  dateInputLang,
  selectPlaceholderFallback,
  fieldClass,
  onChange,
}: MetadataFieldRowProps) {
  const inputId = useId();
  const labelWithRequired = field.isRequired ? `${field.label} *` : field.label;

  return (
    <div className="form-row full">
      <div className="form-group">
        <label className="form-label" htmlFor={inputId}>{labelWithRequired}</label>
        {field.inputType === "date" ? (
          <LocalizedDateInput
            ariaLabel={field.label}
            disabled={disabled}
            id={inputId}
            lang={dateInputLang}
            onChange={onChange}
            placeholder={field.placeholder ?? ""}
            value={value}
          />
        ) : field.inputType === "select" ? (
          <CustomSelect
            id={inputId}
            aria-label={field.label}
            className="form-select"
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            value={value}
          >
            <option value="">
              {field.placeholder ?? selectPlaceholderFallback}
            </option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </CustomSelect>
        ) : (
          <input
            id={inputId}
            aria-label={field.label}
            className={fieldClass(!!error, "form-input")}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder ?? ""}
            type="text"
            value={value}
          />
        )}
        {error && <div className="form-error">{error}</div>}
      </div>
    </div>
  );
}
