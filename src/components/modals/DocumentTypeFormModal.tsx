import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { createDocumentType, updateDocumentType } from "../../lib/documents-api";
import { ApiError } from "../../lib/http";
import { useT } from "../../lib/i18n";
import type { DocumentTypeResponse, DocumentTypeUpsertRequest } from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

export const DOCUMENT_TYPE_MODULE = "candidate";

const KEY_PATTERN = /^[a-z0-9_]+$/;

type DocumentTypeFormValues = {
  key: string;
  name: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
};

type DocumentTypeFormModalProps = {
  open: boolean;
  /** When provided the modal is in edit mode; when null it creates a new type. */
  editing: DocumentTypeResponse | null;
  /** Default sort order suggested when creating (e.g. last + 1). */
  nextSortOrder?: number;
  onClose: () => void;
  onSaved: (saved: DocumentTypeResponse) => void;
};

const emptyValues = (
  editing: DocumentTypeResponse | null,
  nextSortOrder = 0
): DocumentTypeFormValues =>
  editing
    ? {
        key: editing.key,
        name: editing.name,
        sortOrder: editing.sortOrder,
        isRequired: editing.isRequired,
        isActive: editing.isActive,
      }
    : {
        key: "",
        name: "",
        sortOrder: nextSortOrder,
        isRequired: true,
        isActive: true,
      };

/** Map .NET / ASP.NET model-validation field names to react-hook-form names. */
const VALIDATION_FIELD_MAP: Record<string, keyof DocumentTypeFormValues> = {
  key: "key",
  Key: "key",
  name: "name",
  Name: "name",
  sortOrder: "sortOrder",
  SortOrder: "sortOrder",
  isRequired: "isRequired",
  IsRequired: "isRequired",
  isActive: "isActive",
  IsActive: "isActive",
};

export function DocumentTypeFormModal({
  open,
  editing,
  nextSortOrder,
  onClose,
  onSaved,
}: DocumentTypeFormModalProps) {
  const t = useT();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<DocumentTypeFormValues>({
    defaultValues: emptyValues(editing, nextSortOrder),
  });

  useEffect(() => {
    if (open) reset(emptyValues(editing, nextSortOrder));
  }, [editing, nextSortOrder, open, reset]);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);
    const payload: DocumentTypeUpsertRequest = {
      module: DOCUMENT_TYPE_MODULE,
      key: values.key.trim(),
      name: values.name.trim(),
      sortOrder: Number(values.sortOrder),
      isRequired: values.isRequired,
      isActive: values.isActive,
    };

    try {
      const saved = editing
        ? await updateDocumentType(editing.id, payload)
        : await createDocumentType(payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        for (const [serverField, messages] of Object.entries(error.validationErrors)) {
          const formField = VALIDATION_FIELD_MAP[serverField];
          if (formField && messages?.[0]) {
            setError(formField, { message: messages[0] });
          }
        }
      }
      showToast(t("documentTypes.saveFailed"), "error");
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
            {t("documentTypeForm.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting}
            onClick={submit}
            type="button"
          >
            {submitting ? t("documentTypeForm.saving") : t("documentTypeForm.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={editing ? t("documentTypeForm.edit") : t("documentTypeForm.create")}
    >
      <form onSubmit={submit}>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("documentTypeForm.module")}</label>
            <div className="form-readonly">{DOCUMENT_TYPE_MODULE}</div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("documentTypeForm.key")}</label>
            <input
              autoComplete="off"
              className={fieldClass(!!errors.key, "form-input")}
              disabled={!!editing}
              placeholder="national_id"
              {...register("key", {
                required: t("documentTypeForm.errors.keyRequired"),
                pattern: {
                  value: KEY_PATTERN,
                  message: t("documentTypeForm.errors.keyFormat"),
                },
              })}
            />
            {errors.key ? (
              <div className="form-error">{errors.key.message}</div>
            ) : (
              <div className="form-hint">{t("documentTypeForm.keyHelp")}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t("documentTypeForm.sortOrder")}</label>
            <input
              className={fieldClass(!!errors.sortOrder, "form-input")}
              inputMode="numeric"
              type="number"
              {...register("sortOrder", {
                required: t("documentTypeForm.errors.sortOrderInvalid"),
                valueAsNumber: true,
                min: { value: 0, message: t("documentTypeForm.errors.sortOrderInvalid") },
                validate: (v) =>
                  Number.isFinite(v) || t("documentTypeForm.errors.sortOrderInvalid"),
              })}
            />
            {errors.sortOrder && (
              <div className="form-error">{errors.sortOrder.message}</div>
            )}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("documentTypeForm.name")}</label>
            <input
              className={fieldClass(!!errors.name, "form-input")}
              placeholder={t("documentTypeForm.namePlaceholder")}
              {...register("name", {
                required: t("documentTypeForm.errors.nameRequired"),
              })}
            />
            {errors.name && <div className="form-error">{errors.name.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-checkbox">
              <input type="checkbox" {...register("isRequired")} />
              <span>{t("documentTypeForm.isRequired")}</span>
            </label>
          </div>
          <div className="form-group">
            <label className="form-checkbox">
              <input type="checkbox" {...register("isActive")} />
              <span>{t("documentTypeForm.isActive")}</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
