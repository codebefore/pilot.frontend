import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import {
  deleteInstitutionLogo,
  getInstitutionLogoUrl,
  getInstitutionSettings,
  uploadInstitutionLogo,
  upsertInstitutionSettings,
  type FounderType,
  type InstitutionSettingsResponse,
  type InstitutionSettingsUpsertRequest,
} from "../../lib/institution-settings-api";
import { ApiError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import {
  getTurkeyDistrictOptions,
  resolveTurkeyDistrictValue,
  resolveTurkeyProvinceValue,
  TURKEY_ADDRESS_PROVINCE_OPTIONS,
} from "../../lib/turkey-address-options";
import { PageTabs } from "../layout/PageToolbar";
import { CustomSelect } from "../ui/CustomSelect";
import { useToast } from "../ui/Toast";

type AuthorizedPersonForm = {
  clientId: string;
  serverId: string | null;
  fullName: string;
  phone: string;
  title: string;
};

type GeneralFormValues = {
  institutionName: string;
  institutionOfficialName: string;
  institutionCode: string;
  institutionAddress: string;
  institutionPhone: string;
  institutionEmail: string;
  city: string;
  district: string;
  founderType: FounderType;
  founderName: string;
  founderTaxId: string;
  founderTaxOffice: string;
  founderAddress: string;
  founderPhone: string;
  authorizedPersons: AuthorizedPersonForm[];
};

type GeneralFormErrors = Partial<Record<keyof GeneralFormValues, string>>;
type AuthorizedPersonErrors = Record<string, Partial<Record<"fullName" | "phone" | "title", string>>>;
type GeneralInstitutionTab = "institution" | "founder" | "authorized";

const EMPTY_VALUES: GeneralFormValues = {
  institutionName: "",
  institutionOfficialName: "",
  institutionCode: "",
  institutionAddress: "",
  institutionPhone: "",
  institutionEmail: "",
  city: "",
  district: "",
  founderType: "real",
  founderName: "",
  founderTaxId: "",
  founderTaxOffice: "",
  founderAddress: "",
  founderPhone: "",
  authorizedPersons: [],
};

function fromResponse(response: InstitutionSettingsResponse): GeneralFormValues {
  const city = resolveTurkeyProvinceValue(response.city);
  return {
    institutionName: response.institutionName ?? "",
    institutionOfficialName: response.institutionOfficialName ?? "",
    institutionCode: response.institutionCode ?? "",
    institutionAddress: response.institutionAddress ?? "",
    institutionPhone: response.institutionPhone ?? "",
    institutionEmail: response.institutionEmail ?? "",
    city,
    district: resolveTurkeyDistrictValue(city, response.district),
    founderType: (response.founder.type as FounderType | null) ?? "real",
    founderName: response.founder.name ?? "",
    founderTaxId: response.founder.taxId ?? "",
    founderTaxOffice: response.founder.taxOffice ?? "",
    founderAddress: response.founder.address ?? "",
    founderPhone: response.founder.phone ?? "",
    authorizedPersons: response.authorizedPersons.map((person) => ({
      clientId: person.id,
      serverId: person.id,
      fullName: person.fullName,
      phone: person.phone ?? "",
      title: person.title ?? "",
    })),
  };
}

function toUpsertRequest(
  values: GeneralFormValues,
  rowVersion: number | null
): InstitutionSettingsUpsertRequest {
  return {
    institutionName: values.institutionName.trim() || null,
    institutionOfficialName: values.institutionOfficialName.trim() || null,
    institutionCode: values.institutionCode.trim() || null,
    institutionAddress: values.institutionAddress.trim() || null,
    institutionPhone: values.institutionPhone.trim() || null,
    institutionEmail: values.institutionEmail.trim() || null,
    city: values.city.trim() || null,
    district: values.district.trim() || null,
    founder: {
      type: values.founderType,
      name: values.founderName.trim() || null,
      taxId: values.founderTaxId.trim() || null,
      taxOffice: values.founderTaxOffice.trim() || null,
      address: values.founderAddress.trim() || null,
      phone: values.founderPhone.trim() || null,
    },
    authorizedPersons: values.authorizedPersons.map((person) => ({
      id: person.serverId,
      fullName: person.fullName.trim(),
      phone: person.phone.trim() || null,
      title: person.title.trim() || null,
    })),
    mebbis: null,
    rowVersion,
  };
}

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
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

function isValidPhone(value: string): boolean {
  return /^[0-9+\s()/-]{7,24}$/.test(value);
}

function isValidTaxId(value: string): boolean {
  return /^\d{10,11}$/.test(value);
}

export function GeneralInstitutionSection() {
  const t = useT();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [serverState, setServerState] = useState<InstitutionSettingsResponse | null>(null);
  const [values, setValues] = useState<GeneralFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<GeneralFormErrors>({});
  const [authorizedErrors, setAuthorizedErrors] = useState<AuthorizedPersonErrors>({});
  const [activeTab, setActiveTab] = useState<GeneralInstitutionTab>("institution");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await getInstitutionSettings();
        if (cancelled) return;
        if (response) {
          setServerState(response);
          setValues(fromResponse(response));
        } else {
          setServerState(null);
          setValues(EMPTY_VALUES);
        }
      } catch (error) {
        if (cancelled) return;
        showToast(t("settings.general.toast.loadError"), "error");
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [showToast, t]);

  const dirty = useMemo(() => {
    if (!serverState) {
      return JSON.stringify(values) !== JSON.stringify(EMPTY_VALUES);
    }
    return JSON.stringify(values) !== JSON.stringify(fromResponse(serverState));
  }, [serverState, values]);

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

  const updateAuthorizedPerson = (
    clientId: string,
    field: "fullName" | "phone" | "title",
    value: string
  ) => {
    setValues((current) => ({
      ...current,
      authorizedPersons: current.authorizedPersons.map((person) =>
        person.clientId === clientId ? { ...person, [field]: value } : person
      ),
    }));
    setAuthorizedErrors((current) => {
      if (!current[clientId]?.[field]) return current;
      const nextPerson = { ...current[clientId] };
      delete nextPerson[field];
      return { ...current, [clientId]: nextPerson };
    });
  };

  const addAuthorizedPerson = () => {
    setValues((current) => ({
      ...current,
      authorizedPersons: [
        ...current.authorizedPersons,
        {
          clientId: newClientId(),
          serverId: null,
          fullName: "",
          phone: "",
          title: "",
        },
      ],
    }));
  };

  const removeAuthorizedPerson = (clientId: string) => {
    setValues((current) => ({
      ...current,
      authorizedPersons: current.authorizedPersons.filter((person) => person.clientId !== clientId),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const nextErrors: GeneralFormErrors = {};
    const nextAuthorizedErrors: AuthorizedPersonErrors = {};

    if (!values.institutionName.trim()) {
      nextErrors.institutionName = t("settings.general.validation.required");
    }
    if (!values.institutionOfficialName.trim()) {
      nextErrors.institutionOfficialName = t("settings.general.validation.required");
    }
    if (values.institutionEmail.trim() && !isValidEmail(values.institutionEmail.trim())) {
      nextErrors.institutionEmail = t("settings.general.validation.email");
    }
    if (values.institutionPhone.trim() && !isValidPhone(values.institutionPhone.trim())) {
      nextErrors.institutionPhone = t("settings.general.validation.phone");
    }
    if (values.city && !values.district) {
      nextErrors.district = t("settings.general.validation.districtRequired");
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
    if (values.founderPhone.trim() && !isValidPhone(values.founderPhone.trim())) {
      nextErrors.founderPhone = t("settings.general.validation.phone");
    }

    for (const person of values.authorizedPersons) {
      const personErrors: Partial<Record<"fullName" | "phone" | "title", string>> = {};
      if (!person.fullName.trim()) {
        personErrors.fullName = t("settings.general.validation.required");
      }
      if (person.phone.trim() && !isValidPhone(person.phone.trim())) {
        personErrors.phone = t("settings.general.validation.phone");
      }
      if (Object.keys(personErrors).length > 0) {
        nextAuthorizedErrors[person.clientId] = personErrors;
      }
    }

    setErrors(nextErrors);
    setAuthorizedErrors(nextAuthorizedErrors);
    if (Object.keys(nextErrors).length > 0 || Object.keys(nextAuthorizedErrors).length > 0) {
      if (
        nextErrors.institutionName ||
        nextErrors.institutionOfficialName ||
        nextErrors.institutionCode ||
        nextErrors.institutionPhone ||
        nextErrors.institutionEmail ||
        nextErrors.city ||
        nextErrors.district ||
        nextErrors.institutionAddress
      ) {
        setActiveTab("institution");
      } else if (
        nextErrors.founderName ||
        nextErrors.founderTaxId ||
        nextErrors.founderTaxOffice ||
        nextErrors.founderPhone ||
        nextErrors.founderAddress
      ) {
        setActiveTab("founder");
      } else {
        setActiveTab("authorized");
      }
      showToast(t("settings.general.validation.fixErrors"), "error");
      return;
    }

    setSaving(true);
    try {
      const request = toUpsertRequest(values, serverState?.rowVersion ?? null);
      const response = await upsertInstitutionSettings(request);
      setServerState(response);
      setValues(fromResponse(response));
      setErrors({});
      setAuthorizedErrors({});
      showToast(t("settings.general.toast.saved"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        showToast(t("settings.general.toast.concurrencyConflict"), "error");
        try {
          const fresh = await getInstitutionSettings();
          if (fresh) {
            setServerState(fresh);
            setValues(fromResponse(fresh));
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
    if (!file) return;

    setUploading(true);
    try {
      const response = await uploadInstitutionLogo(file, serverState?.rowVersion ?? null);
      setServerState(response);
      setValues((current) => ({ ...current })); // logo değişti ama form alanları aynı, dirty değişmesin
      showToast(t("settings.general.toast.logoUploaded"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        showToast(t("settings.general.toast.concurrencyConflict"), "error");
        const fresh = await getInstitutionSettings().catch(() => null);
        if (fresh) {
          setServerState(fresh);
          setValues(fromResponse(fresh));
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
    if (!serverState?.logo) return;
    setRemovingLogo(true);
    try {
      const response = await deleteInstitutionLogo(serverState.rowVersion);
      setServerState(response);
      showToast(t("settings.general.toast.logoRemoved"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        showToast(t("settings.general.toast.concurrencyConflict"), "error");
        const fresh = await getInstitutionSettings().catch(() => null);
        if (fresh) {
          setServerState(fresh);
          setValues(fromResponse(fresh));
        }
        return;
      }
      showToast(t("settings.general.toast.logoRemoveError"), "error");
    } finally {
      setRemovingLogo(false);
    }
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

  const logoUrl = serverState?.logo
    ? getInstitutionLogoUrl(serverState.logo, String(serverState.rowVersion))
    : null;
  const tabs: { key: GeneralInstitutionTab; label: string }[] = [
    { key: "institution", label: t("settings.general.section.institution") },
    { key: "founder", label: t("settings.general.section.founder") },
    { key: "authorized", label: t("settings.general.section.authorized") },
  ];

  if (loading) {
    return (
      <div className="settings-section-stack">
        <section className="settings-surface">
          <div className="settings-surface-body">{t("common.loading")}</div>
        </section>
      </div>
    );
  }

  return (
    <form className="settings-section-stack" onSubmit={handleSubmit}>
      <div className="settings-tab-toolbar">
        <PageTabs active={activeTab} onChange={setActiveTab} tabs={tabs} />
        <span className="settings-panel-note">
          {serverState
            ? t("settings.general.lastSaved", {
                at: new Date(serverState.updatedAtUtc).toLocaleString("tr-TR"),
              })
            : t("settings.general.notSavedYet")}
        </span>
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
                <label className="form-label">
                  {t("settings.general.field.institutionName")}
                </label>
                <input
                  className={errors.institutionName ? "form-input error" : "form-input"}
                  onChange={handleInput("institutionName")}
                  placeholder={t("settings.general.placeholder.institutionName")}
                  value={values.institutionName}
                />
                {errors.institutionName ? <div className="form-error">{errors.institutionName}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label">
                  {t("settings.general.field.institutionOfficialName")}
                </label>
                <input
                  className={errors.institutionOfficialName ? "form-input error" : "form-input"}
                  onChange={handleInput("institutionOfficialName")}
                  placeholder={t("settings.general.placeholder.institutionOfficialName")}
                  value={values.institutionOfficialName}
                />
                {errors.institutionOfficialName ? <div className="form-error">{errors.institutionOfficialName}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  {t("settings.general.field.institutionCode")}
                </label>
                <input
                  className={errors.institutionCode ? "form-input error" : "form-input"}
                  onChange={handleInput("institutionCode")}
                  placeholder={t("settings.general.placeholder.institutionCode")}
                  value={values.institutionCode}
                />
                {errors.institutionCode ? <div className="form-error">{errors.institutionCode}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label">{t("settings.general.field.phone")}</label>
                <input
                  className={errors.institutionPhone ? "form-input error" : "form-input"}
                  onChange={handleInput("institutionPhone")}
                  placeholder={t("settings.general.placeholder.phone")}
                  value={values.institutionPhone}
                />
                {errors.institutionPhone ? <div className="form-error">{errors.institutionPhone}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("settings.general.field.email")}</label>
                <input
                  className={errors.institutionEmail ? "form-input error" : "form-input"}
                  onChange={handleInput("institutionEmail")}
                  placeholder={t("settings.general.placeholder.email")}
                  type="email"
                  value={values.institutionEmail}
                />
                {errors.institutionEmail ? <div className="form-error">{errors.institutionEmail}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label">{t("settings.general.field.city")}</label>
                <CustomSelect
                  aria-label={t("settings.general.field.city")}
                  className={errors.city ? "form-select error" : "form-select"}
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
                <label className="form-label">{t("settings.general.field.district")}</label>
                <CustomSelect
                  aria-label={t("settings.general.field.district")}
                  className={errors.district ? "form-select error" : "form-select"}
                  disabled={!values.city}
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
              <div className="form-group" />
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">
                  {t("settings.general.field.institutionAddress")}
                </label>
                <textarea
                  className={errors.institutionAddress ? "form-input error" : "form-input"}
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
                <label className="form-label">{t("settings.general.field.logo")}</label>
                <div className="settings-logo-row">
                  <div className="settings-logo-preview">
                    {logoUrl ? (
                      <img alt={t("settings.general.field.logo")} src={logoUrl} />
                    ) : (
                      <span className="settings-logo-empty">
                        {t("settings.general.logo.empty")}
                      </span>
                    )}
                  </div>
                  <div className="settings-logo-actions">
                    <input
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      hidden
                      onChange={handleLogoChange}
                      ref={fileInputRef}
                      type="file"
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={uploading || removingLogo}
                      onClick={() => fileInputRef.current?.click()}
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
                        disabled={uploading || removingLogo}
                        onClick={handleLogoRemove}
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
                <label className="form-label">{t("settings.general.founder.type")}</label>
                <CustomSelect
                  aria-label={t("settings.general.founder.type")}
                  className="form-select"
                  onChange={handleFounderTypeChange}
                  value={values.founderType}
                >
                  <option value="real">{t("settings.general.founder.type.real")}</option>
                  <option value="legal">{t("settings.general.founder.type.legal")}</option>
                </CustomSelect>
              </div>
              <div className="form-group">
                <label className="form-label">{t(founderNameLabelKey)}</label>
                <input
                  className={errors.founderName ? "form-input error" : "form-input"}
                  onChange={handleInput("founderName")}
                  placeholder={t("settings.general.placeholder.founderName")}
                  value={values.founderName}
                />
                {errors.founderName ? <div className="form-error">{errors.founderName}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t(founderTaxIdLabelKey)}</label>
                <input
                  className={errors.founderTaxId ? "form-input error" : "form-input"}
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
                <label className="form-label">
                  {t("settings.general.founder.taxOffice")}
                </label>
                <input
                  className={errors.founderTaxOffice ? "form-input error" : "form-input"}
                  onChange={handleInput("founderTaxOffice")}
                  placeholder={t("settings.general.placeholder.taxOffice")}
                  value={values.founderTaxOffice}
                />
                {errors.founderTaxOffice ? <div className="form-error">{errors.founderTaxOffice}</div> : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("settings.general.founder.phone")}</label>
                <input
                  className={errors.founderPhone ? "form-input error" : "form-input"}
                  onChange={handleInput("founderPhone")}
                  placeholder={t("settings.general.placeholder.phone")}
                  value={values.founderPhone}
                />
                {errors.founderPhone ? <div className="form-error">{errors.founderPhone}</div> : null}
              </div>
              <div className="form-group" />
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">{t("settings.general.founder.address")}</label>
                <textarea
                  className={errors.founderAddress ? "form-input error" : "form-input"}
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

      {activeTab === "authorized" ? (
      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">
            {t("settings.general.section.authorized")}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={addAuthorizedPerson}
            type="button"
          >
            {t("settings.general.authorized.add")}
          </button>
        </div>
        <div className="settings-surface-body">
          {values.authorizedPersons.length === 0 ? (
            <div className="settings-panel-note">
              {t("settings.general.authorized.empty")}
            </div>
          ) : (
            <div className="settings-form">
              {values.authorizedPersons.map((person, index) => (
                <div className="form-row" key={person.clientId}>
                  <div className="form-group">
                    <label className="form-label">
                      {t("settings.general.authorized.fullName")} #{index + 1}
                    </label>
                    <input
                      className={authorizedErrors[person.clientId]?.fullName ? "form-input error" : "form-input"}
                      onChange={(event) =>
                        updateAuthorizedPerson(person.clientId, "fullName", event.target.value)
                      }
                      placeholder={t("settings.general.placeholder.authorizedName")}
                      value={person.fullName}
                    />
                    {authorizedErrors[person.clientId]?.fullName ? (
                      <div className="form-error">{authorizedErrors[person.clientId]?.fullName}</div>
                    ) : null}
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      {t("settings.general.authorized.title")}
                    </label>
                    <input
                      className={authorizedErrors[person.clientId]?.title ? "form-input error" : "form-input"}
                      onChange={(event) =>
                        updateAuthorizedPerson(person.clientId, "title", event.target.value)
                      }
                      placeholder={t("settings.general.placeholder.authorizedTitle")}
                      value={person.title}
                    />
                    {authorizedErrors[person.clientId]?.title ? (
                      <div className="form-error">{authorizedErrors[person.clientId]?.title}</div>
                    ) : null}
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      {t("settings.general.authorized.phone")}
                    </label>
                    <input
                      className={authorizedErrors[person.clientId]?.phone ? "form-input error" : "form-input"}
                      onChange={(event) =>
                        updateAuthorizedPerson(person.clientId, "phone", event.target.value)
                      }
                      placeholder={t("settings.general.placeholder.phone")}
                      value={person.phone}
                    />
                    {authorizedErrors[person.clientId]?.phone ? (
                      <div className="form-error">{authorizedErrors[person.clientId]?.phone}</div>
                    ) : null}
                  </div>
                  <div className="form-group settings-authorized-remove">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => removeAuthorizedPerson(person.clientId)}
                      type="button"
                    >
                      {t("settings.general.authorized.remove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      ) : null}

      <div className="settings-form-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || saving || uploading || removingLogo}
          type="submit"
        >
          {saving ? t("settings.toolbar.saving") : t("settings.toolbar.save")}
        </button>
      </div>
    </form>
  );
}
