import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getMebbisApiBaseUrl } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useLanguage, type TranslationKey } from "../../lib/i18n";
import type { AuthInstitution } from "../../lib/auth-storage";
import {
  getLocalAgentHealth,
  getLocalAgentMebbisSession,
  openLocalAgentMebbisHomeView,
  pairLocalAgent,
  readStoredLocalAgentToken,
  startLocalAgentMebbisSession,
  stopLocalAgentMebbisSession,
  submitLocalAgentMebbisVerificationCode,
  LocalAgentError,
  type LocalAgentMebbisSessionResponse,
  type LocalAgentMebbisSessionStatus,
} from "../../lib/local-agent-api";
import { readMebbisLiveViewEnabled, writeMebbisLiveViewEnabled } from "../../lib/mebbis-live-view";
import { pairMebbisExtensionClient } from "../../lib/mebbis-jobs-api";
import { ExternalLinkIcon, MenuIcon } from "../icons";
import { useToast } from "../ui/Toast";
import { InstitutionSelector } from "./InstitutionSelector";
import { NotificationsMenu } from "./NotificationsMenu";
import { UserMenu } from "./UserMenu";

const BRAND_LOGO_SRC = "/pilot.png?v=20260605";
const MEBBIS_DEBUG_VISIBLE_STORAGE_KEY = "pilot.localAgent.mebbisDebugVisible";
const MEBBIS_SESSION_ACTIVE_POLL_MS = 5_000;
const MEBBIS_SESSION_CONNECTED_POLL_MS = 30_000;
const MEBBIS_SESSION_IDLE_POLL_MS = 15_000;

type HeaderProps = {
  activeInstitutionId: string;
  institutions: AuthInstitution[];
  onInstitutionChange: (id: string) => Promise<void>;
  userInitials: string;
  onMenuToggle: () => void;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
};

export function Header({
  activeInstitutionId,
  institutions,
  onInstitutionChange,
  userInitials,
  onMenuToggle,
  onSidebarToggle,
  sidebarCollapsed,
}: HeaderProps) {
  const { user } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const toggleLang = () => setLang(lang === "tr" ? "en" : "tr");

  return (
    <header className="header">
      <button
        aria-label={t("header.menu")}
        className="header-menu-toggle"
        onClick={onMenuToggle}
        type="button"
      >
        <MenuIcon />
      </button>

      <button
        aria-label={t("header.sidebarToggle")}
        aria-pressed={!sidebarCollapsed}
        className="header-brand header-brand-button"
        onClick={onSidebarToggle}
        type="button"
      >
        <img alt="Pilot" className="logo-image" src={BRAND_LOGO_SRC} />
      </button>

      <div className="header-inst-wrap">
        <div className="header-divider" />
        <InstitutionSelector
          activeId={activeInstitutionId}
          institutions={institutions}
          onSelect={onInstitutionChange}
        />
      </div>

      <div className="header-right">
        <HeaderMebbisConnection />
        {user?.isSuperAdmin === true && (
          <button
            aria-label={t("header.languageToggle")}
            className="header-lang"
            onClick={toggleLang}
            title={t("header.languageToggle")}
            type="button"
          >
            {lang === "tr" ? "EN" : "TR"}
          </button>
        )}
        <NotificationsMenu />
        <UserMenu userInitials={userInitials} />
      </div>
    </header>
  );
}

