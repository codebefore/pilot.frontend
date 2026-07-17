import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteInstitutionLogo,
  getInstitutionLogoObjectUrl,
  getInstitutionSettings,
  uploadInstitutionLogo,
  upsertInstitutionSettings,
  type FounderType,
  type InstitutionSettingsResponse,
  type InstitutionSettingsUpsertRequest,
} from "../../lib/institution-settings-api";
import { useAuth } from "../../lib/auth";
import { updateStoredInstitutionName } from "../../lib/auth-storage";
import { ApiError } from "../../lib/http";
import { useT, type TranslationKey, currentLocale } from "../../lib/i18n";
import { canManageArea } from "../../lib/permissions";
import {
  RECEIPT_PRINT_PROFILE_OPTIONS,
  readReceiptPrintProfileId,
  writeReceiptPrintProfileId,
  type ReceiptPrintProfileId,
} from "../../lib/receipt-print-settings";
import {
  getTurkeyDistrictOptions,
  resolveTurkeyDistrictValue,
  resolveTurkeyProvinceValue,
  TURKEY_ADDRESS_PROVINCE_OPTIONS,
} from "../../lib/turkey-address-options";
import { PageTabs } from "../layout/PageToolbar";
import { CustomSelect } from "../ui/CustomSelect";
import { SettingsFormSkeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";

type GeneralFormValues = {
  institutionName: string;
  institutionOfficialName: string;
  institutionCode: string;
  institutionAddress: string;
  institutionPhone: string;
  institutionEmail: string;
  districtNationalEducationDirector: string;
  districtNationalEducationBranchManager: string;
  city: string;
  district: string;
  buildingCapacity: string;
  bankName: string;
  iban: string;
  founderType: FounderType;
  founderName: string;
  founderTaxId: string;
  founderTaxOffice: string;
  founderAddress: string;
  founderPhone: string;
};

type GeneralFormErrors = Partial<Record<keyof GeneralFormValues, string>>;
type GeneralInstitutionTab = "institution" | "other" | "founder";

const EMPTY_VALUES: GeneralFormValues = {
  institutionName: "",
  institutionOfficialName: "",
  institutionCode: "",
  institutionAddress: "",
  institutionPhone: "",
  institutionEmail: "",
  districtNationalEducationDirector: "",
  districtNationalEducationBranchManager: "",
  city: "",
  district: "",
  buildingCapacity: "",
  bankName: "",
  iban: "",
  founderType: "real",
  founderName: "",
  founderTaxId: "",
  founderTaxOffice: "",
  founderAddress: "",
  founderPhone: "",
};
const SETTINGS_QUERY_CACHE_MS = 5 * 60 * 1000;
const INSTITUTION_SETTINGS_QUERY_KEY = ["settings", "institution-settings"] as const;
const PHONE_MAX_DIGITS = 10;

function normalizeGeneralPhone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").replace(/^0+/, "").slice(0, PHONE_MAX_DIGITS);
}

function normalizeCapacity(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function isValidGeneralPhone(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length === 0 ||
    (/^\d{1,10}$/.test(trimmed) && !trimmed.startsWith("0"))
  );
}

function fromResponse(response: InstitutionSettingsResponse): GeneralFormValues {
  const city = resolveTurkeyProvinceValue(response.city);
  return {
    institutionName: response.institutionName ?? "",
    institutionOfficialName: response.institutionOfficialName ?? "",
    institutionCode: response.institutionCode ?? "",
    institutionAddress: response.institutionAddress ?? "",
    institutionPhone: normalizeGeneralPhone(response.institutionPhone),
    institutionEmail: response.institutionEmail ?? "",
    districtNationalEducationDirector: response.districtNationalEducationDirector ?? "",
    districtNationalEducationBranchManager: response.districtNationalEducationBranchManager ?? "",
    city,
    district: resolveTurkeyDistrictValue(city, response.district),
    buildingCapacity: response.buildingCapacity == null ? "" : String(response.buildingCapacity),
    bankName: response.bankName ?? "",
    iban: response.iban ?? "",
    founderType: (response.founder.type as FounderType | null) ?? "real",
    founderName: response.founder.name ?? "",
    founderTaxId: response.founder.taxId ?? "",
    founderTaxOffice: response.founder.taxOffice ?? "",
    founderAddress: response.founder.address ?? "",
    founderPhone: normalizeGeneralPhone(response.founder.phone),
  };
}

