import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { getCandidates } from "../../lib/candidates-api";
import { getDocumentTypes, uploadDocument } from "../../lib/documents-api";
import { ApiError } from "../../lib/http";
import { useLanguage, useT } from "../../lib/i18n";
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

type UploadDocumentForm = {
  candidateId: string;
  documentTypeId: string;
  file: File | null;
  isPhysicallyAvailable: boolean;
  note: string;
};

type UploadDocumentModalProps = {
  open: boolean;
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

export function UploadDocumentModal({
  open,
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
          ? "Biyometrik foto evrak türü bulunamadı."
          : t("uploadDoc.errors.docTypeRequired"),
      });
      return;
    }

    if (!validateMetadata()) return;

    const metadataToSend: Record<string, string> = {};
    for (const field of metadataFields) {
      const value = (metadataValues[field.key] ?? "").trim();
      if (value !== "") metadataToSend[field.key] = value;
    }

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
      if (error instanceof ApiError) {
        const candidateError =
          error.validationErrors?.candidateId?.[0] ??
          error.validationErrors?.CandidateId?.[0];
        const documentTypeError =
          error.validationErrors?.documentTypeId?.[0] ??
          error.validationErrors?.DocumentTypeId?.[0];
        const fileError = error.validationErrors?.file?.[0] ?? error.validationErrors?.File?.[0];

        if (candidateError) setError("candidateId", { message: candidateError });
        if (documentTypeError) setError("documentTypeId", { message: documentTypeError });
        if (fileError) setError("file", { message: fileError });
      }

      showToast(t("documents.uploadFailed"), "error");
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
            disabled={submitting}
            onClick={submit}
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
                {...register("candidateId", {
                  required: t("uploadDoc.errors.candidateRequired"),
                })}
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
                {...register("documentTypeId", { required: t("uploadDoc.errors.docTypeRequired") })}
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
              rules={{
                validate: (file) => {
                  if (!file) {
                    // "Fiziksel evrak elde var" işaretliyse dosya zorunlu değil.
                    return isPhysicallyAvailable
                      ? true
                      : t("uploadDoc.errors.fileRequired");
                  }
                  if (file.size > MAX_BYTES) return t("uploadDoc.errors.fileTooLarge");
                  return true;
                },
              }}
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
