import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { getCandidates } from "../../lib/candidates-api";
import { getDocumentTypes, uploadDocument } from "../../lib/documents-api";
import { ApiError } from "../../lib/http";
import { useT } from "../../lib/i18n";
import type { CandidateResponse, DocumentTypeResponse } from "../../lib/types";
import { FileDropInput } from "../ui/FileDropInput";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type UploadDocumentForm = {
  candidateId: string;
  documentTypeId: string;
  file: File | null;
  note: string;
};

type UploadDocumentModalProps = {
  open: boolean;
  candidateId: string | null;
  candidateName?: string;
  initialDocumentTypeId?: string;
  documentTypes?: DocumentTypeResponse[];
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
  note: "",
});

export function UploadDocumentModal({
  open,
  candidateId,
  candidateName,
  initialDocumentTypeId,
  documentTypes: documentTypesProp,
  onClose,
  onUploaded,
}: UploadDocumentModalProps) {
  const t = useT();
  const { showToast } = useToast();

  const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>(
    documentTypesProp ?? []
  );
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<UploadDocumentForm>({
    defaultValues: emptyForm(candidateId, initialDocumentTypeId),
  });

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

  const submit = handleSubmit(async (data) => {
    const resolvedCandidateId = candidateId ?? data.candidateId;
    if (!resolvedCandidateId) {
      setError("candidateId", { message: t("uploadDoc.errors.candidateRequired") });
      return;
    }

    setSubmitting(true);
    try {
      await uploadDocument({
        candidateId: resolvedCandidateId,
        documentTypeId: data.documentTypeId,
        file: data.file!,
        note: data.note.trim() || undefined,
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
      title={t("uploadDoc.title")}
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
              <select
                className={fieldClass(!!errors.candidateId, "form-select")}
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
              </select>
              {errors.candidateId && <div className="form-error">{errors.candidateId.message}</div>}
            </div>
          </div>
        )}

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("uploadDoc.docType")}</label>
            <select
              className={fieldClass(!!errors.documentTypeId, "form-select")}
              {...register("documentTypeId", { required: t("uploadDoc.errors.docTypeRequired") })}
            >
              <option value="">{t("uploadDoc.docTypePlaceholder")}</option>
              {documentTypes.map((documentType) => (
                <option key={documentType.id} value={documentType.id}>
                  {documentType.name}
                </option>
              ))}
            </select>
            {errors.documentTypeId && (
              <div className="form-error">{errors.documentTypeId.message}</div>
            )}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("uploadDoc.file")}</label>
            <Controller
              control={control}
              name="file"
              render={({ field, fieldState }) => (
                <FileDropInput
                  accept={ACCEPT}
                  error={!!fieldState.error}
                  file={field.value ?? undefined}
                  hint={t("uploadDoc.fileHint")}
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(list) => field.onChange(list?.[0] ?? null)}
                  onClear={() => field.onChange(null)}
                  ref={field.ref}
                />
              )}
              rules={{
                validate: (file) => {
                  if (!file) return t("uploadDoc.errors.fileRequired");
                  if (file.size > MAX_BYTES) return t("uploadDoc.errors.fileTooLarge");
                  return true;
                },
              }}
            />
            {errors.file && <div className="form-error">{errors.file.message}</div>}
          </div>
        </div>

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