function toUpsertRequest(
  values: GeneralFormValues,
  receiptPrintProfile: ReceiptPrintProfileId,
  rowVersion: number | null,
  authorizedPersons: InstitutionSettingsResponse["authorizedPersons"] = []
): InstitutionSettingsUpsertRequest {
  return {
    institutionName: values.institutionName.trim() || null,
    institutionOfficialName: values.institutionOfficialName.trim() || null,
    institutionCode: values.institutionCode.trim() || null,
    institutionAddress: values.institutionAddress.trim() || null,
    institutionPhone: normalizeGeneralPhone(values.institutionPhone) || null,
    institutionEmail: values.institutionEmail.trim() || null,
    districtNationalEducationDirector: values.districtNationalEducationDirector.trim() || null,
    districtNationalEducationBranchManager: values.districtNationalEducationBranchManager.trim() || null,
    city: values.city.trim() || null,
    district: values.district.trim() || null,
    buildingCapacity: values.buildingCapacity.trim()
      ? Number.parseInt(values.buildingCapacity.trim(), 10)
      : null,
    bankName: values.bankName.trim() || null,
    iban: values.iban.trim() || null,
    receiptPrintProfile,
    founder: {
      type: values.founderType,
      name: values.founderName.trim() || null,
      taxId: values.founderTaxId.trim() || null,
      taxOffice: values.founderTaxOffice.trim() || null,
      address: values.founderAddress.trim() || null,
      phone: normalizeGeneralPhone(values.founderPhone) || null,
    },
    authorizedPersons,
    rowVersion,
  };
}

function getValidationCode(error: unknown, field: string): string | null {
  if (!(error instanceof ApiError) || !error.validationErrorCodes) return null;
  const matches = error.validationErrorCodes[field];
  return matches && matches.length > 0 ? matches[0].code : null;
}

function getFirstValidationCode(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.validationErrorCodes) return null;
  const entries = Object.values(error.validationErrorCodes);
  for (const entry of entries) {
    if (entry && entry.length > 0) return entry[0].code;
  }
  return null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidTaxId(value: string): boolean {
  return /^\d{10,11}$/.test(value);
}

