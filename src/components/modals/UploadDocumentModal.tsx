import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { getCandidates } from "../../lib/candidates-api";
import { getDocumentTypes, uploadDocument } from "../../lib/documents-api";
import { useLanguage, useT } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
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
const HEALTH_REPORT_META_KEYS = {
  disability: "disability",
} as const;
const HEALTH_REPORT_DEFAULT_METADATA: Record<string, string> = {
  [HEALTH_REPORT_META_KEYS.disability]: "none",
};

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
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const { showToast } = useToast();
  const noPermissionTitle = t("common.noPermission");

  const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>(
    documentTypesProp ?? []
  );
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({});

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<UploadDocumentForm>({
    defaultValues: emptyForm(candidateId, initialDocumentTypeId),
    resolver: zodResolver(uploadDocumentSchema),
  });

  const selectedCandidateId = watch("candidateId");
  const selectedDocumentTypeId = watch("documentTypeId");
  const isPhysicallyAvailable = watch("isPhysicallyAvailable");

  useEffect(() => {
    if (open) {
      reset(emptyForm(candidateId, initialDocumentTypeId));
    }
  }, [candidateId, initialDocumentTypeId, open, reset]);

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

    setSubmitting(true);
    try {
      await uploadDocument({
        candidateId: resolvedCandidateId,
        documentTypeId: resolvedSubmitDocumentTypeId,
        file: data.isPhysicallyAvailable ? null : data.file,
        isPhysicallyAvailable: data.isPhysicallyAvailable,
        note: data.note.trim() || undefined,
        metadata:
          Object.keys(metadataToSend).length > 0 ? metadataToSend : undefined,
      });
      onUploaded();
    } catch (error) {
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
      footer={
        <>
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
        </>
      }
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
              <label className="form-label">{t("uploadDoc.candidate")}</label>
              <CustomSelect
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
              <label className="form-label">{t("uploadDoc.docType")}</label>
              <CustomSelect
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
            <label className="upload-doc-toggle">
              <input type="checkbox" {...register("isPhysicallyAvailable")} />
              <span>{t("uploadDoc.physicallyAvailable")}</span>
            </label>
            <Controller
              control={control}
              name="file"
              render={({ field, fieldState }) => (
                <FileDropInput
                  accept={ACCEPT}
                  disabled={isPhysicallyAvailable}
                  error={!!fieldState.error}
                  file={field.value ?? undefined}
                  hint={
                    isPhysicallyAvailable
                      ? t("uploadDoc.physicallyAvailableHint")
                      : t("uploadDoc.fileHint")
                  }
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(list) => field.onChange(list?.[0] ?? null)}
                  onClear={() => field.onChange(null)}
                  ref={field.ref}
                />
              )}
            />
            {errors.file && <div className="form-error">{errors.file.message}</div>}
          </div>
        </div>

        {metadataFields.length > 0 && (
          <div className="upload-doc-metadata">
            {metadataFields.map((field) => {
              const value = metadataValues[field.key] ?? "";
              const fieldError = metadataErrors[field.key];
              const labelWithRequired = field.isRequired ? `${field.label} *` : field.label;

              return (
                <div className="form-row full" key={field.key}>
                  <div className="form-group">
                    <label className="form-label">{labelWithRequired}</label>
                    {field.inputType === "date" ? (
                      <LocalizedDateInput
                        ariaLabel={field.label}
                        lang={dateInputLang}
                        onChange={(next) => setMetadataValue(field.key, next)}
                        placeholder={field.placeholder ?? ""}
                        value={value}
                      />
                    ) : field.inputType === "select" ? (
                      <CustomSelect
                        aria-label={field.label}
                        className="form-select"
                        onChange={(event) =>
                          setMetadataValue(field.key, event.target.value)
                        }
                        value={value}
                      >
                        <option value="">
                          {field.placeholder ?? t("uploadDoc.metadataSelectPlaceholder")}
                        </option>
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </CustomSelect>
                    ) : (
                      <input
                        aria-label={field.label}
                        className={fieldClass(!!fieldError, "form-input")}
                        onChange={(event) =>
                          setMetadataValue(field.key, event.target.value)
                        }
                        placeholder={field.placeholder ?? ""}
                        type="text"
                        value={value}
                      />
                    )}
                    {fieldError && <div className="form-error">{fieldError}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("uploadDoc.note")}</label>
            <textarea
              className="form-input"
              placeholder={t("uploadDoc.notePlaceholder")}
              rows={3}
              {...register("note")}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
