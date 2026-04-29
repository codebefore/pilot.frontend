import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { assignCandidateGroup, createCandidate } from "../../lib/candidates-api";
import { ApiError } from "../../lib/http";
import { getGroups } from "../../lib/groups-api";
import { useLanguage, useT } from "../../lib/i18n";
import {
  CANDIDATE_GENDER_OPTIONS,
  EXISTING_LICENSE_TYPE_OPTIONS,
  TURKEY_PROVINCE_OPTIONS,
} from "../../lib/status-maps";
import { buildGroupHeading, compareTermsDesc } from "../../lib/term-label";
import { getTerms } from "../../lib/terms-api";
import type { CandidateGenderValue, GroupResponse, LicenseClass, TermResponse } from "../../lib/types";
import { useLicenseClassOptions } from "../../lib/use-license-class-options";
import { CandidateTagsInput } from "../ui/CandidateTagsInput";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { useToast } from "../ui/Toast";

type NewCandidateForm = {
  tc: string;
  className: LicenseClass;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: CandidateGenderValue;
  phone: string;
  email: string;
  groupId: string;
  tags: string[];
  hasExistingLicense: boolean;
  existingLicenseType: string;
  existingLicenseIssuedAt: string;
  existingLicenseNumber: string;
  existingLicenseIssuedProvince: string;
  existingLicensePre2016: boolean;
};

type NewCandidateModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

function seventeenYearsAgoISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 17);
  return d.toISOString().slice(0, 10);
}

