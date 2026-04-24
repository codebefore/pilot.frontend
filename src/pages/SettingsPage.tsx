import { useMemo, useState, type ChangeEvent } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { VehiclesSettingsSection } from "../components/settings/VehiclesSettingsSection";
import { CustomSelect } from "../components/ui/CustomSelect";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";

type InstitutionType = "MTSK" | "ISMAK" | "SRC" | "PSI";
type ConnectionStatus = "connected" | "attention";
type CityOption = "Istanbul" | "Ankara" | "Izmir" | "Bursa" | "Kocaeli" | "Antalya";
type SettingsSectionKey = "general" | "integrations" | "vehicles";

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
  label: string;
  description: string;
  to?: string;
  badge?: string;
};

type SettingsNavGroup = {
  title: string;
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

const INSTITUTION_TYPE_LABEL: Record<InstitutionType, string> = {
  MTSK: "MTSK - Surucu Kursu",
  ISMAK: "Is Makinesi",
  SRC: "SRC",
  PSI: "Psikoteknik",
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
    title: "Kurum",
    items: [
      {
        label: "Genel",
        description: "Kurum bilgileri, yetkili ve iletisim",
        to: "/settings/general",
      },
      {
        label: "Entegrasyonlar",
        description: "MEB baglantisi ve senkron ayarlari",
        to: "/settings/integrations",
      },
    ],
  },
  {
    title: "Tanimlar",
    items: [
      {
        label: "Araclar",
        description: "Uygulama ve planlama araclari",
        to: "/settings/definitions/vehicles",
      },
      {
        label: "Egitmenler",
        description: "Uygulama hoca ve atama havuzu",
        badge: "Yakinda",
      },
      {
        label: "Guzergahlar",
        description: "Sinav ve ders guzergah tanimlari",
        badge: "Yakinda",
      },
      {
        label: "Alanlar",
        description: "Sinif, saha ve operasyon alanlari",
        badge: "Yakinda",
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
  return (
    <div className="settings-section-stack">
      <div className="settings-summary-grid">
        <div className="settings-summary-card">
          <span className="settings-summary-label">Kurum Tipi</span>
          <strong className="settings-summary-value">
            {INSTITUTION_TYPE_LABEL[values.institutionType]}
          </strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">Yetkili Kisi</span>
          <strong className="settings-summary-value">{values.authorizedPerson}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">Konum</span>
          <strong className="settings-summary-value">
            {values.city} / {values.district}
          </strong>
        </div>
      </div>

      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">Kurum Bilgileri</div>
          <span className="settings-panel-note">Son kayit: {formatTimestamp(lastSavedAt)}</span>
        </div>

        <div className="settings-surface-body">
          <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kurum Adi</label>
                <input
                  className="form-input"
                  onChange={onInputChange("institutionName")}
                  value={values.institutionName}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kurum Tipi</label>
                <CustomSelect
                  aria-label="Kurum Tipi"
                  className="form-select"
                  onChange={onInputChange("institutionType")}
                  value={values.institutionType}
                >
                  <option value="MTSK">MTSK - Surucu Kursu</option>
                  <option value="ISMAK">Is Makinesi</option>
                  <option value="SRC">SRC</option>
                  <option value="PSI">Psikoteknik</option>
                </CustomSelect>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Yetkili Kisi</label>
                <input
                  className="form-input"
                  onChange={onInputChange("authorizedPerson")}
                  value={values.authorizedPerson}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Telefon</label>
                <input className="form-input" onChange={onInputChange("phone")} value={values.phone} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">E-posta</label>
                <input
                  className="form-input"
                  onChange={onInputChange("email")}
                  type="email"
                  value={values.email}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ilce</label>
                <input
                  className="form-input"
                  onChange={onInputChange("district")}
                  value={values.district}
                />
              </div>
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">Sehir</label>
                <CustomSelect
                  aria-label="Sehir"
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
  return (
    <div className="settings-section-stack">
      <div className="settings-summary-grid">
        <div className="settings-summary-card">
          <span className="settings-summary-label">MEB Durumu</span>
          <strong className="settings-summary-value">
            {connectionStatus === "connected" ? "Baglanti Aktif" : "Kontrol Gerekli"}
          </strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">Son Kontrol</span>
          <strong className="settings-summary-value">{formatTimestamp(lastCheckedAt)}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">Senkron</span>
          <strong className="settings-summary-value">
            {values.syncEnabled ? "Otomatik Acik" : "Manuel"}
          </strong>
        </div>
      </div>

      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">MEB Baglantisi</div>
          <StatusPill
            label={connectionStatus === "connected" ? "Aktif" : "Kontrol Gerekli"}
            status={connectionStatus === "connected" ? "success" : "manual"}
          />
        </div>

        <div className="settings-surface-body">
          <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
            <div className="settings-connection-card">
              <div className="settings-connection-copy">
                <strong className="settings-connection-title">
                  {connectionStatus === "connected"
                    ? "Baglanti su anda hazir"
                    : "Baglanti bilgilerini kontrol et"}
                </strong>
                <span className="settings-connection-meta">
                  Son kontrol: {formatTimestamp(lastCheckedAt)}
                </span>
              </div>
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">MEBBIS Kullanici Adi</label>
                <input
                  className="form-input"
                  onChange={onInputChange("mebbisUsername")}
                  value={values.mebbisUsername}
                />
              </div>
            </div>

            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">MEBBIS Sifre</label>
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
                  <div className="form-subsection-title">Senkron Ayarlari</div>
                  <div className="form-subsection-note">
                    Gecelik kontrol ve hata tekrar denemesi ayarlari.
                  </div>
                </div>
              </div>

              <div className="settings-checkbox-list">
                <label className="form-checkbox">
                  <input checked={values.syncEnabled} onChange={onInputChange("syncEnabled")} type="checkbox" />
                  <span>Otomatik senkron acik</span>
                </label>

                <label className="form-checkbox">
                  <input
                    checked={values.retryEnabled}
                    onChange={onInputChange("retryEnabled")}
                    type="checkbox"
                  />
                  <span>Hata durumunda otomatik tekrar dene</span>
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
        showToast("MEB baglantisi icin kullanici adi ve sifre gerekli", "error");
        return;
      }

      const now = new Date();
      setConnectionStatus("connected");
      setLastCheckedAt(now);
      showToast("MEB baglantisi kontrol edildi");
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
      showToast("Ayarlar kaydedildi");
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
          {testingConnection ? "Kontrol Ediliyor..." : "Baglantiyi Test Et"}
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || submitting}
          onClick={handleSave}
          type="button"
        >
          {submitting ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </>
    ) : activeSection === "general" ? (
      <button
        className="btn btn-primary btn-sm"
        disabled={!dirty || submitting}
        onClick={handleSave}
        type="button"
      >
        {submitting ? "Kaydediliyor..." : "Kaydet"}
      </button>
    ) : undefined;

  return (
    <>
      <PageToolbar actions={toolbarActions} title="Kurum Ayarlari" />

      <div className="settings-page">
        <div className="settings-shell">
          <aside className="settings-nav">
            <div className="settings-nav-groups">
              {SETTINGS_NAV_GROUPS.map((group) => (
                <section className="settings-nav-group" key={group.title}>
                  <div className="settings-nav-group-title">{group.title}</div>

                  <div className="settings-nav-list">
                    {group.items.map((item) =>
                      item.to ? (
                        <NavLink
                          className={({ isActive }) =>
                            isActive ? "settings-nav-link active" : "settings-nav-link"
                          }
                          end
                          key={item.label}
                          to={item.to}
                        >
                          <span className="settings-nav-link-copy">
                            <strong className="settings-nav-link-title">{item.label}</strong>
                            <span className="settings-nav-link-description">
                              {item.description}
                            </span>
                          </span>
                        </NavLink>
                      ) : (
                        <div
                          aria-disabled="true"
                          className="settings-nav-link settings-nav-link-disabled"
                          key={item.label}
                        >
                          <span className="settings-nav-link-copy">
                            <strong className="settings-nav-link-title">{item.label}</strong>
                            <span className="settings-nav-link-description">
                              {item.description}
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
              <Route element={<VehiclesSettingsSection />} path="definitions/vehicles" />
              <Route element={<Navigate replace to="general" />} path="*" />
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
}
