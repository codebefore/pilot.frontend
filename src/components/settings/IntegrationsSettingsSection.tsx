import { useEffect, useId, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getInstitutionIntegrations,
  upsertInstitutionIntegrations,
  type InstitutionIntegrationsResponse,
} from "../../lib/institution-settings-api";
import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import { canManageArea } from "../../lib/permissions";
import { EyeIcon, EyeOffIcon } from "../icons";
import { SettingsFormSkeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";

type IntegrationTab = "ocr" | "whatsapp";
const SETTINGS_QUERY_CACHE_MS = 5 * 60 * 1000;
const INTEGRATIONS_QUERY_KEY = ["settings", "integrations"] as const;

export function IntegrationsSettingsSection() {
  const t = useT();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
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

  const integrationsQuery = useQuery({
    gcTime: SETTINGS_QUERY_CACHE_MS,
    queryKey: INTEGRATIONS_QUERY_KEY,
    queryFn: ({ signal }) => getInstitutionIntegrations(signal),
    retry: false,
  });
  const loading = integrationsQuery.isLoading;

  useEffect(() => {
    if (!integrationsQuery.data) return;
    setState(integrationsQuery.data);
    setOcrApiKey(integrationsQuery.data.ocrApiKey ?? "");
    setWhatsAppAccessToken(integrationsQuery.data.whatsAppAccessToken ?? "");
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
      queryClient.setQueryData(INTEGRATIONS_QUERY_KEY, response);
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["outbox", "health"] });
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
          </div>

          <div className="settings-surface-body">
            <div className="settings-form">
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
                <div className="form-group" />
              </div>
            </div>
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
