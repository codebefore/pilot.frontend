import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getPlatformApiBaseUrl } from "../../lib/api";
import {
  getEInvoiceIntegration,
  testEInvoiceIntegrationConnection,
  upsertEInvoiceIntegration,
  type EInvoiceEnvironment,
  type EInvoiceIntegrationResponse,
} from "../../lib/e-archive-api";
import {
  getInstitutionIntegrations,
  upsertInstitutionIntegrations,
  type InstitutionIntegrationsResponse,
} from "../../lib/institution-settings-api";
import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import {
  checkLocalAgentUpdate,
  getLocalAgentHealth,
  getLocalAgentUpdateStatus,
  pairLocalAgentInMemory,
  type LocalAgentUpdateStatusResponse,
} from "../../lib/local-agent-api";
import { canManageArea } from "../../lib/permissions";
import { EyeIcon, EyeOffIcon } from "../icons";
import { CustomSelect } from "../ui/CustomSelect";
import { SettingsFormSkeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";

type IntegrationTab = "downloads" | "ocr" | "whatsapp" | "eInvoice";
type EInvoiceFormValues = {
  providerCode: string;
  environment: EInvoiceEnvironment;
  taxNumber: string;
  senderAlias: string;
  username: string;
  password: string;
  connectorGuid: string;
  usesEArchive: boolean;
  isEnabled: boolean;
};
type EInvoiceFormErrors = Partial<Record<keyof EInvoiceFormValues, string>>;

const SETTINGS_QUERY_CACHE_MS = 5 * 60 * 1000;
const INTEGRATIONS_QUERY_KEY = ["settings", "integrations"] as const;
const EMPTY_E_INVOICE_VALUES: EInvoiceFormValues = {
  providerCode: "",
  environment: "test",
  taxNumber: "",
  senderAlias: "",
  username: "",
  password: "",
  connectorGuid: "",
  usesEArchive: true,
  isEnabled: true,
};
const PILOT_ICON_SRC = "/icon.png?v=20260605";
const LOCAL_AGENT_WINDOWS_DOWNLOAD_BASE_URL =
  "https://pilotyanimda.com/downloads/localagent/PilotLocalAgentSetup-win-x64.exe";
const LOCAL_AGENT_WINDOWS_DOWNLOAD_URL = `${LOCAL_AGENT_WINDOWS_DOWNLOAD_BASE_URL}?bust=${Date.now()}`;
const LOCAL_AGENT_UPDATE_CHANNEL = "stable";
const UPDATE_STATUS_POLL_MS = 2000;
const INSTALLING_HEALTH_RETRY_MS = 5000;
type UpdateCheckState =
  | { status: "idle" }
  | { status: "pairing" | "checking"; message: string }
  | {
      status: "status";
      update: LocalAgentUpdateStatusResponse;
    }
  | { status: "error"; message: string };

export function IntegrationsSettingsSection() {
  const t = useT();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { user, permissions, activeInstitution } = useAuth();
  const whatsAppAccessTokenId = useId();
  const canManageSettings = canManageArea(user, permissions, "settings");
  const noPermissionTitle = t("common.noPermission");

  const [saving, setSaving] = useState(false);
  const [testingEInvoiceConnection, setTestingEInvoiceConnection] = useState(false);
  const [state, setState] = useState<InstitutionIntegrationsResponse | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<IntegrationTab>("downloads");
  const [ocrApiKey, setOcrApiKey] = useState("");
  const [showOcrApiKey, setShowOcrApiKey] = useState(false);
  const [whatsAppAccessToken, setWhatsAppAccessToken] = useState("");
  const [showWhatsAppAccessToken, setShowWhatsAppAccessToken] = useState(false);
  const [eInvoiceState, setEInvoiceState] = useState<EInvoiceIntegrationResponse | null>(null);
  const [eInvoiceValues, setEInvoiceValues] = useState<EInvoiceFormValues>(EMPTY_E_INVOICE_VALUES);
  const [eInvoiceErrors, setEInvoiceErrors] = useState<EInvoiceFormErrors>({});
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckState>({
    status: "idle",
  });
  const updateTokenRef = useRef<string | null>(null);
  const updatePollTimerRef = useRef<number | null>(null);
  const latestUpdateStatusRef = useRef<LocalAgentUpdateStatusResponse | null>(null);

  const integrationsQuery = useQuery({
    gcTime: SETTINGS_QUERY_CACHE_MS,
    queryKey: INTEGRATIONS_QUERY_KEY,
    queryFn: ({ signal }) => getInstitutionIntegrations(signal),
    retry: false,
  });
  const loading = integrationsQuery.isLoading;
  const eInvoiceQueryKey = [
    "settings",
    "e-archive-integration",
    activeInstitution?.id ?? "none",
  ] as const;
  const eInvoiceQuery = useQuery({
    enabled: Boolean(activeInstitution?.id),
    gcTime: SETTINGS_QUERY_CACHE_MS,
    queryKey: eInvoiceQueryKey,
    queryFn: ({ signal }) => getEInvoiceIntegration(signal),
    retry: false,
  });

  useEffect(() => {
    if (!integrationsQuery.data) return;
    setState(integrationsQuery.data);
    setOcrApiKey(integrationsQuery.data.ocrApiKey ?? "");
    setWhatsAppAccessToken(integrationsQuery.data.whatsAppAccessToken ?? "");
  }, [integrationsQuery.data]);

  useEffect(() => {
    if (eInvoiceQuery.data === undefined) return;
    const integration = eInvoiceQuery.data;
    setEInvoiceState(integration);
    setEInvoiceValues(
      integration
        ? {
            providerCode: integration.providerCode,
            environment: integration.environment,
            taxNumber: integration.taxNumber,
            senderAlias: integration.senderAlias ?? "",
            username: "",
            password: "",
            connectorGuid: "",
            usesEArchive: true,
            isEnabled: integration.isEnabled,
          }
        : EMPTY_E_INVOICE_VALUES
    );
    setEInvoiceErrors({});
  }, [eInvoiceQuery.data]);

  useEffect(() => {
    if (integrationsQuery.isError) {
      showToast(t("settings.integrations.toast.loadError"), "error");
    }
  }, [integrationsQuery.isError, showToast, t]);

  useEffect(() => {
    if (eInvoiceQuery.isError) {
      showToast(t("settings.integrations.eInvoice.toast.loadError"), "error");
    }
  }, [eInvoiceQuery.isError, showToast, t]);

  useEffect(() => {
    return () => {
      clearUpdatePollTimer(updatePollTimerRef);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageSettings) return;
    if (saving) return;
    if (activeTab === "eInvoice") {
      const errors = validateEInvoiceValues(eInvoiceValues, eInvoiceState?.credentialConfigured ?? false, t);
      setEInvoiceErrors(errors);
      if (Object.keys(errors).length > 0) {
        showToast(t("settings.integrations.eInvoice.validation.fixErrors"), "error");
        return;
      }

      setSaving(true);
      try {
        const response = await upsertEInvoiceIntegration({
          providerCode: eInvoiceValues.providerCode.trim(),
          environment: eInvoiceValues.environment,
          taxNumber: eInvoiceValues.taxNumber.trim(),
          senderAlias: eInvoiceValues.senderAlias.trim() || null,
          username: eInvoiceValues.username.trim() || null,
          password: eInvoiceValues.password || null,
          connectorGuid: eInvoiceValues.connectorGuid.trim() || null,
          usesEArchive: true,
          isEnabled: true,
          rowVersion: eInvoiceState?.rowVersion ?? null,
        });
        setEInvoiceState(response);
        setEInvoiceValues({
          providerCode: response.providerCode,
          environment: response.environment,
          taxNumber: response.taxNumber,
          senderAlias: response.senderAlias ?? "",
          username: "",
          password: "",
          connectorGuid: "",
          usesEArchive: response.usesEArchive,
          isEnabled: response.isEnabled,
        });
        setEInvoiceErrors({});
        queryClient.setQueryData(eInvoiceQueryKey, response);
        showToast(t("settings.integrations.eInvoice.toast.saved"));
      } catch {
        showToast(t("settings.integrations.eInvoice.toast.saveError"), "error");
      } finally {
        setSaving(false);
      }
      return;
    }
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

  const handleDeactivateEInvoiceIntegration = async () => {
    if (!canManageSettings || saving) return;
    setEInvoiceErrors({});
    if (!eInvoiceState) return;

    setSaving(true);
    try {
      const response = await upsertEInvoiceIntegration({
        providerCode: eInvoiceValues.providerCode.trim(),
        environment: eInvoiceValues.environment,
        taxNumber: eInvoiceValues.taxNumber.trim(),
        senderAlias: eInvoiceValues.senderAlias.trim() || null,
        username: null,
        password: null,
        connectorGuid: null,
        usesEArchive: true,
        isEnabled: false,
        rowVersion: eInvoiceState.rowVersion,
      });
      setEInvoiceState(response);
      setEInvoiceValues({
        providerCode: response.providerCode,
        environment: response.environment,
        taxNumber: response.taxNumber,
        senderAlias: response.senderAlias ?? "",
        username: "",
        password: "",
        connectorGuid: "",
        usesEArchive: true,
        isEnabled: false,
      });
      queryClient.setQueryData(eInvoiceQueryKey, response);
      showToast(t("settings.integrations.eInvoice.toast.saved"));
    } catch {
      showToast(t("settings.integrations.eInvoice.toast.saveError"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEInvoiceConnection = async () => {
    if (!canManageSettings || testingEInvoiceConnection || !eInvoiceState?.credentialConfigured) {
      return;
    }

    setTestingEInvoiceConnection(true);
    try {
      await testEInvoiceIntegrationConnection();
      showToast(t("settings.integrations.eInvoice.toast.connectionSucceeded"));
    } catch {
      showToast(t("settings.integrations.eInvoice.toast.connectionFailed"), "error");
    } finally {
      setTestingEInvoiceConnection(false);
    }
  };

  const handleUpdateCheck = async () => {
    if (updateCheck.status === "pairing" || updateCheck.status === "checking") {
      return;
    }

    clearUpdatePollTimer(updatePollTimerRef);
    latestUpdateStatusRef.current = null;
    setUpdateCheck({
      status: "pairing",
      message: "LocalAgent bağlantısı kuruluyor...",
    });
    let pairToken: string;
    try {
      const pair = await pairLocalAgentInMemory();
      pairToken = pair.token;
    } catch {
      updateTokenRef.current = null;
      setUpdateCheck({
        status: "error",
        message: "LocalAgent çalışmıyor veya kurulu değil.",
      });
      return;
    }

    updateTokenRef.current = pairToken;
    try {
      setUpdateCheck({
        status: "checking",
        message: "Güncelleme kontrol ediliyor...",
      });
      const update = await checkLocalAgentUpdate(pairToken, {
        apiBaseUrl: getPlatformApiBaseUrl(),
        channel: LOCAL_AGENT_UPDATE_CHANNEL,
      });
      handleUpdateStatus(pairToken, update);
    } catch {
      setUpdateCheck({
        status: "error",
        message: "LocalAgent güncelleme kontrolü başlatılamadı.",
      });
    }
  };

  const handleUpdateStatus = (
    token: string,
    update: LocalAgentUpdateStatusResponse
  ) => {
    latestUpdateStatusRef.current = update;
    setUpdateCheck({ status: "status", update });

    if (update.status === "checking" || update.status === "downloading") {
      scheduleUpdateStatusPoll(token);
      return;
    }

    if (update.status === "installing") {
      scheduleInstallingHealthRetry(update);
    }
  };

  const scheduleUpdateStatusPoll = (token: string) => {
    clearUpdatePollTimer(updatePollTimerRef);
    updatePollTimerRef.current = window.setTimeout(async () => {
      try {
        const activeToken = updateTokenRef.current ?? token;
        const update = await getLocalAgentUpdateStatus(activeToken);
        handleUpdateStatus(activeToken, update);
      } catch {
        const latest = latestUpdateStatusRef.current;
        if (
          latest?.status === "checking" ||
          latest?.status === "downloading" ||
          latest?.status === "installing"
        ) {
          const installingUpdate = {
            ...latest,
            status: "installing",
            message: "Güncelleme kuruluyor, LocalAgent yeniden başlayacak",
          };
          latestUpdateStatusRef.current = installingUpdate;
          setUpdateCheck({ status: "status", update: installingUpdate });
          scheduleInstallingHealthRetry(installingUpdate);
          return;
        }

        setUpdateCheck({
          status: "error",
          message: "LocalAgent update durumu alınamadı.",
        });
      }
    }, UPDATE_STATUS_POLL_MS);
  };

  const scheduleInstallingHealthRetry = (
    update: LocalAgentUpdateStatusResponse
  ) => {
    clearUpdatePollTimer(updatePollTimerRef);
    updatePollTimerRef.current = window.setTimeout(async () => {
      try {
        const health = await getLocalAgentHealth();
        const completedUpdate = {
          ...update,
          status: "upToDate",
          currentVersion: health.version,
          availableVersion: update.availableVersion ?? update.currentVersion,
          message: "LocalAgent güncellendi.",
          error: null,
          updatedAtUtc: health.timestampUtc,
        };
        latestUpdateStatusRef.current = completedUpdate;
        setUpdateCheck({
          status: "status",
          update: completedUpdate,
        });
      } catch {
        scheduleInstallingHealthRetry(update);
      }
    }, INSTALLING_HEALTH_RETRY_MS);
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
            aria-selected={activeTab === "downloads"}
            className={
              activeTab === "downloads" ? "page-tab active" : "page-tab"
            }
            onClick={() => setActiveTab("downloads")}
            role="tab"
            type="button"
          >
            Downloads
          </button>
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
          <button
            aria-selected={activeTab === "eInvoice"}
            className={activeTab === "eInvoice" ? "page-tab active" : "page-tab"}
            onClick={() => setActiveTab("eInvoice")}
            role="tab"
            type="button"
          >
            {t("settings.integrations.eInvoice.title")}
          </button>
        </div>
      </div>

      {activeTab === "downloads" ? (
        <section className="settings-surface">
          <div className="settings-surface-body">
            <div className="settings-form">
              <div className="form-row">
                <div className="form-group">
                  <span className="form-label settings-download-label">
                    <img
                      alt="Pilot Agent"
                      className="settings-download-icon"
                      src={PILOT_ICON_SRC}
                    />
                  </span>
                  <div className="settings-inline-actions">
                    <a
                      className="btn btn-primary btn-sm"
                      href={LOCAL_AGENT_WINDOWS_DOWNLOAD_URL}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Download
                    </a>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={
                        updateCheck.status === "pairing" ||
                        updateCheck.status === "checking"
                      }
                      onClick={handleUpdateCheck}
                      type="button"
                    >
                      {updateCheck.status === "pairing" ||
                      updateCheck.status === "checking"
                        ? "Kontrol ediliyor..."
                        : "Güncellemeyi kontrol et"}
                    </button>
                  </div>
                  <UpdateCheckResult state={updateCheck} />
                </div>
                <div className="form-group" />
              </div>
            </div>
          </div>
        </section>
      ) : null}

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

      {activeTab === "eInvoice" ? (
        eInvoiceQuery.isLoading ? (
          <SettingsFormSkeleton rows={5} />
        ) : (
          <>
            <section className="settings-surface">
              <div className="settings-surface-header">
                <div>
                  <h2 className="settings-surface-title">
                    {t("settings.integrations.eInvoice.sectionTitle")}
                  </h2>
                  <p className="settings-form-helper">
                    {t("settings.integrations.eInvoice.description")}
                  </p>
                </div>
              </div>

              <div className="settings-surface-body">
                {eInvoiceValues.usesEArchive ? (
                  <>
                    <div className="settings-connection-card">
                      <div className="settings-connection-copy">
                        <strong className="settings-connection-title">
                          {t("settings.integrations.eInvoice.connectionTitle")}
                        </strong>
                        <span className="settings-connection-meta">
                          {t("settings.integrations.eInvoice.connectionDescription")}
                        </span>
                      </div>
                      <span className="settings-form-helper">
                        {eInvoiceState?.isEnabled ? "Entegrasyon aktif" : "Entegrasyon pasif"}
                      </span>
                    </div>

                    <div className="settings-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor="e-archive-provider-code">
                            {t("settings.integrations.eInvoice.providerCode")}
                          </label>
                          <input
                            aria-invalid={Boolean(eInvoiceErrors.providerCode)}
                            className={eInvoiceErrors.providerCode ? "form-input error" : "form-input"}
                            disabled={!canManageSettings}
                            id="e-archive-provider-code"
                            maxLength={64}
                            onChange={(event) =>
                              setEInvoiceValues((current) => ({
                                ...current,
                                providerCode: event.target.value,
                              }))
                            }
                            placeholder={t("settings.integrations.eInvoice.providerCodePlaceholder")}
                            value={eInvoiceValues.providerCode}
                          />
                          {eInvoiceErrors.providerCode ? (
                            <span className="field-error">{eInvoiceErrors.providerCode}</span>
                          ) : (
                            <span className="settings-form-helper">
                              {t("settings.integrations.eInvoice.providerCodeHelp")}
                            </span>
                          )}
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="e-archive-environment">
                            {t("settings.integrations.eInvoice.environment")}
                          </label>
                          <CustomSelect
                            className="form-select"
                            disabled={!canManageSettings}
                            id="e-archive-environment"
                            onChange={(event) =>
                              setEInvoiceValues((current) => ({
                                ...current,
                                environment: event.target.value as EInvoiceEnvironment,
                              }))
                            }
                            value={eInvoiceValues.environment}
                          >
                            <option value="test">
                              {t("settings.integrations.eInvoice.environment.test")}
                            </option>
                            <option value="production">
                              {t("settings.integrations.eInvoice.environment.production")}
                            </option>
                          </CustomSelect>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor="e-archive-tax-number">
                            {t("settings.integrations.eInvoice.taxNumber")}
                          </label>
                          <input
                            aria-invalid={Boolean(eInvoiceErrors.taxNumber)}
                            className={eInvoiceErrors.taxNumber ? "form-input error" : "form-input"}
                            disabled={!canManageSettings}
                            id="e-archive-tax-number"
                            inputMode="numeric"
                            maxLength={11}
                            onChange={(event) =>
                              setEInvoiceValues((current) => ({
                                ...current,
                                taxNumber: event.target.value.replace(/\D/g, "").slice(0, 11),
                              }))
                            }
                            placeholder={t("settings.integrations.eInvoice.taxNumberPlaceholder")}
                            value={eInvoiceValues.taxNumber}
                          />
                          {eInvoiceErrors.taxNumber ? (
                            <span className="field-error">{eInvoiceErrors.taxNumber}</span>
                          ) : null}
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="e-archive-sender-alias">
                            {t("settings.integrations.eInvoice.senderAlias")}
                          </label>
                          <input
                            aria-invalid={Boolean(eInvoiceErrors.senderAlias)}
                            className={eInvoiceErrors.senderAlias ? "form-input error" : "form-input"}
                            disabled={!canManageSettings}
                            id="e-archive-sender-alias"
                            maxLength={256}
                            onChange={(event) =>
                              setEInvoiceValues((current) => ({
                                ...current,
                                senderAlias: event.target.value,
                              }))
                            }
                            placeholder={t("settings.integrations.eInvoice.senderAliasPlaceholder")}
                            value={eInvoiceValues.senderAlias}
                          />
                          {eInvoiceErrors.senderAlias ? (
                            <span className="field-error">{eInvoiceErrors.senderAlias}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor="e-document-username">
                            Entegratör Kullanıcı Adı
                          </label>
                          <input
                            aria-invalid={Boolean(eInvoiceErrors.username)}
                            autoComplete="off"
                            className={eInvoiceErrors.username ? "form-input error" : "form-input"}
                            disabled={!canManageSettings}
                            id="e-document-username"
                            maxLength={256}
                            onChange={(event) =>
                              setEInvoiceValues((current) => ({
                                ...current,
                                username: event.target.value,
                              }))
                            }
                            placeholder={eInvoiceState?.credentialConfigured ? "Değiştirmek için kullanıcı adı girin" : "Kullanıcı adı"}
                            value={eInvoiceValues.username}
                          />
                          {eInvoiceErrors.username ? <span className="field-error">{eInvoiceErrors.username}</span> : null}
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="e-document-password">Entegratör Şifresi</label>
                          <input
                            aria-invalid={Boolean(eInvoiceErrors.password)}
                            autoComplete="new-password"
                            className={eInvoiceErrors.password ? "form-input error" : "form-input"}
                            disabled={!canManageSettings}
                            id="e-document-password"
                            onChange={(event) => setEInvoiceValues((current) => ({ ...current, password: event.target.value }))}
                            placeholder={eInvoiceState?.credentialConfigured ? "Değiştirmek için yeni şifre girin" : "Şifre"}
                            type="password"
                            value={eInvoiceValues.password}
                          />
                        </div>
                      </div>
                      <div className="form-row full">
                        <div className="form-group">
                          <label className="form-label" htmlFor="e-document-connector-guid">Connector GUID</label>
                          <input
                            className="form-input"
                            disabled={!canManageSettings}
                            id="e-document-connector-guid"
                            onChange={(event) => setEInvoiceValues((current) => ({ ...current, connectorGuid: event.target.value }))}
                            placeholder="MySoft tarafından verilen Connector GUID"
                            value={eInvoiceValues.connectorGuid}
                          />
                          <span className="settings-form-helper">
                            {eInvoiceState?.credentialConfigured ? "Kimlik bilgileri şifreli olarak kayıtlıdır." : "Kullanıcı adı ve şifre şifrelenerek saklanır."}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            {eInvoiceValues.usesEArchive ? (
              <div className="settings-form-actions">
                {eInvoiceState?.isEnabled ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!canManageSettings || saving}
                    onClick={() => void handleDeactivateEInvoiceIntegration()}
                    type="button"
                  >
                    Entegrasyonu Pasifleştir
                  </button>
                ) : null}
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={
                    !canManageSettings ||
                    saving ||
                    testingEInvoiceConnection ||
                    !eInvoiceState?.credentialConfigured
                  }
                  onClick={() => void handleTestEInvoiceConnection()}
                  title={!canManageSettings ? noPermissionTitle : undefined}
                  type="button"
                >
                  {testingEInvoiceConnection
                    ? t("settings.integrations.eInvoice.testingConnection")
                    : t("settings.integrations.eInvoice.testConnection")}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!canManageSettings || saving}
                  title={!canManageSettings ? noPermissionTitle : undefined}
                  type="submit"
                >
                  {saving ? t("settings.toolbar.saving") : t("settings.toolbar.save")}
                </button>
              </div>
            ) : null}
          </>
        )
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

function validateEInvoiceValues(
  values: EInvoiceFormValues,
  credentialConfigured: boolean,
  t: ReturnType<typeof useT>
): EInvoiceFormErrors {
  const errors: EInvoiceFormErrors = {};
  if (!values.usesEArchive) {
    return errors;
  }
  if (!/^[A-Za-z0-9._-]{2,64}$/.test(values.providerCode.trim())) {
    errors.providerCode = t("settings.integrations.eInvoice.validation.providerCode");
  }
  if (!/^\d{10,11}$/.test(values.taxNumber.trim())) {
    errors.taxNumber = t("settings.integrations.eInvoice.validation.taxNumber");
  }
  if (values.senderAlias.trim().length > 256) {
    errors.senderAlias = t("settings.integrations.eInvoice.validation.senderAlias");
  }
  if (!credentialConfigured && (!values.username.trim() || !values.password)) {
    errors.username = "Entegratör kullanıcı adı ve şifresi zorunludur.";
  } else if (Boolean(values.username.trim()) !== Boolean(values.password)) {
    errors.password = "Kullanıcı adı ve şifre birlikte değiştirilmelidir.";
  }
  return errors;
}

function UpdateCheckResult({ state }: { state: UpdateCheckState }) {
  if (state.status === "idle") return null;

  if (state.status === "error") {
    return <p className="settings-form-helper error">{state.message}</p>;
  }

  if (state.status === "pairing" || state.status === "checking") {
    return (
      <p className="settings-form-helper">
        <span className="settings-inline-spinner" aria-hidden="true" />
        {state.message}
      </p>
    );
  }

  if (state.status !== "status") return null;

  const result = getUpdateStatusDisplay(state.update);

  return (
    <p className={result.error ? "settings-form-helper error" : "settings-form-helper"}>
      {result.spinning ? (
        <span className="settings-inline-spinner" aria-hidden="true" />
      ) : null}
      {result.message}
    </p>
  );
}

function getUpdateStatusDisplay(update: LocalAgentUpdateStatusResponse): {
  error: boolean;
  message: string;
  spinning: boolean;
} {
  switch (update.status) {
    case "upToDate":
      return {
        error: false,
        message: "LocalAgent güncel",
        spinning: false,
      };
    case "checking":
      return {
        error: false,
        message: "Güncelleme kontrol ediliyor...",
        spinning: true,
      };
    case "downloading":
      return {
        error: false,
        message: "Güncelleme indiriliyor...",
        spinning: true,
      };
    case "pendingIdle":
      return {
        error: false,
        message: "Güncelleme hazır, işlem bitince kurulacak",
        spinning: false,
      };
    case "installing":
      return {
        error: false,
        message: "Güncelleme kuruluyor, LocalAgent yeniden başlayacak",
        spinning: true,
      };
    case "failed":
      return {
        error: true,
        message: update.error || update.message || "LocalAgent güncellemesi başarısız.",
        spinning: false,
      };
    default:
      return {
        error: false,
        message: update.message || `LocalAgent update durumu: ${update.status}`,
        spinning: false,
      };
  }
}

function clearUpdatePollTimer(timerRef: { current: number | null }) {
  if (timerRef.current === null) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}
