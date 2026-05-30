import { useEffect, useState, type FormEvent } from "react";

import {
  getInstitutionIntegrations,
  upsertInstitutionIntegrations,
  type InstitutionIntegrationsResponse,
} from "../../lib/institution-settings-api";
import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import { canManageArea } from "../../lib/permissions";
import { EyeIcon, EyeOffIcon } from "../icons";
import { useToast } from "../ui/Toast";

export function IntegrationsSettingsSection() {
  const t = useT();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageSettings = canManageArea(user, permissions, "settings");
  const noPermissionTitle = "Yetkiniz yok.";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<InstitutionIntegrationsResponse | null>(null);
  const [ocrApiKey, setOcrApiKey] = useState("");
  const [showOcrApiKey, setShowOcrApiKey] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getInstitutionIntegrations(controller.signal)
      .then((response) => {
        setState(response);
        setOcrApiKey(response.ocrApiKey ?? "");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("settings.integrations.toast.loadError"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [showToast, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageSettings) return;
    if (saving || !ocrApiKey.trim()) return;

    setSaving(true);
    try {
      const response = await upsertInstitutionIntegrations({
        ocrApiKey: ocrApiKey.trim(),
        clearOcrApiKey: false,
        rowVersion: state?.rowVersion ?? null,
      });
      setState(response);
      setOcrApiKey(response.ocrApiKey ?? "");
      showToast(t("settings.integrations.toast.saved"));
    } catch {
      showToast(t("settings.integrations.toast.saveError"), "error");
    } finally {
      setSaving(false);
    }
  };

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
      <section className="settings-surface">
        <div className="settings-surface-header">
          <h2 className="settings-surface-title">
            {t("settings.integrations.title")}
          </h2>
        </div>

        <div className="settings-surface-body">
          <div className="settings-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="ocr-api-key">
                  OCR Api key
                </label>
                <div className="settings-secret-input">
                  <input
                    autoComplete="off"
                    className="form-input"
                    disabled={!canManageSettings}
                    id="ocr-api-key"
                    onChange={(event) => setOcrApiKey(event.target.value)}
                    placeholder={
                      state?.hasOcrApiKey
                        ? t("settings.integrations.ocrApiKey.placeholder.replace")
                        : t("settings.integrations.ocrApiKey.placeholder.new")
                    }
                    type={showOcrApiKey ? "text" : "password"}
                    value={ocrApiKey}
                  />
                  <button
                    aria-label={
                      showOcrApiKey
                        ? t("settings.integrations.ocrApiKey.hide")
                        : t("settings.integrations.ocrApiKey.show")
                    }
                    className="settings-secret-toggle"
                    disabled={!ocrApiKey}
                    onClick={() => setShowOcrApiKey((current) => !current)}
                    title={
                      showOcrApiKey
                        ? t("settings.integrations.ocrApiKey.hide")
                        : t("settings.integrations.ocrApiKey.show")
                    }
                    type="button"
                  >
                    {showOcrApiKey ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                </div>
              </div>
              <div className="form-group" />
            </div>
          </div>
        </div>
      </section>

      <div className="settings-form-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={!canManageSettings || saving || !ocrApiKey.trim()}
          title={!canManageSettings ? noPermissionTitle : undefined}
          type="submit"
        >
          {saving ? t("settings.toolbar.saving") : t("settings.toolbar.save")}
        </button>
      </div>
    </form>
  );
}
