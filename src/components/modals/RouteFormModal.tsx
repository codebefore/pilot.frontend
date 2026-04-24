import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { createRoute, updateRoute } from "../../lib/routes-api";
import { ROUTE_USAGE_OPTIONS } from "../../lib/route-catalog";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import type { RouteResponse, RouteUpsertRequest } from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type RouteFormValues = {
  code: string;
  name: string;
  usageType: RouteUpsertRequest["usageType"];
  district: string;
  startLocation: string;
  endLocation: string;
  distanceKm: string;
  estimatedDurationMinutes: string;
  isActive: boolean;
  notes: string;
};

type RouteFormModalProps = {
  open: boolean;
  editing: RouteResponse | null;
  onClose: () => void;
  onSaved: (saved: RouteResponse) => void;
  onConcurrencyConflict?: () => void;
};

const VALIDATION_FIELD_MAP: Record<string, keyof RouteFormValues> = {
  code: "code",
  Code: "code",
  name: "name",
  Name: "name",
  usageType: "usageType",
  UsageType: "usageType",
  district: "district",
  District: "district",
  startLocation: "startLocation",
  StartLocation: "startLocation",
  endLocation: "endLocation",
  EndLocation: "endLocation",
  distanceKm: "distanceKm",
  DistanceKm: "distanceKm",
  estimatedDurationMinutes: "estimatedDurationMinutes",
  EstimatedDurationMinutes: "estimatedDurationMinutes",
  notes: "notes",
  Notes: "notes",
};

const CONCURRENCY_CODE = "route.validation.concurrencyConflict";

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
  setError: (field: keyof RouteFormValues, error: { message: string }) => void,
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

function getEmptyValues(editing: RouteResponse | null): RouteFormValues {
  return editing
    ? {
        code: editing.code,
        name: editing.name,
        usageType: editing.usageType,
        district: editing.district ?? "",
        startLocation: editing.startLocation ?? "",
        endLocation: editing.endLocation ?? "",
        distanceKm: editing.distanceKm !== null ? String(editing.distanceKm) : "",
        estimatedDurationMinutes:
          editing.estimatedDurationMinutes !== null
            ? String(editing.estimatedDurationMinutes)
            : "",
        isActive: editing.isActive,
        notes: editing.notes ?? "",
      }
    : {
        code: "",
        name: "",
        usageType: "practice_and_exam",
        district: "",
        startLocation: "",
        endLocation: "",
        distanceKm: "",
        estimatedDurationMinutes: "",
        isActive: true,
        notes: "",
      };
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateDistance(value: string): true | string {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) return true;
  if (parsed < 0 || parsed > 999.99) {
    return "Mesafe 0 ile 999.99 km arasında olmalı";
  }
  return true;
}

function validateDuration(value: string): true | string {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) return true;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1440) {
    return "Süre 0 ile 1440 dakika arasında olmalı";
  }
  return true;
}

export function RouteFormModal({
  open,
  editing,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: RouteFormModalProps) {
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
  } = useForm<RouteFormValues>({
    defaultValues: getEmptyValues(editing),
  });

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);

    const payload: RouteUpsertRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      usageType: values.usageType,
      district: values.district.trim() || null,
      startLocation: values.startLocation.trim() || null,
      endLocation: values.endLocation.trim() || null,
      distanceKm: parseOptionalNumber(values.distanceKm),
      estimatedDurationMinutes: parseOptionalNumber(values.estimatedDurationMinutes),
      isActive: values.isActive,
      notes: values.notes.trim() || null,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateRoute(editing.id, payload)
        : await createRoute(payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && hasConcurrencyError(error.validationErrorCodes)) {
          showToast(t("route.validation.concurrencyConflict"), "error");
          onConcurrencyConflict?.();
          return;
        }
        const { appliedFieldError, unmappedMessage } = applyServerFieldErrors(error, setError, t);
        if (unmappedMessage) {
          showToast(unmappedMessage, "error");
        } else if (!appliedFieldError) {
          showToast(t("route.validation.generic"), "error");
        }
      } else {
        showToast(t("route.validation.generic"), "error");
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
      title={editing ? "Güzergah Düzenle" : "Yeni Güzergah"}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Güzergah Kodu</label>
            <Controller
              control={control}
              name="code"
              rules={{ required: "Kod zorunlu" }}
              render={({ field }) => (
                <input
                  {...field}
                  autoCapitalize="characters"
                  className={fieldClass(errors.code?.message)}
                  placeholder="GZR-01"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeUppercase(event.target.value))}
                />
              )}
            />
            {errors.code && <div className="form-error">{errors.code.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Güzergah Adı</label>
            <input
              className={fieldClass(errors.name?.message)}
              placeholder="Ümraniye Sınav Güzergahı"
              {...register("name", { required: "Güzergah adı zorunlu" })}
            />
            {errors.name && <div className="form-error">{errors.name.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Kullanım</label>
            <Controller
              control={control}
              name="usageType"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.usageType?.message)} {...field}>
                  {ROUTE_USAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.usageType && <div className="form-error">{errors.usageType.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">İlçe / Bölge</label>
            <input
              className={fieldClass(errors.district?.message)}
              placeholder="Ümraniye"
              {...register("district")}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Başlangıç</label>
            <input
              className={fieldClass(errors.startLocation?.message)}
              placeholder="Kurs önü"
              {...register("startLocation")}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bitiş</label>
            <input
              className={fieldClass(errors.endLocation?.message)}
              placeholder="Sınav alanı"
              {...register("endLocation")}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Mesafe (km)</label>
            <input
              className={fieldClass(errors.distanceKm?.message)}
              inputMode="decimal"
              min={0}
              placeholder="12.5"
              step="0.1"
              type="number"
              {...register("distanceKm", { validate: validateDistance })}
            />
            {errors.distanceKm && <div className="form-error">{errors.distanceKm.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Tahmini Süre (dk)</label>
            <input
              className={fieldClass(errors.estimatedDurationMinutes?.message)}
              inputMode="numeric"
              min={0}
              placeholder="35"
              step={1}
              type="number"
              {...register("estimatedDurationMinutes", { validate: validateDuration })}
            />
            {errors.estimatedDurationMinutes && (
              <div className="form-error">{errors.estimatedDurationMinutes.message}</div>
            )}
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