function HeaderMebbisConnection() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<LocalAgentMebbisSessionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [openingMebbisHome, setOpeningMebbisHome] = useState(false);
  const [liveViewEnabled, setLiveViewEnabled] = useState(() => readMebbisLiveViewEnabled());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const pollingTimer = useRef<number | null>(null);
  const sessionStatusRefreshTimers = useRef<number[]>([]);
  const latestSession = useRef<LocalAgentMebbisSessionResponse | null>(null);
  const operationInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    if (readStoredLocalAgentToken()) {
      beginPolling(controller.signal);
    }

    return () => {
      mounted.current = false;
      controller.abort();
      stopPolling();
      clearSessionStatusRefreshTimers();
    };
  }, []);

  const status = normalizeMebbisStatus(session?.status);
  const active = status === "starting" || status === "waiting_verification" || status === "connected" || status === "stopping";
  const showLiveViewToggle = status === "connected";
  const transitionLocked = busy || status === "starting" || status === "stopping";
  const statusText = t(MEBBIS_STATUS_LABELS[status]);
  const statusMessage = error ?? session?.error ?? session?.message ?? statusText;
  const popoverTitle = status === "waiting_verification"
    ? t("header.mebbis.verificationTitle")
    : t("header.mebbis.errorTitle");

  async function refreshSession(signal?: AbortSignal) {
    try {
      const next = await getLocalAgentMebbisSession(signal);
      if (!mounted.current) return;
      latestSession.current = next;
      setSession(next);
      setError(null);
      if (next.status === "waiting_verification" || next.requiresVerificationCode) {
        setPopoverOpen(true);
      }
    } catch {
      if (!mounted.current) return;
      latestSession.current = null;
      setSession(null);
    }
  }

  async function handleToggle() {
    if (operationInFlight.current || transitionLocked) return;
    if (status === "waiting_verification") {
      setPopoverOpen(true);
      return;
    }
    if (active) {
      await stopSession();
    } else {
      await startSession();
    }
  }

  async function handleOpenMebbisHome(event: MouseEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (openingMebbisHome) return;
    setOpeningMebbisHome(true);
    try {
      const result = await openLocalAgentMebbisHomeView();
      showToast(result.message || t("dashboard.toast.mebbisOpened"));
    } catch (err) {
      const message = err instanceof LocalAgentError && err.status === 401
        ? t("dashboard.toast.mebbisLocalAgentNotPaired")
        : err instanceof Error
          ? err.message
          : t("dashboard.toast.mebbisOpenFailed");
      showToast(message, "error");
    } finally {
      setOpeningMebbisHome(false);
    }
  }

  async function handleLiveViewToggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!beginOperation()) return;

    const next = !liveViewEnabled;
    setLiveViewEnabled(next);
    writeMebbisLiveViewEnabled(next);

    try {
      const nextSession = await startLocalAgentMebbisSession({
        apiBaseUrl: getMebbisApiBaseUrl(),
        extensionToken: null,
        debugVisible: next,
      });
      latestSession.current = nextSession;
      setSession(nextSession);
      setError(null);
      refreshMebbisSessionStatusSoon();
      if (nextSession.status === "waiting_verification" || nextSession.requiresVerificationCode) {
        setPopoverOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("header.mebbis.unavailable"));
      setPopoverOpen(true);
    } finally {
      endOperation();
    }
  }

  function beginOperation() {
    if (operationInFlight.current) {
      return false;
    }

    operationInFlight.current = true;
    setBusy(true);
    return true;
  }

  function endOperation() {
    operationInFlight.current = false;
    setBusy(false);
  }

  function refreshMebbisSessionStatus() {
    void queryClient.invalidateQueries({ queryKey: ["mebbis", "session", "status"] });
  }

  function refreshMebbisSessionStatusSoon() {
    refreshMebbisSessionStatus();
    clearSessionStatusRefreshTimers();
    sessionStatusRefreshTimers.current = [
      window.setTimeout(refreshMebbisSessionStatus, 2_000),
      window.setTimeout(refreshMebbisSessionStatus, 5_000),
    ];
  }

  function clearSessionStatusRefreshTimers() {
    for (const timerId of sessionStatusRefreshTimers.current) {
      window.clearTimeout(timerId);
    }
    sessionStatusRefreshTimers.current = [];
  }

  async function startSession() {
    if (!beginOperation()) return;
    setError(null);
    const startingSession = {
      status: "starting",
      message: t("header.mebbis.status.starting"),
      currentUrl: session?.currentUrl ?? null,
      mebbisUser: session?.mebbisUser ?? null,
      requiresVerificationCode: false,
      updatedAtUtc: new Date().toISOString(),
    };
    latestSession.current = startingSession;
    setSession(startingSession);

    try {
      const health = await getLocalAgentHealth();
      if (!readStoredLocalAgentToken()) {
        await pairLocalAgent();
      }
      beginPolling();

      const startInput: { apiBaseUrl: string; extensionToken?: string | null; debugVisible: boolean } = {
        apiBaseUrl: getMebbisApiBaseUrl(),
        extensionToken: null,
        debugVisible:
          readMebbisLiveViewEnabled() ||
          window.localStorage.getItem(MEBBIS_DEBUG_VISIBLE_STORAGE_KEY) === "true",
      };
      const pair = await pairMebbisExtensionClient(`Pilot LocalAgent - ${health.machineName}`);
      startInput.extensionToken = pair.apiToken;
      let next: LocalAgentMebbisSessionResponse;
      try {
        next = await startLocalAgentMebbisSession(startInput);
      } catch (err) {
        if (!(err instanceof LocalAgentError) || err.status !== 401) throw err;
        await pairLocalAgent();
        next = await startLocalAgentMebbisSession(startInput);
      }
      if (shouldPairExtensionToken(next)) {
        const pair = await pairMebbisExtensionClient(`Pilot LocalAgent - ${health.machineName}`);
        next = await startLocalAgentMebbisSession({
          ...startInput,
          extensionToken: pair.apiToken,
        });
      }
      latestSession.current = next;
      setSession(next);
      refreshMebbisSessionStatusSoon();
      if (next.status === "waiting_verification" || next.requiresVerificationCode) {
        setPopoverOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("header.mebbis.unavailable"));
      const failedSession = {
        status: "failed",
        message: t("header.mebbis.status.failed"),
        requiresVerificationCode: false,
        error: err instanceof Error ? err.message : t("header.mebbis.unavailable"),
        updatedAtUtc: new Date().toISOString(),
      };
      latestSession.current = failedSession;
      setSession(failedSession);
      setPopoverOpen(true);
    } finally {
      endOperation();
    }
  }

  function beginPolling(signal?: AbortSignal) {
    if (pollingTimer.current !== null) return;
    void refreshSession(signal);
    scheduleNextPoll(signal);
  }

  function stopPolling() {
    if (pollingTimer.current === null) return;
    window.clearTimeout(pollingTimer.current);
    pollingTimer.current = null;
  }

  function scheduleNextPoll(signal?: AbortSignal) {
    const currentStatus = normalizeMebbisStatus(latestSession.current?.status);
    const delay = currentStatus === "connected"
      ? MEBBIS_SESSION_CONNECTED_POLL_MS
      : currentStatus === "starting" || currentStatus === "waiting_verification" || currentStatus === "stopping"
        ? MEBBIS_SESSION_ACTIVE_POLL_MS
        : MEBBIS_SESSION_IDLE_POLL_MS;

    pollingTimer.current = window.setTimeout(() => {
      pollingTimer.current = null;
      void refreshSession(signal).finally(() => {
        if (mounted.current && pollingTimer.current === null) {
          scheduleNextPoll(signal);
        }
      });
    }, delay);
  }

  async function stopSession() {
    if (!beginOperation()) return;
    setError(null);
    const stoppingSession = {
      status: "stopping",
      message: t("header.mebbis.status.stopping"),
      currentUrl: session?.currentUrl ?? null,
      mebbisUser: session?.mebbisUser ?? null,
      requiresVerificationCode: false,
      updatedAtUtc: new Date().toISOString(),
    };
    latestSession.current = stoppingSession;
    setSession(stoppingSession);

    try {
      const next = await stopLocalAgentMebbisSession();
      latestSession.current = next;
      setSession(next);
      setVerificationCode("");
      setPopoverOpen(false);
      clearSessionStatusRefreshTimers();
      refreshMebbisSessionStatus();
      stopPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("header.mebbis.stopFailed"));
      setPopoverOpen(true);
    } finally {
      endOperation();
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = verificationCode.replace(/\D/g, "");
    if (code.length !== 6 || operationInFlight.current || busy) return;

    if (!beginOperation()) return;
    setError(null);
    try {
      const next = await submitLocalAgentMebbisVerificationCode(code);
      latestSession.current = next;
      setSession(next);
      refreshMebbisSessionStatusSoon();
      if (next.status !== "waiting_verification" && !next.requiresVerificationCode) {
        setVerificationCode("");
        setPopoverOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("header.mebbis.codeFailed"));
    } finally {
      endOperation();
    }
  }

  return (
    <div className="header-mebbis">
      <button
        aria-expanded={popoverOpen}
        aria-label={t("header.mebbisToggle")}
        className={`header-mebbis-toggle is-${status}`}
        disabled={transitionLocked}
        onClick={handleToggle}
        type="button"
      >
        <span className="header-mebbis-switch" data-active={active} aria-hidden="true" />
        <span className="header-mebbis-label">MEBBİS</span>
        <span className="header-mebbis-pill">{statusText}</span>
        <span
          aria-hidden="true"
          className="header-mebbis-open-icon"
          data-loading={openingMebbisHome ? "true" : undefined}
          onClick={(event) => void handleOpenMebbisHome(event)}
          title="MEBBİS aç"
        >
          <ExternalLinkIcon size={14} />
        </span>
      </button>

      {showLiveViewToggle && (
        <button
          aria-pressed={liveViewEnabled}
          className="header-mebbis-live-view"
          disabled={transitionLocked}
          onClick={handleLiveViewToggle}
          title={t("header.mebbis.liveViewHint")}
          type="button"
        >
          <span className="header-mebbis-live-view-switch" data-active={liveViewEnabled} aria-hidden="true" />
          <span>{t("header.mebbis.liveView")}</span>
        </button>
      )}

      {popoverOpen && (
        <div className="header-mebbis-popover" role="dialog" aria-label={popoverTitle}>
          <div className="header-mebbis-popover-head">
            <strong>{popoverTitle}</strong>
            <button
              aria-label={t("common.close")}
              className="header-mebbis-close"
              onClick={() => setPopoverOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          <p>{status === "waiting_verification" ? t("header.mebbis.verificationHint") : statusMessage}</p>
          {status === "waiting_verification" && (
            <form className="header-mebbis-code-form" onSubmit={submitCode}>
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t("header.mebbis.verificationPlaceholder")}
                value={verificationCode}
              />
              <button disabled={busy || verificationCode.length !== 6} type="submit">
                {t("header.mebbis.submitCode")}
              </button>
            </form>
          )}
          {active && (
            <button className="header-mebbis-stop" disabled={busy} onClick={stopSession} type="button">
              {t("header.mebbis.stop")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const MEBBIS_STATUS_LABELS: Record<LocalAgentMebbisSessionStatus, TranslationKey> = {
  inactive: "header.mebbis.status.inactive",
  starting: "header.mebbis.status.starting",
  waiting_verification: "header.mebbis.status.waitingVerification",
  connected: "header.mebbis.status.connected",
  failed: "header.mebbis.status.failed",
  stopping: "header.mebbis.status.stopping",
};

function normalizeMebbisStatus(status: string | undefined): LocalAgentMebbisSessionStatus {
  switch (status) {
    case "starting":
    case "waiting_verification":
    case "connected":
    case "failed":
    case "stopping":
      return status;
    default:
      return "inactive";
  }
}

function shouldPairExtensionToken(session: LocalAgentMebbisSessionResponse): boolean {
  if (session.status !== "failed") return false;
  const message = `${session.error ?? ""} ${session.message ?? ""}`.toLocaleLowerCase("tr-TR");
  return message.includes("extension token") ||
    message.includes("token bulunamadı") ||
    message.includes("token gecersiz") ||
    message.includes("token geçersiz") ||
    message.includes("iptal edilmiş");
}
