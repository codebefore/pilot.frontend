import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { createArea, updateArea } from "../../lib/areas-api";
import { AREA_TYPE_OPTIONS } from "../../lib/area-catalog";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import type { AreaResponse, AreaUpsertRequest } from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type AreaFormValues = {
  code: string;
  name: string;
  areaType: AreaUpsertRequest["areaType"];
  capacity: string;
  district: string;
  address: string;
  isActive: boolean;
  notes: string;
};

type AreaFormModalProps = {
  open: boolean;
  editing: AreaResponse | null;
  onClose: () => void;
  onSaved: (saved: AreaResponse) => void;
  onConcurrencyConflict?: () => void;
};

const VALIDATION_FIELD_MAP: Record<string, keyof AreaFormValues> = {
  code: "code",
  Code: "code",
  name: "name",
  Name: "name",
  areaType: "areaType",
  AreaType: "areaType",
  capacity: "capacity",
  Capacity: "capacity",
  district: "district",
  District: "district",
  address: "address",
  Address: "address",
  notes: "notes",
  Notes: "notes",
};

const CONCURRENCY_CODE = "area.validation.concurrencyConflict";

function hasConcurrencyError(
  codes: Record<string, ApiValidationError[]> | undefined
): boolean {
  if (!codes) return false;
  return Object.values(codes).some((errors) =>
    errors.some((error) => error.code === CONCURRENCY_CODE)
  );
}

function applyServerFieldErrors(
  error: ApiError,
  setError: (field: keyof AreaFormValues, error: { message: string }) => void,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): { appliedFieldError: boolean; unmappedMessage: string | null } {
  const codes = error.validationErrorCodes;
  const fallback = error.validationErrors;
  let appliedFieldError = false;
  let unmappedMessage: string | null = null;

  if (codes) {
    for (const [serverField, fieldErrors] of Object.entries(codes)) {
      const formField = VALIDATION_FIELD_MAP[serverField];
      const first = fieldErrors[0];
      if (!first) continue;
      if (!formField) {
        unmappedMessage ??= t(first.code as TranslationKey, first.params);
        continue;
      }
      setError(formField, { message: t(first.code as TranslationKey, first.params) });
      appliedFieldError = true;
    }
  }

  if (fallback) {
    for (const [serverField, messages] of Object.entries(fallback)) {
      const formField = VALIDATION_FIELD_MAP[serverField];
      if (!messages?.[0]) continue;
      if (!formField) {
        unmappedMessage ??= messages[0];
        continue;
      }
      if (codes && codes[serverField]?.length) continue;
      setError(formField, { message: messages[0] });
      appliedFieldError = true;
    }
  }

  return { appliedFieldError, unmappedMessage };
}

function normalizeUppercase(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}

function getEmptyValues(editing: AreaResponse | null): AreaFormValues {
  return editing
    ? {
        code: editing.code,
        name: editing.name,
        areaType: editing.areaType,
        capacity: editing.capacity !== null ? String(editing.capacity) : "",
        district: editing.district ?? "",
        address: editing.address ?? "",
        isActive: editing.isActive,
        notes: editing.notes ?? "",
      }
    : {
        code: "",
        name: "",
        areaType: "classroom",
        capacity: "",
        district: "",
        address: "",
        isActive: true,
        notes: "",
      };
}

function parseOptionalInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateCapacity(value: string): true | string {
  const parsed = parseOptionalInteger(value);
  if (parsed === null) return true;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10000) {
    return "Kapasite 0 ile 10000 arasında olmalı";
  }
  return true;
}

export function AreaFormModal({
  open,
  editing,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: AreaFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<AreaFormValues>({
    defaultValues: getEmptyValues(editing),
  });

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);

    const payload: AreaUpsertRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      areaType: values.areaType,
      capacity: parseOptionalInteger(values.capacity),
      district: values.district.trim() || null,
      address: values.address.trim() || null,
      isActive: values.isActive,
      notes: values.notes.trim() || null,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateArea(editing.id, payload)
        : await createArea(payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && hasConcurrencyError(error.validationErrorCodes)) {
          showToast(t("area.validation.concurrencyConflict"), "error");
          onConcurrencyConflict?.();
          return;
        }
        const { appliedFieldError, unmappedMessage } = applyServerFieldErrors(error, setError, t);
        if (unmappedMessage) {
          showToast(unmappedMessage, "error");
        } else if (!appliedFieldError) {
          showToast(t("area.validation.generic"), "error");
        }
      } else {
        showToast(t("area.validation.generic"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (message?: string) => (message ? "form-input error" : "form-input");
  const selectClass = (message?: string) => (message ? "form-select error" : "form-select");

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" disabled={submitting} onClick={onClose} type="button">
            İptal
          </button>
          <button className="btn btn-primary" disabled={submitting} onClick={submit} type="button">
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={editing ? "Alan Düzenle" : "Yeni Alan"}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Alan Kodu</label>
            <Controller
              control={control}
              name="code"
              rules={{ required: "Kod zorunlu" }}
              render={({ field }) => (
                <input
                  {...field}
                  autoCapitalize="characters"
                  className={fieldClass(errors.code?.message)}
                  placeholder="SINIF-01"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeUppercase(event.target.value))}
                />
              )}
            />
            {errors.code && <div className="form-error">{errors.code.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Alan Adı</label>
            <input
              className={fieldClass(errors.name?.message)}
              placeholder="Ümraniye Sınıfı"
              {...register("name", { required: "Alan adı zorunlu" })}
            />
            {errors.name && <div className="form-error">{errors.name.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Alan Tipi</label>
            <Controller
              control={control}
              name="areaType"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.areaType?.message)} {...field}>
                  {AREA_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.areaType && <div className="form-error">{errors.areaType.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Kapasite</label>
            <input
              className={fieldClass(errors.capacity?.message)}
              inputMode="numeric"
              min={0}
              placeholder="24"
              step={1}
              type="number"
              {...register("capacity", { validate: validateCapacity })}
            />
            {errors.capacity && <div className="form-error">{errors.capacity.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">İlçe / Bölge</label>
            <input
              className={fieldClass(errors.district?.message)}
              placeholder="Ümraniye"
              {...register("district")}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Adres / Konum</label>
            <input
              className={fieldClass(errors.address?.message)}
              placeholder="Merkez şube 2. kat"
              {...register("address")}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Genel Durum</label>
            <label className="switch-toggle">
              <input type="checkbox" {...register("isActive")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>{watch("isActive") ? "Aktif" : "Pasif"}</span>
            </label>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Not</label>
            <textarea className="form-input" rows={4} {...register("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
