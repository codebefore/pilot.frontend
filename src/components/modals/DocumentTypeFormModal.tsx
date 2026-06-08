import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createDocumentType, updateDocumentType } from "../../lib/documents-api";
import { useT, type TranslationKey } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { candidateKeys } from "../../lib/queries/use-candidates";
import type {
  DocumentMetadataField,
  DocumentMetadataFieldOption,
  DocumentMetadataInputType,
  DocumentTypeResponse,
  DocumentTypeUpsertRequest,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";

const DOCUMENT_TYPE_MODULE = "candidate";

const KEY_PATTERN = /^[a-z0-9_]+$/;

const documentTypeFormSchema = z.object({
  key: z
    .string()
    .min(1, "documentTypeForm.errors.keyRequired" as TranslationKey)
    .regex(KEY_PATTERN, "documentTypeForm.errors.keyFormat" as TranslationKey),
  name: z.string().min(1, "documentTypeForm.errors.nameRequired" as TranslationKey),
  sortOrder: z
    .number({ error: "documentTypeForm.errors.sortOrderInvalid" as TranslationKey })
    .int("documentTypeForm.errors.sortOrderInvalid" as TranslationKey)
    .min(0, "documentTypeForm.errors.sortOrderInvalid" as TranslationKey),
  isRequired: z.boolean(),
  isActive: z.boolean(),
});

type DocumentTypeFormValues = z.infer<typeof documentTypeFormSchema>;

type DocumentTypeFormModalProps = {
  open: boolean;
  canManage?: boolean;
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

const emptyField = (): DocumentMetadataField => ({
  key: "",
  label: "",
  inputType: "text",
  isRequired: false,
  placeholder: null,
  options: [],
});

const emptyOption = (): DocumentMetadataFieldOption => ({ value: "", label: "" });

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
  canManage = true,
  editing,
  nextSortOrder,
  onClose,
  onSaved,
}: DocumentTypeFormModalProps) {
  const queryClient = useQueryClient();
  const t = useT();
  const { showToast } = useToast();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);
  const [metadataFields, setMetadataFields] = useState<DocumentMetadataField[]>(
    editing?.metadataFields ?? []
  );
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const keyInputId = useId();
  const sortOrderId = useId();
  const nameInputId = useId();

  const invalidateDocumentTypeDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["documentTypes", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["documentTypes", "candidate"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "types"] });
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
  } = useForm<DocumentTypeFormValues>({
    defaultValues: emptyValues(editing, nextSortOrder),
    resolver: zodResolver(documentTypeFormSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(emptyValues(editing, nextSortOrder));
    setMetadataFields(editing?.metadataFields ?? []);
    setMetadataError(null);
  }, [editing, nextSortOrder, open, reset]);

  const updateField = (
    index: number,
    patch: Partial<DocumentMetadataField>
  ) => {
    setMetadataFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field))
    );
  };

  const addField = () => {
    setMetadataFields((current) => [...current, emptyField()]);
  };

  const removeField = (index: number) => {
    setMetadataFields((current) => current.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setMetadataFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const addOption = (fieldIndex: number) => {
    setMetadataFields((current) =>
      current.map((field, i) =>
        i === fieldIndex
          ? { ...field, options: [...field.options, emptyOption()] }
          : field
      )
    );
  };

  const updateOption = (
    fieldIndex: number,
    optionIndex: number,
    patch: Partial<DocumentMetadataFieldOption>
  ) => {
    setMetadataFields((current) =>
      current.map((field, i) =>
        i === fieldIndex
          ? {
              ...field,
              options: field.options.map((option, j) =>
                j === optionIndex ? { ...option, ...patch } : option
              ),
            }
          : field
      )
    );
  };

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    setMetadataFields((current) =>
      current.map((field, i) =>
        i === fieldIndex
          ? {
              ...field,
              options: field.options.filter((_, j) => j !== optionIndex),
            }
          : field
      )
    );
  };

  const validateMetadataFields = (): string | null => {
    const seenKeys = new Set<string>();
    for (const field of metadataFields) {
      const key = field.key.trim();
      if (!key) return t("documentTypeForm.errors.fieldKeyRequired");
      if (!KEY_PATTERN.test(key)) return t("documentTypeForm.errors.fieldKeyFormat");
      if (seenKeys.has(key)) return t("documentTypeForm.errors.fieldKeyDuplicate");
      seenKeys.add(key);
      if (!field.label.trim()) return t("documentTypeForm.errors.fieldLabelRequired");
      if (field.inputType === "select") {
        if (field.options.length === 0) {
          return t("documentTypeForm.errors.selectOptionsRequired");
        }
        const seenValues = new Set<string>();
        for (const option of field.options) {
          if (!option.value.trim() || !option.label.trim()) {
            return t("documentTypeForm.errors.optionFieldsRequired");
          }
          if (seenValues.has(option.value)) {
            return t("documentTypeForm.errors.optionValueDuplicate");
          }
          seenValues.add(option.value);
        }
      }
    }
    return null;
  };

  const submit = handleSubmit(async (values) => {
    if (!canManage) return;

    const metadataValidation = validateMetadataFields();
    if (metadataValidation) {
      setMetadataError(metadataValidation);
      return;
    }
    setMetadataError(null);

    setSubmitting(true);
    const payload: DocumentTypeUpsertRequest = {
      module: DOCUMENT_TYPE_MODULE,
      key: values.key.trim(),
      name: values.name.trim(),
      sortOrder: Number(values.sortOrder),
      isRequired: values.isRequired,
      isActive: values.isActive,
      metadataFields: metadataFields.map((field) => ({
        key: field.key.trim(),
        label: field.label.trim(),
        inputType: field.inputType,
        isRequired: field.isRequired,
        placeholder: field.placeholder?.trim() || null,
        options:
          field.inputType === "select"
            ? field.options.map((option) => ({
                value: option.value.trim(),
                label: option.label.trim(),
              }))
            : [],
      })),
    };

    try {
      const saved = editing
        ? await updateDocumentType(editing.id, payload)
        : await createDocumentType(payload);
      invalidateDocumentTypeDependents();
      onSaved(saved);
    } catch (error) {
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError, {
        translateCode: (code, params) => t(code as TranslationKey, params),
        fieldMap: VALIDATION_FIELD_MAP,
      });
      // Handle metadata-related server errors that don't map to form fields
      if (!applied && unmappedMessages.length === 0) {
        showToast(t("documentTypes.saveFailed"), "error");
      } else if (unmappedMessages[0]) {
        // Check if it's a metadata error
        const isMetadataMsg = unmappedMessages[0].toLowerCase().includes("metadata") ||
          unmappedMessages[0].toLowerCase().includes("alan");
        if (isMetadataMsg) {
          setMetadataError(unmappedMessages[0]);
        } else {
          showToast(unmappedMessages[0], "error");
        }
      } else if (!applied) {
        showToast(t("documentTypes.saveFailed"), "error");
      }
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
            disabled={submitting || !canManage}
            onClick={submit}
            title={!canManage ? noPermissionTitle : undefined}
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
            <label className="form-label" htmlFor={keyInputId}>{t("documentTypeForm.key")}<RequiredMark /></label>
            <input
              id={keyInputId}
              autoComplete="off"
              className={fieldClass(!!errors.key, "form-input")}
              disabled={!!editing}
              placeholder="national_id"
              {...register("key")}
            />
            {errors.key ? (
              <div className="form-error">{t((errors.key.message ?? "") as TranslationKey)}</div>
            ) : (
              <div className="form-hint">{t("documentTypeForm.keyHelp")}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={sortOrderId}>{t("documentTypeForm.sortOrder")}<RequiredMark /></label>
            <input
              id={sortOrderId}
              className={fieldClass(!!errors.sortOrder, "form-input")}
              inputMode="numeric"
              type="number"
              {...register("sortOrder", { valueAsNumber: true })}
            />
            {errors.sortOrder && (
              <div className="form-error">{t((errors.sortOrder.message ?? "") as TranslationKey)}</div>
            )}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={nameInputId}>{t("documentTypeForm.name")}<RequiredMark /></label>
            <input
              id={nameInputId}
              className={fieldClass(!!errors.name, "form-input")}
              placeholder={t("documentTypeForm.namePlaceholder")}
              {...register("name")}
            />
            {errors.name && <div className="form-error">{t((errors.name.message ?? "") as TranslationKey)}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="switch-toggle">
              <input type="checkbox" {...register("isRequired")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>{t("documentTypeForm.isRequired")}</span>
            </label>
          </div>
          <div className="form-group">
            <label className="switch-toggle">
              <input type="checkbox" {...register("isActive")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>{t("documentTypeForm.isActive")}</span>
            </label>
          </div>
        </div>

        <div className="doc-meta-editor">
          <div className="doc-meta-editor-header">
            <div>
              <div className="doc-meta-editor-title">
                {t("documentTypeForm.metadataTitle")}
              </div>
              <div className="form-hint">{t("documentTypeForm.metadataHint")}</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!canManage}
              onClick={addField}
              title={!canManage ? noPermissionTitle : undefined}
              type="button"
            >
              {t("documentTypeForm.addField")}
            </button>
          </div>

          {metadataError && <div className="form-error">{metadataError}</div>}

          {metadataFields.length === 0 ? (
            <div className="form-hint">{t("documentTypeForm.metadataEmpty")}</div>
          ) : (
            <ol className="doc-meta-field-list">
              {metadataFields.map((field, index) => (
                <li className="doc-meta-field" key={index}>
                  <div className="doc-meta-field-row">
                    <div className="form-group">
                      <label className="form-label">
                        {t("documentTypeForm.fieldKey")}
                      </label>
                      <input
                        autoComplete="off"
                        className="form-input"
                        onChange={(event) =>
                          updateField(index, { key: event.target.value })
                        }
                        placeholder="issued_at"
                        value={field.key}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        {t("documentTypeForm.fieldLabel")}
                      </label>
                      <input
                        className="form-input"
                        onChange={(event) =>
                          updateField(index, { label: event.target.value })
                        }
                        placeholder={t("documentTypeForm.fieldLabelPlaceholder")}
                        value={field.label}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        {t("documentTypeForm.fieldType")}
                      </label>
                      <CustomSelect
                        className="form-select"
                        onChange={(event) => {
                          const inputType = event.target
                            .value as DocumentMetadataInputType;
                          updateField(index, {
                            inputType,
                            options: inputType === "select" ? field.options : [],
                          });
                        }}
                        value={field.inputType}
                      >
                        <option value="text">
                          {t("documentTypeForm.fieldTypeText")}
                        </option>
                        <option value="date">
                          {t("documentTypeForm.fieldTypeDate")}
                        </option>
                        <option value="select">
                          {t("documentTypeForm.fieldTypeSelect")}
                        </option>
                      </CustomSelect>
                    </div>
                  </div>

                  <div className="doc-meta-field-row">
                    <div className="form-group doc-meta-field-placeholder">
                      <label className="form-label">
                        {t("documentTypeForm.fieldPlaceholder")}
                      </label>
                      <input
                        className="form-input"
                        onChange={(event) =>
                          updateField(index, { placeholder: event.target.value })
                        }
                        value={field.placeholder ?? ""}
                      />
                    </div>
                    <div className="form-group doc-meta-field-required">
                      <label className="form-checkbox">
                        <input
                          checked={field.isRequired}
                          onChange={(event) =>
                            updateField(index, { isRequired: event.target.checked })
                          }
                          type="checkbox"
                        />
                        <span>{t("documentTypeForm.fieldRequired")}</span>
                      </label>
                    </div>
                    <div className="doc-meta-field-actions">
                      <button
                        aria-label={t("documentTypeForm.moveUp")}
                        className="btn btn-secondary btn-sm"
                        disabled={index === 0 || !canManage}
                        onClick={() => moveField(index, -1)}
                        title={!canManage ? noPermissionTitle : undefined}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label={t("documentTypeForm.moveDown")}
                        className="btn btn-secondary btn-sm"
                        disabled={index === metadataFields.length - 1 || !canManage}
                        onClick={() => moveField(index, 1)}
                        title={!canManage ? noPermissionTitle : undefined}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={!canManage}
                        onClick={() => removeField(index)}
                        title={!canManage ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {t("documentTypeForm.removeField")}
                      </button>
                    </div>
                  </div>

                  {field.inputType === "select" && (
                    <div className="doc-meta-options">
                      <div className="doc-meta-options-header">
                        <span className="form-label">
                          {t("documentTypeForm.fieldOptions")}
                        </span>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={!canManage}
                          onClick={() => addOption(index)}
                          title={!canManage ? noPermissionTitle : undefined}
                          type="button"
                        >
                          {t("documentTypeForm.addOption")}
                        </button>
                      </div>
                      {field.options.length === 0 ? (
                        <div className="form-hint">
                          {t("documentTypeForm.optionsEmpty")}
                        </div>
                      ) : (
                        field.options.map((option, optionIndex) => (
                          <div className="doc-meta-option-row" key={optionIndex}>
                            <input
                              className="form-input"
                              onChange={(event) =>
                                updateOption(index, optionIndex, {
                                  value: event.target.value,
                                })
                              }
                              placeholder={t("documentTypeForm.optionValue")}
                              value={option.value}
                            />
                            <input
                              className="form-input"
                              onChange={(event) =>
                                updateOption(index, optionIndex, {
                                  label: event.target.value,
                                })
                              }
                              placeholder={t("documentTypeForm.optionLabel")}
                              value={option.label}
                            />
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={!canManage}
                              onClick={() => removeOption(index, optionIndex)}
                              title={!canManage ? noPermissionTitle : undefined}
                              type="button"
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </form>
    </Modal>
  );
}
