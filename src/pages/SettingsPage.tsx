import { useMemo, useState, type ChangeEvent } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { AreasSettingsSection } from "../components/settings/AreasSettingsSection";
import { InstructorsSettingsSection } from "../components/settings/InstructorsSettingsSection";
import { LicenseClassDefinitionsSettingsSection } from "../components/settings/LicenseClassDefinitionsSettingsSection";
import { RoutesSettingsSection } from "../components/settings/RoutesSettingsSection";
import { VehiclesSettingsSection } from "../components/settings/VehiclesSettingsSection";
import { CustomSelect } from "../components/ui/CustomSelect";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { useT, type TranslationKey } from "../lib/i18n";

type InstitutionType = "MTSK" | "ISMAK" | "SRC" | "PSI";
type ConnectionStatus = "connected" | "attention";
type CityOption = "Istanbul" | "Ankara" | "Izmir" | "Bursa" | "Kocaeli" | "Antalya";
type SettingsSectionKey =
  | "general"
  | "integrations"
  | "vehicles"
  | "instructors"
  | "licenseClasses"
  | "routes"
  | "areas";

type SettingsFormValues = {
  institutionName: string;
  institutionType: InstitutionType;
  authorizedPerson: string;
  phone: string;
  email: string;
  city: CityOption;
  district: string;
  mebbisUsername: string;
  mebbisPassword: string;
  syncEnabled: boolean;
  retryEnabled: boolean;
};

type SettingsNavItem = {
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  to?: string;
  badge?: string;
};

type SettingsNavGroup = {
  titleKey: TranslationKey;
  items: SettingsNavItem[];
};

type SettingsFormInputHandler = (
  field: keyof SettingsFormValues
) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

type GeneralSettingsSectionProps = {
  values: SettingsFormValues;
  lastSavedAt: Date;
  onInputChange: SettingsFormInputHandler;
};

type IntegrationSettingsSectionProps = {
  values: SettingsFormValues;
  connectionStatus: ConnectionStatus;
  lastCheckedAt: Date;
  onInputChange: SettingsFormInputHandler;
};

const INITIAL_VALUES: SettingsFormValues = {
  institutionName: "Sezer Surucu Kursu",
  institutionType: "MTSK",
  authorizedPerson: "Mehmet Sezer",
  phone: "0532 123 45 67",
  email: "iletisim@sezersurucu.com",
  city: "Istanbul",
  district: "Umraniye",
  mebbisUsername: "sezer_mtsk",
  mebbisPassword: "super-secret",
  syncEnabled: true,
  retryEnabled: true,
};

const INSTITUTION_TYPE_LABEL_KEY: Record<InstitutionType, TranslationKey> = {
  MTSK: "settings.institutionType.MTSK",
  ISMAK: "settings.institutionType.ISMAK",
  SRC: "settings.institutionType.SRC",
  PSI: "settings.institutionType.PSI",
};

const CITY_OPTIONS: { value: CityOption; label: string }[] = [
  { value: "Istanbul", label: "Istanbul" },
  { value: "Ankara", label: "Ankara" },
  { value: "Izmir", label: "Izmir" },
  { value: "Bursa", label: "Bursa" },
  { value: "Kocaeli", label: "Kocaeli" },
  { value: "Antalya", label: "Antalya" },
];

const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    titleKey: "settings.nav.group.institution",
    items: [
      {
        labelKey: "settings.nav.general.label",
        descriptionKey: "settings.nav.general.description",
        to: "/settings/general",
      },
      {
        labelKey: "settings.nav.integrations.label",
        descriptionKey: "settings.nav.integrations.description",
        to: "/settings/integrations",
      },
    ],
  },
  {
    titleKey: "settings.nav.group.definitions",
    items: [
      {
        labelKey: "settings.nav.licenseClasses.label",
        descriptionKey: "settings.nav.licenseClasses.description",
        to: "/settings/definitions/license-classes",
      },
      {
        labelKey: "settings.nav.vehicles.label",
        descriptionKey: "settings.nav.vehicles.description",
        to: "/settings/definitions/vehicles",
      },
      {
        labelKey: "settings.nav.instructors.label",
        descriptionKey: "settings.nav.instructors.description",
        to: "/settings/definitions/instructors",
      },
      {
        labelKey: "settings.nav.routes.label",
        descriptionKey: "settings.nav.routes.description",
        to: "/settings/definitions/routes",
      },
      {
        labelKey: "settings.nav.areas.label",
        descriptionKey: "settings.nav.areas.description",
        to: "/settings/definitions/areas",
      },
    ],
  },
];

