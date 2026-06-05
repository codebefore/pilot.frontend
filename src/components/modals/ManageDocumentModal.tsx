import { useEffect, useId, useMemo, useState } from "react";
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
import { MetadataFieldRow } from "./UploadDocumentModal";

const manageDocumentFormSchema = z.object({
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

function emptyForm(note?: string | null): ManageDocumentForm {
  return { note: note ?? "" };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ACCEPT = "image/jpeg,image/png,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;
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
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const { showToast } = useToast();
  const noteFieldId = useId();

  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadState, setLoadState] = useState<"idle" | "not_found" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({});
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<
    "mebbis" | "delete" | "download" | "print" | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<ManageDocumentForm>({
    defaultValues: emptyForm(),
    resolver: zodResolver(manageDocumentFormSchema),
  });

  useEffect(() => {
    if (!open || !candidateId || !documentTypeId) {
      setDocument(null);
      setLoadState("idle");
      setMetadataValues({});
      setMetadataErrors({});
      setReplaceOpen(false);
      setReplacementFile(null);
      setFileError(null);
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
      setReplacementFile(null);
      setFileError(null);
      return;
    }

    reset(emptyForm(document.note));
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
    setReplacementFile(null);
    setFileError(null);
    setActionPending(null);
    setConfirmDelete(false);
  }, [document, documentTypes, reset]);

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
        setReplacementFile(null);
        setFileError(null);
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
        await uploadDocument({
          candidateId,
          documentTypeId: document.documentTypeId,
          file: replacementFile,
          note: data.note.trim() || undefined,
          metadata: metadataToSend,
        });
      } else {
        await updateCandidateDocument(candidateId, document.id, {
          note: data.note.trim() || null,
          metadata: metadataToSend,
        });
      }

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
                <FileDropInput
                  accept={ACCEPT}
                  disabled={!canManageDocuments}
                  error={!!fileError}
                  file={replacementFile ?? undefined}
                  hint={t("documents.manage.replaceHint")}
                  name="replacementFile"
                  onBlur={() => undefined}
                  onChange={(list) => {
                    setReplacementFile(list?.[0] ?? null);
                    setFileError(null);
                  }}
                  onClear={() => {
                    setReplacementFile(null);
                    setFileError(null);
                  }}
                />
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
        </form>
      )}
    </Modal>
  );
}
