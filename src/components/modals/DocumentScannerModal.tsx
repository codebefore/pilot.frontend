import { useEffect, useMemo, useRef, useState } from "react";

import {
  createLocalAgentScanJob,
  getLocalAgentHealth,
  getLocalAgentScanJob,
  getLocalAgentScanJobResult,
  listLocalAgentScanners,
  LocalAgentError,
  readStoredLocalAgentScannerSettings,
  type LocalAgentScannerResponse,
  type LocalAgentScanJobResponse,
  writeStoredLocalAgentScannerSettings,
} from "../../lib/local-agent-api";
import { useT, type TranslationKey } from "../../lib/i18n";
import { AlertIcon, CheckIcon, ScannerIcon } from "../icons";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";

type DocumentScannerModalProps = {
  open: boolean;
  onClose: () => void;
  onScanned: (file: File) => Promise<void> | void;
};

type Translate = (key: TranslationKey) => string;

type ConnectionKind = "wifi" | "usb";

type ScanStatusTone = "ready" | "pending" | "scanning" | "completed" | "failed";

const FALLBACK_RESOLUTION = 400;
const POLL_DELAY_MS = 1200;

function createScannedFileName(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  return `evrak-tarama-${stamp}.jpg`;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

export function supportedResolutions(scanner: Pick<LocalAgentScannerResponse, "resolutions"> | null): number[] {
  if (!scanner) return [FALLBACK_RESOLUTION];
  const deviceResolutions = [...new Set(scanner.resolutions.filter((value) => value > 0))]
    .sort((left, right) => left - right);
  return deviceResolutions.length > 0 ? deviceResolutions : [FALLBACK_RESOLUTION];
}

function isScannerEligible(scanner: LocalAgentScannerResponse): boolean {
  return (
    scanner.available &&
    scanner.supportsScan &&
    scanner.supportsJpeg &&
    scanner.supportsFlatbed &&
    scanner.colorModes.some((mode) => mode.toLowerCase() === "rgb24") &&
    scanner.resolutions.some((resolution) => resolution > 0) &&
    supportedResolutions(scanner).length > 0
  );
}

function scannerConnectionKind(scanner: LocalAgentScannerResponse): ConnectionKind | null {
  const serviceHints = [
    scanner.provider,
    scanner.source,
    scanner.preferredServiceType,
    ...scanner.serviceTypes,
    scanner.scannerId.split(":", 1)[0],
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  if (serviceHints.some((value) => value === "wia" || value === "twain")) return "usb";
  if (scanner.hostName || serviceHints.some((value) => value === "escl" || value === "manual")) return "wifi";
  return null;
}

function connectionLabel(kind: ConnectionKind, t: Translate): string {
  return kind === "wifi" ? t("documentScanner.connection.wifi") : t("documentScanner.connection.usb");
}

function scannerDisplayName(scanner: LocalAgentScannerResponse): string {
  return scanner.model || scanner.name || scanner.hostName || scanner.scannerId;
}

function scannerUnavailableReason(scanner: LocalAgentScannerResponse, t: Translate): string {
  const normalized = (scanner.state ?? "").trim().toLowerCase();
  if (normalized === "kontrol ediliyor") return t("documentScanner.unavailable.checking");
  if (normalized === "processing") return t("documentScanner.unavailable.processing");
  if (!scanner.available && normalized) return t("documentScanner.unavailable.notReady");
  if (!scanner.available) return t("documentScanner.unavailable.offline");
  if (!scanner.supportsScan) return t("documentScanner.unavailable.noScan");
  return t("documentScanner.unavailable.unsupported");
}

function resolveScanStatus(
  job: LocalAgentScanJobResponse | null
): { tone: ScanStatusTone; labelKey: TranslationKey } {
  if (!job) return { tone: "ready", labelKey: "documentScanner.status.ready" };
  switch (job.status) {
    case "pending":
      return { tone: "pending", labelKey: "documentScanner.jobStatus.pending" };
    case "scanning":
      return { tone: "scanning", labelKey: "documentScanner.jobStatus.scanning" };
    case "completed":
      return { tone: "completed", labelKey: "documentScanner.jobStatus.completed" };
    case "failed":
      return { tone: "failed", labelKey: "documentScanner.jobStatus.failed" };
    default:
      return { tone: "ready", labelKey: "documentScanner.status.ready" };
  }
}

function ScanStatusGlyph({ tone }: { tone: ScanStatusTone }) {
  if (tone === "pending" || tone === "scanning") {
    return <span className="document-scanner-spinner" aria-hidden="true" />;
  }
  if (tone === "completed") {
    return <CheckIcon size={14} />;
  }
  if (tone === "failed") {
    return <AlertIcon size={14} />;
  }
  return <span className="document-scanner-dot" aria-hidden="true" />;
}

function userFacingScanError(error: string | null | undefined, t: Translate): string {
  if (!error) return t("documentScanner.error.failed");
  const normalized = error.toLowerCase();
  if (normalized.includes("scan timed out")) {
    return t("documentScanner.error.timeout");
  }

  const isTechnicalEsclError =
    normalized.includes("escl") ||
    normalized.includes("scanjobs") ||
    normalized.includes("<html") ||
    normalized.includes("invalid status line") ||
    normalized.includes("service unavailable");

  if (isTechnicalEsclError) {
    return t("documentScanner.error.networkRejected");
  }

  return error;
}

export function DocumentScannerModal({ open, onClose, onScanned }: DocumentScannerModalProps) {
  const t = useT();
  const scanControllerRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanners, setScanners] = useState<LocalAgentScannerResponse[]>([]);
  const [selectedScannerId, setSelectedScannerId] = useState("");
  const [scanJob, setScanJob] = useState<LocalAgentScanJobResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedScanner = useMemo(
    () => scanners.find((scanner) => scanner.scannerId === selectedScannerId) ?? null,
    [scanners, selectedScannerId]
  );
  const readyScanners = useMemo(() => scanners.filter(isScannerEligible), [scanners]);
  const unavailableScanners = useMemo(
    () => scanners.filter((scanner) => !isScannerEligible(scanner)),
    [scanners]
  );
  const visibleUnavailableScanners = loading ? [] : unavailableScanners;
  const selectedScannerEligible = selectedScanner ? isScannerEligible(selectedScanner) : false;
  const selectedConnection = selectedScanner ? scannerConnectionKind(selectedScanner) : null;
  const status = resolveScanStatus(scanJob);
  const hasDiscoveredScanners = scanners.length > 0;

  const hintText = loading
    ? t("documentScanner.searchingHint")
    : scanning
      ? t("documentScanner.scanningHint")
      : readyScanners.length === 0
        ? hasDiscoveredScanners
          ? t("documentScanner.notReadyHint")
          : t("documentScanner.connectHint")
        : t("documentScanner.readyHint");
  const scannerPlaceholder = loading
    ? t("documentScanner.searchingScanner")
    : hasDiscoveredScanners
      ? t("documentScanner.noUsableScannerFound")
      : t("documentScanner.noScannerFound");

  const loadScanners = async (signal?: AbortSignal) => {
    const stored = readStoredLocalAgentScannerSettings();
    setLoading(true);
    setError(null);
    setScanJob(null);
    try {
      await getLocalAgentHealth(signal);
      const nextScanners = await listLocalAgentScanners(signal);
      setScanners(nextScanners);
      const storedScanner = stored?.scannerId
        ? nextScanners.find((scanner) => scanner.scannerId === stored.scannerId && isScannerEligible(scanner))
        : null;
      const firstReadyScanner = storedScanner
        ?? nextScanners.find(isScannerEligible)
        ?? null;
      setSelectedScannerId((current) => {
        if (current && nextScanners.some((scanner) => scanner.scannerId === current && isScannerEligible(scanner))) {
          return current;
        }
        return firstReadyScanner?.scannerId ?? "";
      });
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setScanners([]);
      setSelectedScannerId("");
      setError(t("documentScanner.error.unreachable"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadScanners(controller.signal);
    return () => {
      controller.abort();
      scanControllerRef.current?.abort();
      scanControllerRef.current = null;
    };
  }, [open]);

  const startScan = async () => {
    if (!selectedScanner || !isScannerEligible(selectedScanner) || scanning) return;

    scanControllerRef.current?.abort();
    const controller = new AbortController();
    scanControllerRef.current = controller;
    setScanning(true);
    setError(null);
    setScanJob(null);
    try {
      const created = await createLocalAgentScanJob(
        selectedScanner.scannerId,
        {
          documentFormat: "image/jpeg",
          source: selectedScanner.supportsFlatbed ? "platen" : undefined,
        },
        controller.signal
      );

      let job = await getLocalAgentScanJob(created.jobId, controller.signal);
      setScanJob(job);
      while (job.status === "pending" || job.status === "scanning") {
        await delay(POLL_DELAY_MS, controller.signal);
        job = await getLocalAgentScanJob(created.jobId, controller.signal);
        setScanJob(job);
      }

      if (job.status === "failed") {
        setError(userFacingScanError(job.error, t));
        return;
      }

      const blob = await getLocalAgentScanJobResult(job.jobId, controller.signal);
      const file = new File([blob], createScannedFileName(), {
        type: blob.type || "image/jpeg",
      });
      writeStoredLocalAgentScannerSettings({
        hostName: selectedScanner.hostName,
        name: selectedScanner.name,
        model: selectedScanner.model,
        scannerId: selectedScanner.scannerId,
        resolution: null,
      });
      await onScanned(file);
      onClose();
    } catch (scanError) {
      if (scanError instanceof DOMException && scanError.name === "AbortError") return;
      if (scanError instanceof LocalAgentError && scanError.status === 409) {
        setError(t("documentScanner.error.activeJob"));
        return;
      }

      setError(t("documentScanner.error.start"));
    } finally {
      if (scanControllerRef.current === controller) {
        scanControllerRef.current = null;
      }
      setScanning(false);
    }
  };

  const closeModal = () => {
    scanControllerRef.current?.abort();
    scanControllerRef.current = null;
    onClose();
  };

  const footer = (
    <>
      <button className="btn btn-secondary document-scanner-cancel" onClick={closeModal} type="button">
        {t("common.cancel")}
      </button>
      <button
        className="btn btn-secondary"
        disabled={loading || scanning}
        onClick={() => void loadScanners()}
        type="button"
      >
        {t("documentScanner.refresh")}
      </button>
      <button
        className="btn btn-primary"
        disabled={!selectedScannerEligible || loading || scanning}
        onClick={() => void startScan()}
        type="button"
      >
        {scanning ? t("documentScanner.scanning") : t("documentScanner.scan")}
      </button>
    </>
  );

  return (
    <Modal footer={footer} onClose={closeModal} open={open} title={t("documentScanner.title")}>
      <div className="document-scanner">
        {error ? (
          <div className="form-error-banner document-scanner-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="document-scanner-field">
          <label className="document-scanner-label" htmlFor="document-scanner-device">
            {t("documentScanner.deviceLabel")}
          </label>
          <CustomSelect
            className="form-select"
            disabled={loading || scanning || readyScanners.length === 0}
            id="document-scanner-device"
            onChange={(event) => setSelectedScannerId(event.target.value)}
            placeholder={scannerPlaceholder}
            value={selectedScannerId}
          >
            {readyScanners.map((scanner) => {
              const kind = scannerConnectionKind(scanner);
              return (
                <option
                  key={scanner.scannerId}
                  value={scanner.scannerId}
                  data-secondary={kind ? connectionLabel(kind, t) : undefined}
                >
                  {scannerDisplayName(scanner)}
                </option>
              );
            })}
          </CustomSelect>
          <p className="document-scanner-hint">{hintText}</p>
        </div>

        {selectedScanner && selectedScannerEligible ? (
          <div className={`document-scanner-card is-${status.tone}`}>
            <div className="document-scanner-card-head">
              <span className="document-scanner-card-icon" aria-hidden="true">
                <ScannerIcon size={18} />
              </span>
              <strong className="document-scanner-card-name" title={scannerDisplayName(selectedScanner)}>
                {scannerDisplayName(selectedScanner)}
              </strong>
              {selectedConnection ? (
                <span className={`document-scanner-badge is-${selectedConnection}`}>
                  {connectionLabel(selectedConnection, t)}
                </span>
              ) : null}
            </div>
            <div className="document-scanner-card-status" aria-live="polite">
              <span className="document-scanner-card-state">
                <ScanStatusGlyph tone={status.tone} />
                {t(status.labelKey)}
              </span>
              <span className="document-scanner-card-format">{t("documentScanner.format.colorJpeg")}</span>
            </div>
          </div>
        ) : null}

        {visibleUnavailableScanners.length > 0 ? (
          <div className="document-scanner-unusable">
            <span className="document-scanner-unusable-title">{t("documentScanner.unavailable.title")}</span>
            <ul className="document-scanner-unusable-list">
              {visibleUnavailableScanners.map((scanner) => {
                const kind = scannerConnectionKind(scanner);
                return (
                  <li className="document-scanner-unusable-item" key={scanner.scannerId}>
                    <span className="document-scanner-unusable-name">
                      {scannerDisplayName(scanner)}
                      {kind ? <em>{connectionLabel(kind, t)}</em> : null}
                    </span>
                    <span className="document-scanner-unusable-reason">
                      {scannerUnavailableReason(scanner, t)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