function formatTimestamp(value: Date): string {
  return value.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSettingsDirty(current: SettingsFormValues, saved: SettingsFormValues): boolean {
  return (Object.keys(current) as Array<keyof SettingsFormValues>).some(
    (key) => current[key] !== saved[key]
  );
}

function getActiveSection(pathname: string): SettingsSectionKey {
  if (pathname.includes("/settings/definitions/license-classes")) {
    return "licenseClasses";
  }

  if (pathname.includes("/settings/definitions/areas")) {
    return "areas";
  }

  if (pathname.includes("/settings/definitions/routes")) {
    return "routes";
  }

  if (pathname.includes("/settings/definitions/instructors")) {
    return "instructors";
  }

  if (pathname.includes("/settings/definitions/vehicles")) {
    return "vehicles";
  }

  if (pathname.includes("/settings/integrations")) {
    return "integrations";
  }

  return "general";
}

function GeneralSettingsSection({
  values,
  lastSavedAt,
  onInputChange,
}: GeneralSettingsSectionProps) {
  const t = useT();
  return (
    <div className="settings-section-stack">
      <div className="settings-summary-grid">
        <div className="settings-summary-card">
          <span className="settings-summary-label">{t("settings.general.summary.institutionType")}</span>
          <strong className="settings-summary-value">
            {t(INSTITUTION_TYPE_LABEL_KEY[values.institutionType])}
          </strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">{t("settings.general.summary.authorizedPerson")}</span>
          <strong className="settings-summary-value">{values.authorizedPerson}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">{t("settings.general.summary.location")}</span>
          <strong className="settings-summary-value">
            {values.city} / {values.district}
          </strong>
        </div>
      </div>

      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">{t("settings.general.surface.title")}</div>
          <span className="settings-panel-note">
            {t("settings.general.lastSaved", { at: formatTimestamp(lastSavedAt) })}
          </span>
        </div>

        <div className="settings-surface-body">
          <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("settings.general.field.institutionName")}</label>
                <input
                  className="form-input"
                  onChange={onInputChange("institutionName")}
                  value={values.institutionName}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t("settings.general.field.institutionType")}</label>
                <CustomSelect
                  aria-label={t("settings.general.field.institutionType")}
                  className="form-select"
                  onChange={onInputChange("institutionType")}
                  value={values.institutionType}
                >
                  <option value="MTSK">{t("settings.institutionType.MTSK")}</option>
                  <option value="ISMAK">{t("settings.institutionType.ISMAK")}</option>
                  <option value="SRC">{t("settings.institutionType.SRC")}</option>
                  <option value="PSI">{t("settings.institutionType.PSI")}</option>
                </CustomSelect>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("settings.general.field.authorizedPerson")}</label>
                <input
                  className="form-input"
                  onChange={onInputChange("authorizedPerson")}
                  value={values.authorizedPerson}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t("settings.general.field.phone")}</label>
                <input className="form-input" onChange={onInputChange("phone")} value={values.phone} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("settings.general.field.email")}</label>
                <input
                  className="form-input"
                  onChange={onInputChange("email")}
                  type="email"
                  value={values.email}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t("settings.general.field.district")}</label>
                <input
                  className="form-input"
                  onChange={onInputChange("district")}
                  value={values.district}
                />
              </div>
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">{t("settings.general.field.city")}</label>
                <CustomSelect
                  aria-label={t("settings.general.field.city")}
                  className="form-select"
                  onChange={onInputChange("city")}
                  value={values.city}
                >
                  {CITY_OPTIONS.map((city) => (
                    <option key={city.value} value={city.value}>
                      {city.label}
                    </option>
                  ))}
                </CustomSelect>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function IntegrationSettingsSection({
  values,
  connectionStatus,
  lastCheckedAt,
  onInputChange,
}: IntegrationSettingsSectionProps) {
  const t = useT();
  return (
    <div className="settings-section-stack">
      <div className="settings-summary-grid">
        <div className="settings-summary-card">
          <span className="settings-summary-label">{t("settings.integration.summary.mebStatus")}</span>
          <strong className="settings-summary-value">
            {connectionStatus === "connected"
              ? t("settings.integration.status.connected")
              : t("settings.integration.status.attention")}
          </strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">{t("settings.integration.summary.lastChecked")}</span>
          <strong className="settings-summary-value">{formatTimestamp(lastCheckedAt)}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">{t("settings.integration.summary.sync")}</span>
          <strong className="settings-summary-value">
            {values.syncEnabled
              ? t("settings.integration.sync.auto")
              : t("settings.integration.sync.manual")}
          </strong>
        </div>
      </div>

      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">{t("settings.integration.surface.title")}</div>
          <StatusPill
            label={
              connectionStatus === "connected"
                ? t("settings.integration.status.shortConnected")
                : t("settings.integration.status.shortAttention")
            }
            status={connectionStatus === "connected" ? "success" : "manual"}
          />
        </div>

        <div className="settings-surface-body">
          <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
            <div className="settings-connection-card">
              <div className="settings-connection-copy">
                <strong className="settings-connection-title">
                  {connectionStatus === "connected"
                    ? t("settings.integration.connection.readyTitle")
                    : t("settings.integration.connection.checkTitle")}
                </strong>
                <span className="settings-connection-meta">
                  {t("settings.integration.connection.lastCheckedMeta", {
                    at: formatTimestamp(lastCheckedAt),
                  })}
                </span>
              </div>
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">{t("settings.integration.field.mebbisUsername")}</label>
                <input
                  className="form-input"
                  onChange={onInputChange("mebbisUsername")}
                  value={values.mebbisUsername}
                />
              </div>
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">{t("settings.integration.field.mebbisPassword")}</label>
                <input
                  className="form-input"
                  onChange={onInputChange("mebbisPassword")}
                  type="password"
                  value={values.mebbisPassword}
                />
              </div>
            </div>

            <div className="form-subsection">
              <div className="form-subsection-header">
                <div>
                  <div className="form-subsection-title">{t("settings.integration.subsection.title")}</div>
                  <div className="form-subsection-note">
                    {t("settings.integration.subsection.note")}
                  </div>
                </div>
              </div>

              <div className="settings-checkbox-list">
                <label className="switch-toggle">
                  <input checked={values.syncEnabled} onChange={onInputChange("syncEnabled")} type="checkbox" />
                  <span className="switch-toggle-control" aria-hidden="true" />
                  <span>{t("settings.integration.toggle.autoSync")}</span>
                </label>

                <label className="switch-toggle">
                  <input
                    checked={values.retryEnabled}
                    onChange={onInputChange("retryEnabled")}
                    type="checkbox"
                  />
                  <span className="switch-toggle-control" aria-hidden="true" />
                  <span>{t("settings.integration.toggle.autoRetry")}</span>
                </label>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const { showToast } = useToast();
  const location = useLocation();
  const t = useT();

  const [values, setValues] = useState<SettingsFormValues>(INITIAL_VALUES);
  const [savedValues, setSavedValues] = useState<SettingsFormValues>(INITIAL_VALUES);
  const [submitting, setSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(
    () => new Date("2026-04-07T14:00:00")
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date>(
    () => new Date("2026-04-07T14:05:00")
  );

  const dirty = useMemo(() => isSettingsDirty(values, savedValues), [savedValues, values]);
  const activeSection = getActiveSection(location.pathname);

  const handleInputChange: SettingsFormInputHandler =
    (field) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const nextValue =
        event.target instanceof HTMLInputElement && event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;

      setValues((current) => ({
        ...current,
        [field]: nextValue as SettingsFormValues[typeof field],
      }));
    };

  const handleTestConnection = async () => {
    setTestingConnection(true);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 350));

      if (!values.mebbisUsername.trim() || !values.mebbisPassword.trim()) {
        setConnectionStatus("attention");
        showToast(t("settings.integration.toast.credentialsRequired"), "error");
        return;
      }

      const now = new Date();
      setConnectionStatus("connected");
      setLastCheckedAt(now);
      showToast(t("settings.integration.toast.connectionChecked"));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async () => {
    setSubmitting(true);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const now = new Date();
      setSavedValues(values);
      setLastSavedAt(now);
      showToast(t("settings.toast.saved"));
    } finally {
      setSubmitting(false);
    }
  };

  const toolbarActions =
    activeSection === "integrations" ? (
      <>
        <button
          className="btn btn-secondary btn-sm"
          disabled={testingConnection || submitting}
          onClick={handleTestConnection}
          type="button"
        >
          {testingConnection ? t("settings.toolbar.testing") : t("settings.toolbar.testConnection")}
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || submitting}
          onClick={handleSave}
          type="button"
        >
          {submitting ? t("settings.toolbar.saving") : t("settings.toolbar.save")}
        </button>
      </>
    ) : activeSection === "general" ? (
      <button
        className="btn btn-primary btn-sm"
        disabled={!dirty || submitting}
        onClick={handleSave}
        type="button"
      >
        {submitting ? t("settings.toolbar.saving") : t("settings.toolbar.save")}
      </button>
    ) : undefined;

  return (
    <>
      <PageToolbar actions={toolbarActions} title={t("settings.title")} />

      <div className="settings-page">
        <div className="settings-shell">
          <aside className="settings-nav">
            <div className="settings-nav-groups">
              {SETTINGS_NAV_GROUPS.map((group) => (
                <section className="settings-nav-group" key={group.titleKey}>
                  <div className="settings-nav-group-title">{t(group.titleKey)}</div>

                  <div className="settings-nav-list">
                    {group.items.map((item) =>
                      item.to ? (
                        <NavLink
                          className={({ isActive }) =>
                            isActive ? "settings-nav-link active" : "settings-nav-link"
                          }
                          end
                          key={item.labelKey}
                          to={item.to}
                        >
                          <span className="settings-nav-link-copy">
                            <strong className="settings-nav-link-title">{t(item.labelKey)}</strong>
                            <span className="settings-nav-link-description">
                              {t(item.descriptionKey)}
                            </span>
                          </span>
                        </NavLink>
                      ) : (
                        <div
                          aria-disabled="true"
                          className="settings-nav-link settings-nav-link-disabled"
                          key={item.labelKey}
                        >
                          <span className="settings-nav-link-copy">
                            <strong className="settings-nav-link-title">{t(item.labelKey)}</strong>
                            <span className="settings-nav-link-description">
                              {t(item.descriptionKey)}
                            </span>
                          </span>
                          {item.badge ? (
                            <span className="settings-nav-link-badge">{item.badge}</span>
                          ) : null}
                        </div>
                      )
                    )}
                  </div>
                </section>
              ))}
            </div>
          </aside>

          <div className="settings-content">
            <Routes>
              <Route index element={<Navigate replace to="general" />} />
              <Route
                element={
                  <GeneralSettingsSection
                    lastSavedAt={lastSavedAt}
                    onInputChange={handleInputChange}
                    values={values}
                  />
                }
                path="general"
              />
              <Route
                element={
                  <IntegrationSettingsSection
                    connectionStatus={connectionStatus}
                    lastCheckedAt={lastCheckedAt}
                    onInputChange={handleInputChange}
                    values={values}
                  />
                }
                path="integrations"
              />
              <Route element={<Navigate replace to="vehicles" />} path="definitions" />
              <Route
                element={<LicenseClassDefinitionsSettingsSection />}
                path="definitions/license-classes"
              />
              <Route element={<VehiclesSettingsSection />} path="definitions/vehicles" />
              <Route element={<InstructorsSettingsSection />} path="definitions/instructors" />
              <Route element={<RoutesSettingsSection />} path="definitions/routes" />
              <Route element={<AreasSettingsSection />} path="definitions/areas" />
              <Route element={<Navigate replace to="general" />} path="*" />
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
}
