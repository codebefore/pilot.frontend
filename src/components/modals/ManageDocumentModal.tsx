import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  downloadAuthorizedFile,
  openAuthorizedFile,
  printAuthorizedFile,
} from "../../lib/authorized-files";
import {
  deleteCandidateDocument,
  getCandidateDocuments,
  getCandidateDocumentDownloadUrl,
  uploadDocument,
  updateCandidateDocument,
  updateCandidateDocumentMebbisTransfer,
} from "../../lib/documents-api";
import { ApiError } from "../../lib/http";
import { useLanguage, useT, type TranslationKey } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { candidateKeys } from "../../lib/queries/use-candidates";
import { formatDateTR } from "../../lib/status-maps";
import type {
  DocumentMetadataField,
  DocumentResponse,
  DocumentTypeResponse,
} from "../../lib/types";
import { FileDropInput } from "../ui/FileDropInput";
import { Modal } from "../ui/Modal";
import { PanelListSkeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import { CameraIcon, ScannerIcon } from "../icons";
import { DocumentScannerModal } from "./DocumentScannerModal";
import { MetadataFieldRow } from "./UploadDocumentModal";

const manageDocumentFormSchema = z.object({
  isPhysicallyAvailable: z.boolean(),
  note: z.string(),
});

type ManageDocumentForm = z.infer<typeof manageDocumentFormSchema>;

type ManageDocumentModalProps = {
  open: boolean;
  candidateId: string | null;
  candidateName?: string;
  documentTypeId?: string;
  documentTypes: DocumentTypeResponse[];
  canManageDocuments?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function emptyForm(
  note?: string | null,
  isPhysicallyAvailable = false
): ManageDocumentForm {
  return { isPhysicallyAvailable, note: note ?? "" };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ACCEPT = "image/jpeg,image/png,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;
const MIN_CROP_SIZE = 12;
const PRINTABLE_DOCUMENT_TYPE_KEYS = new Set([
  "signature_sample",
  "contract_front",
  "contract_back",
  "application_form",
]);
const HEALTH_REPORT_META_KEYS = {
  disability: "disability",
} as const;
const HEALTH_REPORT_DEFAULT_METADATA: Record<string, string> = {
  [HEALTH_REPORT_META_KEYS.disability]: "none",
};

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
  return { x: 10, y: 10, width: 80, height: 80 };
}

function createCapturedFileName(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  return `evrak-${stamp}.jpg`;
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

function isPrintableDocumentType(documentType: DocumentTypeResponse | null): boolean {
  return documentType ? PRINTABLE_DOCUMENT_TYPE_KEYS.has(documentType.key) : false;
}

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

function hasMissingDocumentMetadataDefaults(
  documentType: DocumentTypeResponse | null,
  metadata: Record<string, string>
): boolean {
  if (documentType?.key !== "health_report") return false;
  return !metadata[HEALTH_REPORT_META_KEYS.disability];
}

export function ManageDocumentModal({
  open,
  candidateId,
  candidateName,
  documentTypeId,
  documentTypes,
  canManageDocuments = true,
  onClose,
  onSaved,
}: ManageDocumentModalProps) {
  const queryClient = useQueryClient();
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const { showToast } = useToast();
  const noteFieldId = useId();
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

  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadState, setLoadState] = useState<"idle" | "not_found" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({});
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect>(() => defaultCropRect());
  const [cropSaving, setCropSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [actionPending, setActionPending] = useState<
    "mebbis" | "delete" | "download" | "print" | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidateDocumentMutationDependents = () => {
    if (candidateId) {
      void queryClient.invalidateQueries({
        queryKey: ["candidates", "documents", candidateId],
      });
      void queryClient.invalidateQueries({
        queryKey: candidateKeys.detail(candidateId),
      });
    }
    void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<ManageDocumentForm>({
    defaultValues: emptyForm(),
    resolver: zodResolver(manageDocumentFormSchema),
  });
  const isPhysicallyAvailable = watch("isPhysicallyAvailable");

  const stopCamera = () => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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

  const resetReplacementSource = () => {
    closeCamera();
    clearCapture();
    setReplacementFile(null);
    setFileError(null);
  };

  const openCropForFile = (file: File) => {
    closeCamera();
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedFile(file);
    setCapturedUrl(URL.createObjectURL(file));
    setCrop(defaultCropRect());
    setCropSaving(false);
  };

  const handleSelectedFile = (file: File | null) => {
    setFileError(null);
    if (!file) {
      clearCapture();
      setReplacementFile(null);
      return;
    }
    if (isCropSupportedUpload(file)) {
      openCropForFile(file);
      return;
    }
    clearCapture();
    setReplacementFile(file);
  };

  const startCamera = async (facing: "environment" | "user" = cameraFacing) => {
    setCameraOpen(true);
    setCameraFacing(facing);
    setCameraLoading(true);
    setCameraError(null);
    clearCapture();
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
    mode: CropDragMode
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
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
      const nextLeft = drag.mode.includes("w") ? clampNumber(left + dx, 0, right - MIN_CROP_SIZE) : left;
      const nextRight = drag.mode.includes("e") ? clampNumber(right + dx, left + MIN_CROP_SIZE, 100) : right;
      const nextTop = drag.mode.includes("n") ? clampNumber(top + dy, 0, bottom - MIN_CROP_SIZE) : top;
      const nextBottom = drag.mode.includes("s") ? clampNumber(bottom + dy, top + MIN_CROP_SIZE, 100) : bottom;
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
      setReplacementFile(file);
      clearCapture();
      setFileError(null);
    } catch {
      setFileError(t("candidateDetail.documents.upload.photoError"));
    } finally {
      setCropSaving(false);
    }
  };

  useEffect(() => {
    if (!open || !candidateId || !documentTypeId) {
      setDocument(null);
      setLoadState("idle");
      setMetadataValues({});
      setMetadataErrors({});
      setReplaceOpen(false);
      resetReplacementSource();
      setActionPending(null);
      setConfirmDelete(false);
      reset(emptyForm());
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadState("idle");
    setDocument(null);

    getCandidateDocuments(candidateId, controller.signal)
      .then((documents) => {
        const matchingDocument =
          documents.find((item) => item.documentTypeId === documentTypeId) ?? null;
        setDocument(matchingDocument);
        setLoadState(matchingDocument === null ? "not_found" : "idle");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
        showToast(t("documents.manage.loadFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [candidateId, documentTypeId, open, reset, showToast, t]);

  useEffect(() => {
    if (!document) {
      reset(emptyForm());
      setMetadataValues({});
      setMetadataErrors({});
      setReplaceOpen(false);
      resetReplacementSource();
      return;
    }

    reset(emptyForm(document.note, document.isPhysicallyAvailable));
    let nextMetadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(document.metadata ?? {})) {
      if (value) nextMetadata[key] = value;
    }
    const resolvedDocumentType =
      documentTypes.find((item) => item.id === document.documentTypeId) ?? null;
    nextMetadata = applyDocumentMetadataDefaults(resolvedDocumentType, nextMetadata);
    setMetadataValues(nextMetadata);
    setMetadataErrors({});
    setReplaceOpen(false);
    resetReplacementSource();
    setActionPending(null);
    setConfirmDelete(false);
  }, [document, documentTypes, reset]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  const activeDocumentType = useMemo(() => {
    const resolvedDocumentTypeId = document?.documentTypeId ?? documentTypeId;
    return documentTypes.find((item) => item.id === resolvedDocumentTypeId) ?? null;
  }, [document?.documentTypeId, documentTypeId, documentTypes]);

  const metadataFields: DocumentMetadataField[] = activeDocumentType?.metadataFields ?? [];
  const fileUrl =
    candidateId && document?.hasFile
      ? getCandidateDocumentDownloadUrl(candidateId, document.id)
      : null;
  const inlineFileUrl =
    candidateId && document?.hasFile
      ? getCandidateDocumentDownloadUrl(candidateId, document.id, { inline: true })
      : null;
  const isMebbisTransferred = document?.isMebbisTransferred ?? false;
  const busy = submitting || actionPending !== null;
  const noPermissionTitle = t("common.noPermission");

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
    const nextErrors: Record<string, string> = {};
    for (const field of metadataFields) {
      const value = (metadataValues[field.key] ?? "").trim();
      if (field.isRequired && value === "") {
        nextErrors[field.key] = t("uploadDoc.errors.metadataRequired").replace(
          "{label}",
          field.label
        );
      }
    }

    setMetadataErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const toggleReplaceOpen = () => {
    if (!canManageDocuments) return;
    setReplaceOpen((current) => {
      const next = !current;
      if (!next) {
        resetReplacementSource();
      }
      return next;
    });
  };

  const submit = handleSubmit(async (data) => {
    if (!canManageDocuments) return;
    if (!candidateId || !document) return;
    if (!validateMetadata()) return;
    if (replacementFile && replacementFile.size > MAX_BYTES) {
      setFileError(t("uploadDoc.errors.fileTooLarge"));
      return;
    }

    let metadataToSend: Record<string, string> = {};
    for (const field of metadataFields) {
      const value = (metadataValues[field.key] ?? "").trim();
      if (value !== "") metadataToSend[field.key] = value;
    }
    metadataToSend = applyDocumentMetadataDefaults(activeDocumentType, metadataToSend);

    setSubmitting(true);
    try {
      if (replacementFile) {
        const uploadedDocument = await uploadDocument({
          candidateId,
          documentTypeId: document.documentTypeId,
          file: replacementFile,
          isPhysicallyAvailable: data.isPhysicallyAvailable,
          note: data.note.trim() || undefined,
          metadata: metadataToSend,
        });
        if (data.isPhysicallyAvailable) {
          await updateCandidateDocument(candidateId, uploadedDocument.id, {
            isPhysicallyAvailable: true,
            note: data.note.trim() || null,
            metadata: metadataToSend,
          });
        }
      } else {
        await updateCandidateDocument(candidateId, document.id, {
          isPhysicallyAvailable: data.isPhysicallyAvailable,
          note: data.note.trim() || null,
          metadata: metadataToSend,
        });
      }

      invalidateDocumentMutationDependents();
      onSaved();
    } catch (error) {
      // Apply note field errors via applyApiErrorsToForm
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError, {
        translateCode: (code, params) => t(code as TranslationKey, params),
        fieldMap: { note: "note", Note: "note" },
      });

      // Handle file and metadata errors manually (not mapped to form fields)
      if (error instanceof ApiError) {
        const uploadFileError =
          error.validationErrors?.file?.[0] ?? error.validationErrors?.File?.[0];
        if (uploadFileError) {
          setFileError(uploadFileError);
        }

        const nextMetadataErrors: Record<string, string> = {};
        for (const field of metadataFields) {
          const message =
            error.validationErrors?.[`Metadata.${field.key}`]?.[0] ??
            error.validationErrors?.[`metadata.${field.key}`]?.[0];
          if (message) nextMetadataErrors[field.key] = message;
        }
        if (Object.keys(nextMetadataErrors).length > 0) {
          setMetadataErrors(nextMetadataErrors);
        }
      }

      if (unmappedMessages[0]) {
        showToast(unmappedMessages[0], "error");
      } else if (!applied) {
        showToast(t("documents.manage.saveFailed"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const handleMebbisToggle = async () => {
    if (!canManageDocuments) return;
    if (!candidateId || !document || !activeDocumentType || actionPending) return;

    setActionPending("mebbis");
    try {
      const existingMetadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(document.metadata ?? {})) {
        if (value) existingMetadata[key] = value;
      }
      const metadataWithDefaults = applyDocumentMetadataDefaults(
        activeDocumentType,
        existingMetadata
      );
      if (hasMissingDocumentMetadataDefaults(activeDocumentType, existingMetadata)) {
        await updateCandidateDocument(candidateId, document.id, {
          note: document.note ?? null,
          metadata: metadataWithDefaults,
        });
      }
      await updateCandidateDocumentMebbisTransfer(
        candidateId,
        activeDocumentType.id,
        !isMebbisTransferred
      );
      invalidateDocumentMutationDependents();
      onSaved();
    } catch {
      showToast(t("documents.manage.mebbisFailed"), "error");
    } finally {
      setActionPending(null);
    }
  };

  const handleDelete = async () => {
    if (!canManageDocuments) return;
    if (!candidateId || !document || actionPending) return;

    setActionPending("delete");
    try {
      await deleteCandidateDocument(candidateId, document.id);
      invalidateDocumentMutationDependents();
      onSaved();
    } catch {
      showToast(t("documents.manage.deleteFailed"), "error");
    } finally {
      setActionPending(null);
    }
  };

  const handleDownload = async () => {
    if (!fileUrl || !document || actionPending) return;

    setActionPending("download");
    try {
      await downloadAuthorizedFile(fileUrl, document.originalFileName);
    } catch {
      showToast(t("documents.manage.downloadFailed"), "error");
    } finally {
      setActionPending(null);
    }
  };

  const handlePrint = async () => {
    if (!inlineFileUrl || !activeDocumentType || actionPending) return;

    setActionPending("print");
    try {
      await printAuthorizedFile(inlineFileUrl, activeDocumentType.name);
    } catch {
      showToast(t("documents.manage.printFailed"), "error");
    } finally {
      setActionPending(null);
    }
  };

  if (!open) return null;

  const footer =
    document && !loading ? (
      <>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          {t("common.cancel")}
        </button>
        <button
          className="btn btn-primary"
          disabled={busy || !canManageDocuments}
          onClick={submit}
          title={!canManageDocuments ? noPermissionTitle : undefined}
          type="button"
        >
          {submitting ? t("documents.manage.saving") : t("common.save")}
        </button>
      </>
    ) : (
      <button className="btn btn-secondary" onClick={onClose} type="button">
        {t("common.close")}
      </button>
    );

  return (
    <Modal
      footer={footer}
      onClose={onClose}
      open={open}
      title={t("documents.manage.title")}
    >
      {loading ? (
        <PanelListSkeleton rows={5} />
      ) : !document ? (
        <div className="documents-manage-empty">
          {loadState === "not_found"
            ? t("documents.manage.notFound")
            : t("documents.manage.loadFailed")}
        </div>
      ) : (
        <form onSubmit={submit}>
          {candidateName && (
            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">{t("uploadDoc.candidate")}</label>
                <div className="form-readonly">{candidateName}</div>
              </div>
            </div>
          )}

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">{t("uploadDoc.docType")}</label>
              <div className="form-readonly">
                {activeDocumentType?.name ?? document.documentTypeName}
              </div>
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">{t("documents.manage.file")}</label>
              <div className="form-readonly">
                {document.hasFile ? (
                  <>
                    <div>{document.originalFileName}</div>
                    <div className="form-hint">
                      {formatBytes(document.fileSizeBytes ?? 0)} ·{" "}
                      {formatDateTR(document.uploadedAtUtc)}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="document-physical-badge">
                        {t("documents.physicallyAvailable")}
                      </span>
                    </div>
                    <div className="form-hint">{formatDateTR(document.uploadedAtUtc)}</div>
                  </>
                )}
              </div>
              <div className="documents-manage-actions">
                {document.hasFile && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      void openAuthorizedFile(
                        getCandidateDocumentDownloadUrl(candidateId!, document.id)
                      );
                    }}
                    disabled={busy}
                    type="button"
                  >
                    {t("documents.manage.open")}
                  </button>
                )}
                {fileUrl && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={handleDownload}
                    type="button"
                  >
                    {t("documents.manage.download")}
                  </button>
                )}
                {inlineFileUrl && isPrintableDocumentType(activeDocumentType) && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={handlePrint}
                    type="button"
                  >
                    {t("documents.manage.print")}
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={busy || !canManageDocuments}
                  onClick={toggleReplaceOpen}
                  title={!canManageDocuments ? noPermissionTitle : undefined}
                  type="button"
                >
                  {replaceOpen
                    ? t("documents.manage.cancelReplace")
                    : t("documents.manage.replace")}
                </button>
                <button
                  className={`btn btn-sm ${
                    isMebbisTransferred ? "btn-secondary" : "btn-primary"
                  }`}
                  disabled={busy || !canManageDocuments}
                  onClick={handleMebbisToggle}
                  title={!canManageDocuments ? noPermissionTitle : undefined}
                  type="button"
                >
                  {actionPending === "mebbis"
                    ? t("documents.manage.mebbisSaving")
                    : isMebbisTransferred
                    ? t("documents.manage.mebbisUnset")
                    : t("documents.manage.mebbisSet")}
                </button>
                {confirmDelete ? (
                  <>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={busy || !canManageDocuments}
                      onClick={handleDelete}
                      title={!canManageDocuments ? noPermissionTitle : undefined}
                      type="button"
                    >
                      {actionPending === "delete"
                        ? t("documents.manage.deleting")
                        : t("common.yes")}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => setConfirmDelete(false)}
                      type="button"
                    >
                      {t("common.cancel")}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy || !canManageDocuments}
                    onClick={() => setConfirmDelete(true)}
                    title={!canManageDocuments ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {document.hasFile
                      ? t("documents.manage.delete")
                      : t("documents.manage.markMissing")}
                  </button>
                )}
              </div>
            </div>
          </div>

          {replaceOpen && (
            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">{t("documents.manage.newFile")}</label>
                <div className="upload-doc-source-actions">
                  <button
                    className="candidate-doc-upload-option"
                    disabled={busy || !canManageDocuments}
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
                    disabled={busy || !canManageDocuments}
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
                  <FileDropInput
                    accept={ACCEPT}
                    disabled={!canManageDocuments}
                    error={!!fileError}
                    file={replacementFile ?? undefined}
                    hint={
                      isPhysicallyAvailable
                        ? t("uploadDoc.physicallyAvailableHint")
                        : t("documents.manage.replaceHint")
                    }
                    name="replacementFile"
                    onBlur={() => undefined}
                    onChange={(list) => handleSelectedFile(list?.[0] ?? null)}
                    onClear={() => handleSelectedFile(null)}
                    variant="button"
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
                <div className="form-hint">{t("uploadDoc.fileHint")}</div>
                {fileError && <div className="form-error">{fileError}</div>}
              </div>
            </div>
          )}

          {metadataFields.length > 0 && (
            <div className="upload-doc-metadata">
              {metadataFields.map((field) => (
                <MetadataFieldRow
                  dateInputLang={dateInputLang}
                  disabled={!canManageDocuments}
                  error={metadataErrors[field.key]}
                  field={field}
                  fieldClass={(hasError, base) => hasError ? `${base} error` : base}
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
              <label className="form-label" htmlFor={noteFieldId}>{t("uploadDoc.note")}</label>
              <textarea
                id={noteFieldId}
                aria-label={t("uploadDoc.note")}
                className={errors.note ? "form-input error" : "form-input"}
                disabled={!canManageDocuments}
                placeholder={t("uploadDoc.notePlaceholder")}
                rows={3}
                {...register("note")}
              />
              {errors.note && <div className="form-error">{t((errors.note.message ?? "") as TranslationKey)}</div>}
            </div>
          </div>

          <div className="upload-doc-actions">
            <label className="switch-toggle upload-doc-toggle">
              <input
                disabled={!canManageDocuments}
                type="checkbox"
                {...register("isPhysicallyAvailable")}
              />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>{t("uploadDoc.physicallyAvailable")}</span>
            </label>
          </div>
        </form>
      )}
    </Modal>
  );
}