function yearsSince(iso: string): number {
  const birth = new Date(iso);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return years;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const defaultValues = (): NewCandidateForm => ({
  tc: "",
  className: "B",
  firstName: "",
  lastName: "",
  birthDate: seventeenYearsAgoISO(),
  gender: "male",
  phone: "",
  email: "",
  groupId: "",
  tags: [],
  hasExistingLicense: false,
  existingLicenseType: "",
  existingLicenseIssuedAt: "",
  existingLicenseNumber: "",
  existingLicenseIssuedProvince: "",
  existingLicensePre2016: false,
});

export function NewCandidateModal({ open, onClose, onSubmit }: NewCandidateModalProps) {
  const { showToast } = useToast();
  const { lang } = useLanguage();
  const t = useT();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const today = todayISO();
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [terms, setTerms] = useState<TermResponse[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    clearErrors,
    formState: { errors },
  } = useForm<NewCandidateForm>({ defaultValues: defaultValues() });

  const selectedClass = watch("className");
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const selectedGender = watch("gender");
  const selectedGroupId = watch("groupId");
  const hasExistingLicense = watch("hasExistingLicense");
  const birthDate = watch("birthDate");
  const existingLicenseIssuedAt = watch("existingLicenseIssuedAt");
  const tags = watch("tags");
  const availableGroups = groups;
  const sortedTerms = terms.length > 0 ? [...terms].sort(compareTermsDesc) : [];
  const classRegistration = register("className", { required: true });
  const birthDateRegistration = register("birthDate", {
    required: "Zorunlu alan",
    validate: (v) => {
      const age = yearsSince(v);
      if (age < 17) return "En az 17 yaşında olmalı";
      if (age > 80) return "Geçerli bir tarih girin";
      return true;
    },
  });
  const existingLicenseIssuedAtRegistration = register("existingLicenseIssuedAt", {
    validate: (value) => !hasExistingLicense || !!value || "Zorunlu alan",
  });

  useEffect(() => {
    if (!open || licenseClassOptions.length === 0) return;
    if (licenseClassOptions.some((option) => option.value === selectedClass)) {
      return;
    }

    setValue("className", licenseClassOptions[0].value, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [licenseClassOptions, open, selectedClass, setValue]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) reset(defaultValues());
  }, [open, reset]);

  useEffect(() => {
    if (hasExistingLicense) return;
    setValue("existingLicenseType", "");
    setValue("existingLicenseIssuedAt", "");
    setValue("existingLicenseNumber", "");
    setValue("existingLicenseIssuedProvince", "");
    setValue("existingLicensePre2016", false);
    clearErrors([
      "existingLicenseType",
      "existingLicenseIssuedAt",
      "existingLicenseNumber",
      "existingLicenseIssuedProvince",
    ]);
  }, [clearErrors, hasExistingLicense, setValue]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();

    setGroupsLoading(true);

    getGroups({ pageSize: 100 }, controller.signal)
      .then((result) => setGroups(result.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGroups([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false);
      });

    // Fetch the term catalog so group labels can show the right
    // "Nisan 2026 / 2" disambiguation.
    getTerms({ pageSize: 200 }, controller.signal)
      .then((result) => setTerms(result.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setTerms([]);
      });

    return () => {
      controller.abort();
    };
  }, [open]);

  useEffect(() => {
    if (
      selectedGroupId &&
      !groups.some((group) => group.id === selectedGroupId)
    ) {
      setValue("groupId", "");
    }
  }, [groups, selectedClass, selectedGroupId, setValue]);

  const submit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      const candidate = await createCandidate({
        firstName: data.firstName,
        lastName: data.lastName,
        nationalId: data.tc,
        phoneNumber: data.phone || null,
        email: data.email || null,
        birthDate: data.birthDate || null,
        gender: data.gender,
        licenseClass: data.className,
        existingLicenseType: data.hasExistingLicense ? data.existingLicenseType || null : null,
        existingLicenseIssuedAt: data.hasExistingLicense
          ? data.existingLicenseIssuedAt || null
          : null,
        existingLicenseNumber: data.hasExistingLicense ? data.existingLicenseNumber.trim() || null : null,
        existingLicenseIssuedProvince: data.hasExistingLicense
          ? data.existingLicenseIssuedProvince.trim() || null
          : null,
        existingLicensePre2016: data.hasExistingLicense ? data.existingLicensePre2016 : false,
        status: "pre_registered",
        examFeePaid: false,
        initialPaymentReceived: false,
        tags: data.tags,
      });

      if (data.groupId) {
        try {
          await assignCandidateGroup(candidate.id, data.groupId);
        } catch {
          showToast("Aday kaydedildi, ancak grup atanamadı.", "error");
          onSubmit();
          return;
        }
      }

      showToast("Aday başarıyla kaydedildi");
      onSubmit();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("tc", { message: "Bu TC ile kayıtlı aday zaten mevcut" });
      } else {
        showToast("Aday kaydedilemedi. Lütfen tekrar deneyin.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button" disabled={submitting}>
            İptal
          </button>
          <button className="btn btn-primary" onClick={submit} type="button" disabled={submitting}>
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Yeni Aday Kaydı"
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">TC Kimlik No</label>
            <input
              className={fieldClass(!!errors.tc, "form-input")}
              inputMode="numeric"
              maxLength={11}
              placeholder="11 haneli TC"
              {...register("tc", {
                required: "Zorunlu alan",
                pattern: { value: /^\d{11}$/, message: "11 haneli rakam olmalı" },
              })}
            />
            {errors.tc && <div className="form-error">{errors.tc.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Ehliyet Tipi</label>
            <CustomSelect
              className={fieldClass(!!errors.className, "form-select")}
              value={selectedClass}
              {...classRegistration}
            >
              {licenseClassOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ad</label>
            <input
              className={fieldClass(!!errors.firstName, "form-input")}
              placeholder="Adı"
              {...register("firstName", {
                required: "Zorunlu alan",
                minLength: { value: 2, message: "En az 2 karakter" },
              })}
            />
            {errors.firstName && <div className="form-error">{errors.firstName.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Soyad</label>
            <input
              className={fieldClass(!!errors.lastName, "form-input")}
              placeholder="Soyadı"
              {...register("lastName", {
                required: "Zorunlu alan",
                minLength: { value: 2, message: "En az 2 karakter" },
              })}
            />
            {errors.lastName && <div className="form-error">{errors.lastName.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Doğum Tarihi</label>
            <LocalizedDateInput
              ariaLabel="Doğum Tarihi"
              className={fieldClass(!!errors.birthDate, "form-input")}
              inputRef={birthDateRegistration.ref}
              lang={dateInputLang}
              name={birthDateRegistration.name}
              onBlur={birthDateRegistration.onBlur}
              onChange={(value) =>
                setValue("birthDate", value, { shouldDirty: true, shouldValidate: true })
              }
              value={birthDate}
            />
            {errors.birthDate && <div className="form-error">{errors.birthDate.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Cinsiyet</label>
            <CustomSelect
              className={fieldClass(!!errors.gender, "form-select")}
              value={selectedGender}
              {...register("gender")}
            >
              {CANDIDATE_GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input
              className={fieldClass(!!errors.phone, "form-input")}
              inputMode="numeric"
              maxLength={10}
              placeholder="5XXXXXXXXX"
              {...register("phone", {
                required: "Zorunlu alan",
                pattern: {
                  value: /^5\d{9}$/,
                  message: "10 hane, 5 ile başlamalı (başında 0 yok)",
                },
              })}
            />
            {errors.phone && <div className="form-error">{errors.phone.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">E-posta</label>
            <input
              className={fieldClass(!!errors.email, "form-input")}
              placeholder="aday@mail.com"
              type="email"
              {...register("email", {
                validate: (value) =>
                  !value ||
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
                  "Geçersiz e-posta",
              })}
            />
            {errors.email && <div className="form-error">{errors.email.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Grup</label>
            <CustomSelect
              className={fieldClass(!!errors.groupId, "form-select")}
              disabled={groupsLoading}
              {...register("groupId")}
            >
              <option value="">— Atanmamış —</option>
              {availableGroups.map((g) => {
                return (
                  <option key={g.id} value={g.id}>
                    {buildGroupHeading(
                      g.title,
                      g.term,
                      sortedTerms.length > 0 ? sortedTerms : [g.term],
                      lang
                    )}
                  </option>
                );
              })}
            </CustomSelect>
            {errors.groupId && <div className="form-error">{errors.groupId.message}</div>}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("candidates.tags.label")}</label>
            <CandidateTagsInput
              ariaLabel={t("candidates.tags.label")}
              onChange={(next) =>
                setValue("tags", next, { shouldDirty: true, shouldValidate: true })
              }
              value={tags}
            />
          </div>
        </div>

        <section className="form-subsection">
          <div className="form-subsection-header">
            <div>
              <div className="form-subsection-title">Mevcut Sürücü Belgesi</div>
              <div className="form-subsection-note">
                Varsa eski ehliyet bilgisini buradan ekleyin.
              </div>
            </div>
            <label className="switch-toggle">
              <input
                aria-label="Mevcut sürücü belgesi var"
                type="checkbox"
                {...register("hasExistingLicense")}
              />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>Var</span>
            </label>
          </div>

          {hasExistingLicense && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Mevcut Belge</label>
                  <CustomSelect
                    aria-label="Mevcut Belge"
                    className={fieldClass(!!errors.existingLicenseType, "form-select")}
                    {...register("existingLicenseType", {
                      validate: (value) =>
                        !hasExistingLicense || !!value || "Zorunlu alan",
                    })}
                  >
                    <option value="">Belge seçin</option>
                    {EXISTING_LICENSE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </CustomSelect>
                  {errors.existingLicenseType && (
                    <div className="form-error">{errors.existingLicenseType.message}</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Belge Tarihi</label>
                  <LocalizedDateInput
                    ariaLabel="Belge Tarihi"
                    className={fieldClass(!!errors.existingLicenseIssuedAt, "form-input")}
                    defaultOnOpen={today}
                    inputRef={existingLicenseIssuedAtRegistration.ref}
                    lang={dateInputLang}
                    name={existingLicenseIssuedAtRegistration.name}
                    onBlur={existingLicenseIssuedAtRegistration.onBlur}
                    onChange={(value) =>
                      setValue("existingLicenseIssuedAt", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    value={existingLicenseIssuedAt}
                  />
                  {errors.existingLicenseIssuedAt && (
                    <div className="form-error">{errors.existingLicenseIssuedAt.message}</div>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Belge No</label>
                  <input
                    aria-label="Belge No"
                    className={fieldClass(!!errors.existingLicenseNumber, "form-input")}
                    placeholder="Örn. ABC-12345"
                    {...register("existingLicenseNumber", {
                      validate: (value) =>
                        !hasExistingLicense || !!value.trim() || "Zorunlu alan",
                    })}
                  />
                  {errors.existingLicenseNumber && (
                    <div className="form-error">{errors.existingLicenseNumber.message}</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Belge Veriliş İli</label>
                  <CustomSelect
                    aria-label="Belge Veriliş İli"
                    className={fieldClass(!!errors.existingLicenseIssuedProvince, "form-select")}
                    {...register("existingLicenseIssuedProvince", {
                      validate: (value) =>
                        !hasExistingLicense || !!value.trim() || "Zorunlu alan",
                    })}
                  >
                    <option value="">İl seçin</option>
                    {TURKEY_PROVINCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </CustomSelect>
                  {errors.existingLicenseIssuedProvince && (
                    <div className="form-error">
                      {errors.existingLicenseIssuedProvince.message}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="switch-toggle">
                    <input type="checkbox" {...register("existingLicensePre2016")} />
                    <span className="switch-toggle-control" aria-hidden="true" />
                    <span>2016 Ocak öncesi</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </section>
      </form>
    </Modal>
  );
}
