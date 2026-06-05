import { useEffect, useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getInstitutionIntegrations,
  getWhatsAppStatus,
  upsertInstitutionIntegrations,
  type InstitutionIntegrationsResponse,
  type WhatsAppStatusResponse,
} from "../../lib/institution-settings-api";
import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import { canManageArea } from "../../lib/permissions";
import { EyeIcon, EyeOffIcon } from "../icons";
import { SettingsFormSkeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";

type IntegrationTab = "ocr" | "whatsapp";

export function IntegrationsSettingsSection() {
  const t = useT();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const whatsAppAccessTokenId = useId();
  const canManageSettings = canManageArea(user, permissions, "settings");
  const noPermissionTitle = t("common.noPermission");

  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<InstitutionIntegrationsResponse | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<IntegrationTab>("ocr");
  const [ocrApiKey, setOcrApiKey] = useState("");
  const [showOcrApiKey, setShowOcrApiKey] = useState(false);
  const [whatsAppAccessToken, setWhatsAppAccessToken] = useState("");
  const [showWhatsAppAccessToken, setShowWhatsAppAccessToken] = useState(false);

  const [whatsAppStatus, setWhatsAppStatus] =
    useState<WhatsAppStatusResponse | null>(null);

  const integrationsQuery = useQuery({
    queryKey: ["settings", "integrations"],
    queryFn: async () => {
      const [integrations, wa] = await Promise.all([
        getInstitutionIntegrations(),
        getWhatsAppStatus().catch(() => null),
      ]);
      return { integrations, wa };
    },
    retry: false,
  });
  const loading = integrationsQuery.isLoading;

  useEffect(() => {
    if (!integrationsQuery.data) return;
    setState(integrationsQuery.data.integrations);
    setOcrApiKey(integrationsQuery.data.integrations.ocrApiKey ?? "");
    setWhatsAppAccessToken(integrationsQuery.data.integrations.whatsAppAccessToken ?? "");
    setWhatsAppStatus(integrationsQuery.data.wa);
  }, [integrationsQuery.data]);

  useEffect(() => {
    if (integrationsQuery.isError) {
      showToast(t("settings.integrations.toast.loadError"), "error");
    }
  }, [integrationsQuery.isError, showToast, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageSettings) return;
    if (saving) return;
    if (activeTab === "ocr" && !ocrApiKey.trim()) return;
    if (activeTab === "whatsapp" && !whatsAppAccessToken.trim()) return;

    setSaving(true);
    try {
      const response = await upsertInstitutionIntegrations({
        ocrApiKey: ocrApiKey.trim() || null,
        clearOcrApiKey: false,
        whatsAppAccessToken: whatsAppAccessToken.trim() || null,
        clearWhatsAppAccessToken: false,
        rowVersion: state?.rowVersion ?? null,
      });
      setState(response);
      setOcrApiKey(response.ocrApiKey ?? "");
      setWhatsAppAccessToken(response.whatsAppAccessToken ?? "");
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
        <SettingsFormSkeleton rows={4} />
      </div>
    );
  }

  return (
    <form className="settings-section-stack" onSubmit={handleSubmit}>
      <div className="settings-tab-toolbar integrations-tab-toolbar">
        <div
          aria-label={t("settings.integrations.title")}
          className="page-tabs"
          role="tablist"
        >
          <button
            aria-selected={activeTab === "ocr"}
            className={activeTab === "ocr" ? "page-tab active" : "page-tab"}
            onClick={() => setActiveTab("ocr")}
            role="tab"
            type="button"
          >
            OCR
          </button>
          <button
            aria-selected={activeTab === "whatsapp"}
            className={
              activeTab === "whatsapp" ? "page-tab active" : "page-tab"
            }
            onClick={() => setActiveTab("whatsapp")}
            role="tab"
            type="button"
          >
            {t("settings.integrations.whatsApp.title")}
          </button>
        </div>
      </div>

      {activeTab === "ocr" ? (
        <>
          <section className="settings-surface">
            <div className="settings-surface-header">
              <h2 className="settings-surface-title">OCR</h2>
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
                            ? t(
                                "settings.integrations.ocrApiKey.placeholder.replace",
                              )
                            : t(
                                "settings.integrations.ocrApiKey.placeholder.new",
                              )
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
                        {showOcrApiKey ? (
                          <EyeOffIcon size={16} />
                        ) : (
                          <EyeIcon size={16} />
                        )}
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
              {saving
                ? t("settings.toolbar.saving")
                : t("settings.toolbar.save")}
            </button>
          </div>
        </>
      ) : null}

      {activeTab === "whatsapp" ? (
        <section className="settings-surface">
          <div className="settings-surface-header">
            <h2 className="settings-surface-title">
              {t("settings.integrations.whatsApp.title")}
            </h2>
            <p className="settings-surface-description">
              {t("settings.integrations.whatsApp.description")}
            </p>
          </div>

          <div className="settings-surface-body">
            {whatsAppStatus === null ? (
              <div>{t("settings.integrations.whatsApp.statusReadError")}</div>
            ) : (
              <div className="settings-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      {t("settings.integrations.whatsApp.statusLabel")}
                    </label>
                    <div>
                      {whatsAppStatus.enabled ? (
                        <span className="status-pill status-pill-success">
                          {t("settings.integrations.whatsApp.statusActive")}
                        </span>
                      ) : (
                        <span className="status-pill status-pill-muted">
                          {t("settings.integrations.whatsApp.statusInactive")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      {t("settings.integrations.whatsApp.phoneIdLabel")}
                    </label>
                    <div>
                      {whatsAppStatus.hasPhoneNumberId ? (
                        <span className="status-pill status-pill-success">
                          {t("settings.integrations.whatsApp.configured")}
                        </span>
                      ) : (
                        <span className="status-pill status-pill-danger">
                          {t("settings.integrations.whatsApp.missing")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      {t("settings.integrations.whatsApp.accessTokenLabel")}
                    </label>
                    <div>
                      {state?.hasWhatsAppAccessToken || whatsAppStatus.hasAccessToken ? (
                        <span className="status-pill status-pill-success">
                          {t("settings.integrations.whatsApp.configured")}
                        </span>
                      ) : (
                        <span className="status-pill status-pill-danger">
                          {t("settings.integrations.whatsApp.missing")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor={whatsAppAccessTokenId}>
                      {t("settings.integrations.whatsApp.accessTokenLabel")}
                    </label>
                    <div className="settings-secret-input">
                      <input
                        autoComplete="off"
                        className="form-input"
                        disabled={!canManageSettings}
                        id={whatsAppAccessTokenId}
                        onChange={(event) => setWhatsAppAccessToken(event.target.value)}
                        placeholder={
                          state?.hasWhatsAppAccessToken
                            ? t(
                                "settings.integrations.whatsApp.accessTokenPlaceholder.replace",
                              )
                            : t(
                                "settings.integrations.whatsApp.accessTokenPlaceholder.new",
                              )
                        }
                        type={showWhatsAppAccessToken ? "text" : "password"}
                        value={whatsAppAccessToken}
                      />
                      <button
                        aria-label={
                          showWhatsAppAccessToken
                            ? t("settings.integrations.ocrApiKey.hide")
                            : t("settings.integrations.ocrApiKey.show")
                        }
                        className="settings-secret-toggle"
                        disabled={!whatsAppAccessToken}
                        onClick={() => setShowWhatsAppAccessToken((current) => !current)}
                        title={
                          showWhatsAppAccessToken
                            ? t("settings.integrations.ocrApiKey.hide")
                            : t("settings.integrations.ocrApiKey.show")
                        }
                        type="button"
                      >
                        {showWhatsAppAccessToken ? (
                          <EyeOffIcon size={16} />
                        ) : (
                          <EyeIcon size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      {t("settings.integrations.whatsApp.templateNameLabel")}
                    </label>
                    <div className="form-readonly-value">{whatsAppStatus.templateName}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      {t(
                        "settings.integrations.whatsApp.templateLanguageLabel",
                      )}
                    </label>
                    <div className="form-readonly-value">{whatsAppStatus.templateLanguage}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "whatsapp" ? (
        <div className="settings-form-actions">
          <button
            className="btn btn-primary btn-sm"
            disabled={!canManageSettings || saving || !whatsAppAccessToken.trim()}
            title={!canManageSettings ? noPermissionTitle : undefined}
            type="submit"
          >
            {saving
              ? t("settings.toolbar.saving")
              : t("settings.toolbar.save")}
          </button>
        </div>
      ) : null}
    </form>
  );
}
