import { useMemo, useState, type ChangeEvent } from "react";

import { PageToolbar } from "../components/layout/PageToolbar";
import { CustomSelect } from "../components/ui/CustomSelect";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";

type InstitutionType = "MTSK" | "ISMAK" | "SRC" | "PSI";
type ConnectionStatus = "connected" | "attention";
type CityOption = "Istanbul" | "Ankara" | "Izmir" | "Bursa" | "Kocaeli" | "Antalya";

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

export function SettingsPage() {
  const { showToast } = useToast();

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

  const handleInputChange =
    (field: keyof SettingsFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  return (
    <>
      <PageToolbar
        actions={
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
        }
        title="Kurum Ayarlari"
      />

      <div className="settings-page">
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
            <span className="settings-summary-label">MEB Durumu</span>
            <strong className="settings-summary-value">
              {connectionStatus === "connected" ? "Baglanti Aktif" : "Kontrol Gerekli"}
            </strong>
            <span className="settings-summary-meta">
              Son kontrol: {formatTimestamp(lastCheckedAt)}
            </span>
          </div>
        </div>

        <div className="settings-layout">
          <Panel
            action={
              <span className="settings-panel-note">
                Son kayit: {formatTimestamp(lastSavedAt)}
              </span>
            }
            padded
            title="Kurum Bilgileri"
          >
            <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Kurum Adi</label>
                  <input
                    className="form-input"
                    onChange={handleInputChange("institutionName")}
                    value={values.institutionName}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Kurum Tipi</label>
                  <CustomSelect
                    aria-label="Kurum Tipi"
                    className="form-select"
                    onChange={handleInputChange("institutionType")}
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
                    onChange={handleInputChange("authorizedPerson")}
                    value={values.authorizedPerson}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input
                    className="form-input"
                    onChange={handleInputChange("phone")}
                    value={values.phone}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">E-posta</label>
                  <input
                    className="form-input"
                    onChange={handleInputChange("email")}
                    type="email"
                    value={values.email}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Ilce</label>
                  <input
                    className="form-input"
                    onChange={handleInputChange("district")}
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
                    onChange={handleInputChange("city")}
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
          </Panel>

          <Panel
            action={
              <StatusPill
                label={connectionStatus === "connected" ? "Aktif" : "Kontrol Gerekli"}
                status={connectionStatus === "connected" ? "success" : "manual"}
              />
            }
            padded
            title="MEB Baglantisi"
          >
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
                    onChange={handleInputChange("mebbisUsername")}
                    value={values.mebbisUsername}
                  />
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">MEBBIS Sifre</label>
                  <input
                    className="form-input"
                    onChange={handleInputChange("mebbisPassword")}
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
                    <input
                      checked={values.syncEnabled}
                      onChange={handleInputChange("syncEnabled")}
                      type="checkbox"
                    />
                    <span>Otomatik senkron acik</span>
                  </label>

                  <label className="form-checkbox">
                    <input
                      checked={values.retryEnabled}
                      onChange={handleInputChange("retryEnabled")}
                      type="checkbox"
                    />
                    <span>Hata durumunda otomatik tekrar dene</span>
                  </label>
                </div>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