export function GeneralInstitutionSection() {
  const t = useT();
  const { showToast } = useToast();
  const institutionNameId = useId();
  const institutionOfficialNameId = useId();
  const institutionCodeId = useId();
  const institutionPhoneId = useId();
  const institutionEmailId = useId();
  const districtNationalEducationDirectorId = useId();
  const districtNationalEducationBranchManagerId = useId();
  const buildingCapacityId = useId();
  const bankNameId = useId();
  const ibanId = useId();
  const cityId = useId();
  const districtId = useId();
  const addressId = useId();
  const logoInputId = useId();
  const founderTypeId = useId();
  const founderNameId = useId();
  const founderTaxIdId = useId();
  const founderTaxOfficeId = useId();
  const founderPhoneId = useId();
  const founderAddressId = useId();
  const { user, permissions, activeInstitution } = useAuth();
  const queryClient = useQueryClient();
  const canManageSettings = canManageArea(user, permissions, "settings");
  const noPermissionTitle = t("common.noPermission");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [serverState, setServerState] = useState<InstitutionSettingsResponse | null>(null);
  const [values, setValues] = useState<GeneralFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<GeneralFormErrors>({});
  const [activeTab, setActiveTab] = useState<GeneralInstitutionTab>("institution");
  const [receiptPrintProfileId, setReceiptPrintProfileId] = useState<ReceiptPrintProfileId>(() =>
    readReceiptPrintProfileId()
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const settingsQuery = useQuery({
    gcTime: SETTINGS_QUERY_CACHE_MS,
    queryKey: INSTITUTION_SETTINGS_QUERY_KEY,
    queryFn: ({ signal }) => getInstitutionSettings(signal),
    retry: false,
  });
  const loading = settingsQuery.isLoading;

  useEffect(() => {
    if (settingsQuery.data === undefined) return;
    if (settingsQuery.data) {
      setServerState(settingsQuery.data);
      setValues(fromResponse(settingsQuery.data));
      setReceiptPrintProfileId(readReceiptPrintProfileId(settingsQuery.data.receiptPrintProfile));
    } else {
      setServerState(null);
      setValues(EMPTY_VALUES);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (settingsQuery.isError) {
      showToast(t("settings.general.toast.loadError"), "error");
      console.error(settingsQuery.error);
    }
  }, [settingsQuery.error, settingsQuery.isError, showToast, t]);

  useEffect(() => {
    const logo = serverState?.logo;
    if (!logo) {
      setLogoPreviewUrl(null);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;

    setLogoPreviewUrl(null);
    getInstitutionLogoObjectUrl(logo, String(serverState.rowVersion), controller.signal)
      .then((url) => {
        objectUrl = url;
        setLogoPreviewUrl(url);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Institution logo could not be loaded.", error);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [serverState?.logo, serverState?.rowVersion]);

  const dirty = useMemo(() => {
    if (!serverState) {
      return JSON.stringify(values) !== JSON.stringify(EMPTY_VALUES) ||
        receiptPrintProfileId !== readReceiptPrintProfileId();
    }
    return JSON.stringify(values) !== JSON.stringify(fromResponse(serverState)) ||
      receiptPrintProfileId !== readReceiptPrintProfileId(serverState.receiptPrintProfile);
  }, [receiptPrintProfileId, serverState, values]);

  const setField = <K extends keyof GeneralFormValues>(field: K, value: GeneralFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleInput =
    (field: keyof GeneralFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setField(field, event.target.value as GeneralFormValues[typeof field]);
    };

  const handlePhoneInput =
    (field: "institutionPhone" | "founderPhone") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setField(field, normalizeGeneralPhone(event.target.value));
    };

  const handleCapacityInput = (event: ChangeEvent<HTMLInputElement>) => {
    setField("buildingCapacity", normalizeCapacity(event.target.value));
  };

  const handleCityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const city = event.target.value;
    setValues((current) => ({
      ...current,
      city,
      district: "",
    }));
  };

  const handleFounderTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setField("founderType", event.target.value as FounderType);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageSettings) return;
    if (saving) return;

    const nextErrors: GeneralFormErrors = {};

    if (!values.institutionName.trim()) {
      nextErrors.institutionName = t("settings.general.validation.required");
    }
    if (!values.institutionOfficialName.trim()) {
      nextErrors.institutionOfficialName = t("settings.general.validation.required");
    }
    if (values.institutionEmail.trim() && !isValidEmail(values.institutionEmail.trim())) {
      nextErrors.institutionEmail = t("settings.general.validation.email");
    }
    if (!isValidGeneralPhone(values.institutionPhone)) {
      nextErrors.institutionPhone = t("generalInstitution.error.phoneStartWith5");
    }
    if (!isValidGeneralPhone(values.founderPhone)) {
      nextErrors.founderPhone = t("generalInstitution.error.phoneStartWith5");
    }
    if (values.city && !values.district) {
      nextErrors.district = t("settings.general.validation.districtRequired");
    }
    if (values.buildingCapacity && Number.parseInt(values.buildingCapacity, 10) < 1) {
      nextErrors.buildingCapacity = t("settings.general.validation.capacity");
    }
    if (values.district && !values.city) {
      nextErrors.city = t("settings.general.validation.cityRequired");
    }
    if (values.founderName.trim() && !values.founderTaxId.trim()) {
      nextErrors.founderTaxId = t("settings.general.validation.required");
    }
    if (values.founderTaxId.trim() && !isValidTaxId(values.founderTaxId.trim())) {
      nextErrors.founderTaxId = t("settings.general.validation.taxId");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (
        nextErrors.institutionName ||
        nextErrors.institutionOfficialName ||
        nextErrors.institutionCode ||
        nextErrors.institutionPhone ||
        nextErrors.institutionEmail ||
        nextErrors.city ||
        nextErrors.district ||
        nextErrors.buildingCapacity ||
        nextErrors.institutionAddress
      ) {
        setActiveTab("institution");
      } else if (
        nextErrors.bankName ||
        nextErrors.iban ||
        nextErrors.districtNationalEducationDirector ||
        nextErrors.districtNationalEducationBranchManager
      ) {
        setActiveTab("other");
      } else if (
        nextErrors.founderName ||
        nextErrors.founderTaxId ||
        nextErrors.founderTaxOffice ||
        nextErrors.founderPhone ||
        nextErrors.founderAddress
      ) {
        setActiveTab("founder");
      }
      showToast(t("settings.general.validation.fixErrors"), "error");
      return;
    }

    setSaving(true);
    try {
      const request = toUpsertRequest(
        values,
        receiptPrintProfileId,
        serverState?.rowVersion ?? null,
        serverState?.authorizedPersons ?? []
      );
      const response = await upsertInstitutionSettings(request);
      if (activeInstitution && response.institutionName) {
        updateStoredInstitutionName(activeInstitution.id, response.institutionName);
      }
      setServerState(response);
      setValues(fromResponse(response));
      setReceiptPrintProfileId(readReceiptPrintProfileId(response.receiptPrintProfile));
      setErrors({});
      queryClient.setQueryData(INSTITUTION_SETTINGS_QUERY_KEY, response);
      void queryClient.invalidateQueries({ queryKey: ["institutions", "list"] });
      void queryClient.invalidateQueries({ queryKey: INSTITUTION_SETTINGS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showToast(t("settings.general.toast.saved"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        showToast(t("settings.general.toast.concurrencyConflict"), "error");
        try {
          const fresh = await getInstitutionSettings();
          if (fresh) {
            setServerState(fresh);
            setValues(fromResponse(fresh));
            setReceiptPrintProfileId(readReceiptPrintProfileId(fresh.receiptPrintProfile));
            queryClient.setQueryData(INSTITUTION_SETTINGS_QUERY_KEY, fresh);
          }
        } catch {
          // ignore
        }
        return;
      }
      const code = getFirstValidationCode(error);
      const message = code ? t(code as TranslationKey) : t("settings.general.toast.saveError");
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!canManageSettings) return;
    if (!file) return;

    setUploading(true);
    try {
      const response = await uploadInstitutionLogo(file, serverState?.rowVersion ?? null);
      setServerState(response);
      setValues((current) => ({ ...current })); // logo değişti ama form alanları aynı, dirty değişmesin
      queryClient.setQueryData(INSTITUTION_SETTINGS_QUERY_KEY, response);
      void queryClient.invalidateQueries({ queryKey: ["institutions", "list"] });
      void queryClient.invalidateQueries({ queryKey: INSTITUTION_SETTINGS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showToast(t("settings.general.toast.logoUploaded"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        showToast(t("settings.general.toast.concurrencyConflict"), "error");
        const fresh = await getInstitutionSettings().catch(() => null);
        if (fresh) {
          setServerState(fresh);
          setValues(fromResponse(fresh));
          queryClient.setQueryData(INSTITUTION_SETTINGS_QUERY_KEY, fresh);
        }
        return;
      }
      const code = getValidationCode(error, "file") ?? getFirstValidationCode(error);
      const message = code
        ? t(code as TranslationKey)
        : t("settings.general.toast.logoUploadError");
      showToast(message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!canManageSettings) return;
    if (!serverState?.logo) return;
    setRemovingLogo(true);
    try {
      const response = await deleteInstitutionLogo(serverState.rowVersion);
      setServerState(response);
      queryClient.setQueryData(INSTITUTION_SETTINGS_QUERY_KEY, response);
      void queryClient.invalidateQueries({ queryKey: ["institutions", "list"] });
      void queryClient.invalidateQueries({ queryKey: INSTITUTION_SETTINGS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showToast(t("settings.general.toast.logoRemoved"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        showToast(t("settings.general.toast.concurrencyConflict"), "error");
        const fresh = await getInstitutionSettings().catch(() => null);
        if (fresh) {
          setServerState(fresh);
          setValues(fromResponse(fresh));
          queryClient.setQueryData(INSTITUTION_SETTINGS_QUERY_KEY, fresh);
        }
        return;
      }
      showToast(t("settings.general.toast.logoRemoveError"), "error");
    } finally {
      setRemovingLogo(false);
    }
  };

  const handleReceiptPrintProfileChange = (profileId: ReceiptPrintProfileId) => {
    setReceiptPrintProfileId(profileId);
    writeReceiptPrintProfileId(profileId);
  };

  const founderNameLabelKey: TranslationKey =
    values.founderType === "legal"
      ? "settings.general.founder.name.legal"
      : "settings.general.founder.name.real";
  const founderTaxIdLabelKey: TranslationKey =
    values.founderType === "legal"
      ? "settings.general.founder.taxId.legal"
      : "settings.general.founder.taxId.real";

  const cityOptions = useMemo(() => {
    if (
      values.city &&
      !TURKEY_ADDRESS_PROVINCE_OPTIONS.some((option) => option.value === values.city)
    ) {
      return [{ value: values.city, label: values.city }, ...TURKEY_ADDRESS_PROVINCE_OPTIONS];
    }
    return TURKEY_ADDRESS_PROVINCE_OPTIONS;
  }, [values.city]);
  const districtOptions = useMemo(
    () => getTurkeyDistrictOptions(values.city, values.district),
    [values.city, values.district]
  );

  const tabs: { key: GeneralInstitutionTab; label: string }[] = [
    { key: "institution", label: t("settings.general.section.institution") },
    { key: "founder", label: t("settings.general.section.founder") },
    { key: "other", label: t("settings.general.section.other") },
  ];

  if (loading) {
    return (
      <div className="settings-section-stack">
        <SettingsFormSkeleton rows={10} />
      </div>
    );
  }

  return (
    <form className="settings-section-stack settings-general-section" onSubmit={handleSubmit}>
      <div className="settings-tab-toolbar settings-general-toolbar">
        <div className="settings-general-toolbar-left">
          <PageTabs active={activeTab} onChange={setActiveTab} tabs={tabs} />
          <span className="settings-panel-note">
            {serverState
              ? t("settings.general.lastSaved", {
                  at: new Date(serverState.updatedAtUtc).toLocaleString(currentLocale()),
                })
              : t("settings.general.notSavedYet")}
          </span>
        </div>
      </div>

      {activeTab === "institution" ? (
      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">
            {t("settings.general.section.institution")}
          </div>
        </div>

        <div className="settings-surface-body">
          <div className="settings-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor={institutionNameId}>
                  {t("settings.general.field.institutionName")}
                </label>
                <input
                  id={institutionNameId}
                  className={errors.institutionName ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("institutionName")}
                  placeholder={t("settings.general.placeholder.institutionName")}
                  value={values.institutionName}
                />
                {errors.institutionName ? <div className="form-error">{errors.institutionName}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={institutionOfficialNameId}>
                  {t("settings.general.field.institutionOfficialName")}
                </label>
                <input
                  id={institutionOfficialNameId}
                  className={errors.institutionOfficialName ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("institutionOfficialName")}
                  placeholder={t("settings.general.placeholder.institutionOfficialName")}
                  value={values.institutionOfficialName}
                />
                {errors.institutionOfficialName ? <div className="form-error">{errors.institutionOfficialName}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor={institutionCodeId}>
                  {t("settings.general.field.institutionCode")}
                </label>
                <input
                  id={institutionCodeId}
                  className={errors.institutionCode ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("institutionCode")}
                  placeholder={t("settings.general.placeholder.institutionCode")}
                  value={values.institutionCode}
                />
                {errors.institutionCode ? <div className="form-error">{errors.institutionCode}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={institutionPhoneId}>{t("settings.general.field.phone")}</label>
                <input
                  id={institutionPhoneId}
                  className={errors.institutionPhone ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  inputMode="numeric"
                  maxLength={PHONE_MAX_DIGITS}
                  onChange={handlePhoneInput("institutionPhone")}
                  pattern="[0-9]*"
                  placeholder={t("settings.general.placeholder.phone")}
                  value={values.institutionPhone}
                />
                {errors.institutionPhone ? <div className="form-error">{errors.institutionPhone}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor={institutionEmailId}>{t("settings.general.field.email")}</label>
                <input
                  id={institutionEmailId}
                  className={errors.institutionEmail ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("institutionEmail")}
                  placeholder={t("settings.general.placeholder.email")}
                  type="email"
                  value={values.institutionEmail}
                />
                {errors.institutionEmail ? <div className="form-error">{errors.institutionEmail}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={cityId}>{t("settings.general.field.city")}</label>
                <CustomSelect
                  id={cityId}
                  aria-label={t("settings.general.field.city")}
                  className={errors.city ? "form-select error" : "form-select"}
                  disabled={!canManageSettings}
                  onChange={handleCityChange}
                  value={values.city}
                >
                  <option value="">{t("settings.general.city.placeholder")}</option>
                  {cityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
                {errors.city ? <div className="form-error">{errors.city}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor={districtId}>{t("settings.general.field.district")}</label>
                <CustomSelect
                  id={districtId}
                  aria-label={t("settings.general.field.district")}
                  className={errors.district ? "form-select error" : "form-select"}
                  disabled={!canManageSettings || !values.city}
                  onChange={handleInput("district")}
                  value={values.district}
                >
                  <option value="">{t("settings.general.district.placeholder")}</option>
                  {districtOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
                {errors.district ? <div className="form-error">{errors.district}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={buildingCapacityId}>
                  {t("settings.general.field.buildingCapacity")}
                </label>
                <input
                  id={buildingCapacityId}
                  className={errors.buildingCapacity ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  inputMode="numeric"
                  onChange={handleCapacityInput}
                  pattern="[0-9]*"
                  placeholder={t("settings.general.placeholder.buildingCapacity")}
                  value={values.buildingCapacity}
                />
                {errors.buildingCapacity ? (
                  <div className="form-error">{errors.buildingCapacity}</div>
                ) : null}
              </div>
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label" htmlFor={addressId}>
                  {t("settings.general.field.institutionAddress")}
                </label>
                <textarea
                  id={addressId}
                  className={errors.institutionAddress ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("institutionAddress")}
                  placeholder={t("settings.general.placeholder.institutionAddress")}
                  rows={3}
                  value={values.institutionAddress}
                />
                {errors.institutionAddress ? <div className="form-error">{errors.institutionAddress}</div> : null}
              </div>
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label" htmlFor={logoInputId}>{t("settings.general.field.logo")}</label>
                <div className="settings-logo-row">
                  <div className="settings-logo-preview">
                    {logoPreviewUrl ? (
                      <img alt={t("settings.general.field.logo")} src={logoPreviewUrl} />
                    ) : (
                      <span className="settings-logo-empty">
                        {t("settings.general.logo.empty")}
                      </span>
                    )}
                  </div>
                  <div className="settings-logo-actions">
                    <input
                      id={logoInputId}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      disabled={!canManageSettings}
                      hidden
                      onChange={handleLogoChange}
                      ref={fileInputRef}
                      type="file"
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!canManageSettings || uploading || removingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      title={!canManageSettings ? noPermissionTitle : undefined}
                      type="button"
                    >
                      {uploading
                        ? t("settings.general.logo.uploading")
                        : serverState?.logo
                          ? t("settings.general.logo.replace")
                          : t("settings.general.logo.upload")}
                    </button>
                    {serverState?.logo ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={!canManageSettings || uploading || removingLogo}
                        onClick={handleLogoRemove}
                        title={!canManageSettings ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {removingLogo
                          ? t("settings.general.logo.removing")
                          : t("settings.general.logo.remove")}
                      </button>
                    ) : null}
                    <span className="settings-panel-note">
                      {t("settings.general.logo.uploadHint")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {activeTab === "other" ? (
      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">
            {t("settings.general.section.other")}
          </div>
        </div>
        <div className="settings-surface-body">
          <div className="settings-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor={bankNameId}>
                  {t("settings.general.field.bankName")}
                </label>
                <input
                  id={bankNameId}
                  className={errors.bankName ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("bankName")}
                  placeholder={t("settings.general.placeholder.bankName")}
                  value={values.bankName}
                />
                {errors.bankName ? <div className="form-error">{errors.bankName}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={ibanId}>
                  {t("settings.general.field.iban")}
                </label>
                <input
                  id={ibanId}
                  className={errors.iban ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("iban")}
                  placeholder={t("settings.general.placeholder.iban")}
                  value={values.iban}
                />
                {errors.iban ? <div className="form-error">{errors.iban}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor={districtNationalEducationDirectorId}>
                  {t("settings.general.field.districtNationalEducationDirector")}
                </label>
                <input
                  id={districtNationalEducationDirectorId}
                  className={errors.districtNationalEducationDirector ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("districtNationalEducationDirector")}
                  placeholder={t("settings.general.placeholder.districtNationalEducationDirector")}
                  value={values.districtNationalEducationDirector}
                />
                {errors.districtNationalEducationDirector ? (
                  <div className="form-error">{errors.districtNationalEducationDirector}</div>
                ) : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={districtNationalEducationBranchManagerId}>
                  {t("settings.general.field.districtNationalEducationBranchManager")}
                </label>
                <input
                  id={districtNationalEducationBranchManagerId}
                  className={errors.districtNationalEducationBranchManager ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("districtNationalEducationBranchManager")}
                  placeholder={t("settings.general.placeholder.districtNationalEducationBranchManager")}
                  value={values.districtNationalEducationBranchManager}
                />
                {errors.districtNationalEducationBranchManager ? (
                  <div className="form-error">{errors.districtNationalEducationBranchManager}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {activeTab === "founder" ? (
      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">
            {t("settings.general.section.founder")}
          </div>
        </div>
        <div className="settings-surface-body">
          <div className="settings-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor={founderTypeId}>{t("settings.general.founder.type")}</label>
                <CustomSelect
                  id={founderTypeId}
                  aria-label={t("settings.general.founder.type")}
                  className="form-select"
                  disabled={!canManageSettings}
                  onChange={handleFounderTypeChange}
                  value={values.founderType}
                >
                  <option value="real">{t("settings.general.founder.type.real")}</option>
                  <option value="legal">{t("settings.general.founder.type.legal")}</option>
                </CustomSelect>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={founderNameId}>{t(founderNameLabelKey)}</label>
                <input
                  id={founderNameId}
                  className={errors.founderName ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("founderName")}
                  placeholder={t("settings.general.placeholder.founderName")}
                  value={values.founderName}
                />
                {errors.founderName ? <div className="form-error">{errors.founderName}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor={founderTaxIdId}>{t(founderTaxIdLabelKey)}</label>
                <input
                  id={founderTaxIdId}
                  className={errors.founderTaxId ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("founderTaxId")}
                  placeholder={
                    values.founderType === "legal"
                      ? t("settings.general.placeholder.taxNumber")
                      : t("settings.general.placeholder.nationalId")
                  }
                  value={values.founderTaxId}
                />
                {errors.founderTaxId ? <div className="form-error">{errors.founderTaxId}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={founderTaxOfficeId}>
                  {t("settings.general.founder.taxOffice")}
                </label>
                <input
                  id={founderTaxOfficeId}
                  className={errors.founderTaxOffice ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("founderTaxOffice")}
                  placeholder={t("settings.general.placeholder.taxOffice")}
                  value={values.founderTaxOffice}
                />
                {errors.founderTaxOffice ? <div className="form-error">{errors.founderTaxOffice}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor={founderPhoneId}>{t("settings.general.founder.phone")}</label>
                <input
                  id={founderPhoneId}
                  className={errors.founderPhone ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  inputMode="numeric"
                  maxLength={PHONE_MAX_DIGITS}
                  onChange={handlePhoneInput("founderPhone")}
                  pattern="[0-9]*"
                  placeholder={t("settings.general.placeholder.phone")}
                  value={values.founderPhone}
                />
                {errors.founderPhone ? <div className="form-error">{errors.founderPhone}</div> : null}
              </div>
              <div className="form-group" />
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label" htmlFor={founderAddressId}>{t("settings.general.founder.address")}</label>
                <textarea
                  id={founderAddressId}
                  className={errors.founderAddress ? "form-input error" : "form-input"}
                  disabled={!canManageSettings}
                  onChange={handleInput("founderAddress")}
                  placeholder={t("settings.general.placeholder.address")}
                  rows={3}
                  value={values.founderAddress}
                />
                {errors.founderAddress ? <div className="form-error">{errors.founderAddress}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      <div className="settings-form-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={!canManageSettings || !dirty || saving || uploading || removingLogo}
          title={!canManageSettings ? noPermissionTitle : undefined}
          type="submit"
        >
          {saving ? t("settings.toolbar.saving") : t("settings.toolbar.save")}
        </button>
      </div>

      {activeTab === "other" ? (
        <section className="settings-surface settings-receipt-profile-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">
              {t("settings.general.receiptPrintProfile.label")}
            </div>
          </div>
          <div className="settings-surface-body">
            <div className="settings-receipt-profile-grid" role="radiogroup" aria-label={t("settings.general.receiptPrintProfile.label")}>
              {RECEIPT_PRINT_PROFILE_OPTIONS.map((option) => {
                const active = receiptPrintProfileId === option.id;
                return (
                  <button
                    aria-checked={active}
                    className={active ? "settings-receipt-profile-option active" : "settings-receipt-profile-option"}
                    disabled={!canManageSettings}
                    key={option.id}
                    onClick={() => handleReceiptPrintProfileChange(option.id)}
                    role="radio"
                    title={!canManageSettings ? noPermissionTitle : undefined}
                    type="button"
                  >
                    <span className="settings-receipt-profile-check" aria-hidden="true" />
                    <span className="settings-receipt-profile-copy">
                      <strong>{t(option.labelKey as TranslationKey)}</strong>
                      <small>{t(option.descriptionKey as TranslationKey)}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="settings-panel-note">
              {t("settings.general.receiptPrintProfile.note")}
            </span>
          </div>
        </section>
      ) : null}
    </form>
  );
}
