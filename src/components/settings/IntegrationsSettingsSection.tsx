import { useEffect, useId, useState, type FormEvent } from "react";

import {
  getInstitutionIntegrations,
  getWhatsAppStatus,
  testSendWhatsApp,
  upsertInstitutionIntegrations,
  type InstitutionIntegrationsResponse,
  type WhatsAppStatusResponse,
  type WhatsAppTestSendResponse,
} from "../../lib/institution-settings-api";
import { useAuth } from "../../lib/auth";
import { useT, currentLocale } from "../../lib/i18n";
import { canManageArea } from "../../lib/permissions";
import { EyeIcon, EyeOffIcon } from "../icons";
import { useToast } from "../ui/Toast";

type IntegrationTab = "ocr" | "whatsapp";

export function IntegrationsSettingsSection() {
  const t = useT();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const templateNameId = useId();
  const templateLanguageId = useId();
  const canManageSettings = canManageArea(user, permissions, "settings");
  const noPermissionTitle = t("common.noPermission");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<InstitutionIntegrationsResponse | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<IntegrationTab>("ocr");
  const [ocrApiKey, setOcrApiKey] = useState("");
  const [showOcrApiKey, setShowOcrApiKey] = useState(false);

  const [whatsAppStatus, setWhatsAppStatus] =
    useState<WhatsAppStatusResponse | null>(null);
  const [whatsAppTestPhone, setWhatsAppTestPhone] = useState("");
  const [whatsAppTesting, setWhatsAppTesting] = useState(false);
  const [whatsAppLastResult, setWhatsAppLastResult] =
    useState<WhatsAppTestSendResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    Promise.all([
      getInstitutionIntegrations(controller.signal),
      getWhatsAppStatus(controller.signal).catch(() => null),
    ])
      .then(([integrations, wa]) => {
        setState(integrations);
        setOcrApiKey(integrations.ocrApiKey ?? "");
        if (wa) setWhatsAppStatus(wa);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        showToast(t("settings.integrations.toast.loadError"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [showToast, t]);

  const handleWhatsAppTest = async () => {
    if (!canManageSettings) return;
    const phone = whatsAppTestPhone.replace(/\D/g, "");
    if (!/^5\d{9}$/.test(phone)) {
      showToast(
        t("settings.integrations.whatsApp.toast.invalidPhone"),
        "error",
      );
      return;
    }
    setWhatsAppTesting(true);
    setWhatsAppLastResult(null);
    try {
      const result = await testSendWhatsApp(phone);
      setWhatsAppLastResult(result);
      if (result.status === "sent") {
        showToast(t("settings.integrations.whatsApp.toast.sent"));
      } else {
        showToast(
          result.errorMessage ??
            t("settings.integrations.whatsApp.toast.failed"),
          "error",
        );
      }
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("settings.integrations.whatsApp.toast.failed"),
        "error",
      );
    } finally {
      setWhatsAppTesting(false);
    }
  };

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
                      {whatsAppStatus.hasAccessToken ? (
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
                    <label className="form-label" htmlFor={templateNameId}>
                      {t("settings.integrations.whatsApp.templateNameLabel")}
                    </label>
                    <input
                      id={templateNameId}
                      className="form-input"
                      disabled
                      readOnly
                      value={whatsAppStatus.templateName}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor={templateLanguageId}>
                      {t(
                        "settings.integrations.whatsApp.templateLanguageLabel",
                      )}
                    </label>
                    <input
                      id={templateLanguageId}
                      className="form-input"
                      disabled
                      readOnly
                      value={whatsAppStatus.templateLanguage}
                    />
                  </div>
                  <div className="form-group" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="whatsapp-test-phone">
                      {t("settings.integrations.whatsApp.testPhoneLabel")}
                    </label>
                    <input
                      autoComplete="off"
                      className="form-input"
                      disabled={
                        !canManageSettings ||
                        whatsAppTesting ||
                        !whatsAppStatus.enabled
                      }
                      id="whatsapp-test-phone"
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(event) =>
                        setWhatsAppTestPhone(
                          event.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      placeholder="5071234567"
                      value={whatsAppTestPhone}
                    />
                  </div>
                  <div className="form-group" style={{ alignSelf: "end" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={
                        !canManageSettings ||
                        whatsAppTesting ||
                        !whatsAppStatus.enabled ||
                        whatsAppTestPhone.length !== 10
                      }
                      onClick={handleWhatsAppTest}
                      title={
                        !whatsAppStatus.enabled
                          ? t("settings.integrations.whatsApp.disabledTooltip")
                          : !canManageSettings
                            ? noPermissionTitle
                            : undefined
                      }
                      type="button"
                    >
                      {whatsAppTesting
                        ? t("settings.integrations.whatsApp.testButtonSending")
                        : t("settings.integrations.whatsApp.testButton")}
                    </button>
                  </div>
                  <div className="form-group" />
                </div>

                {whatsAppLastResult ? (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        {t("settings.integrations.whatsApp.lastTestLabel")}
                      </label>
                      <div>
                        <span
                          className={
                            whatsAppLastResult.status === "sent"
                              ? "status-pill status-pill-success"
                              : "status-pill status-pill-danger"
                          }
                        >
                          {whatsAppLastResult.status === "sent"
                            ? t("settings.integrations.whatsApp.resultSent")
                            : t("settings.integrations.whatsApp.resultFailed")}
                        </span>{" "}
                        <small>
                          {new Date(
                            whatsAppLastResult.sentAtUtc,
                          ).toLocaleString(currentLocale())}
                        </small>
                        {whatsAppLastResult.errorMessage ? (
                          <div className="form-error" style={{ marginTop: 6 }}>
                            {whatsAppLastResult.errorMessage}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </form>
  );
}
