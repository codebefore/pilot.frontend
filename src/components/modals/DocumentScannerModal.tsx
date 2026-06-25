import { useEffect, useMemo, useRef, useState } from "react";

import {
  createLocalAgentScanJob,
  getLocalAgentHealth,
  getLocalAgentScanJob,
  getLocalAgentScanJobResult,
  listLocalAgentScanners,
  readStoredLocalAgentScannerSettings,
  type LocalAgentScannerResponse,
  type LocalAgentScanJobResponse,
  type LocalAgentScanJobStatus,
  writeStoredLocalAgentScannerSettings,
} from "../../lib/local-agent-api";
import { useT, type TranslationKey } from "../../lib/i18n";
import { ScannerIcon } from "../icons";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";

type DocumentScannerModalProps = {
  open: boolean;
  onClose: () => void;
  onScanned: (file: File) => Promise<void> | void;
};

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

function scannerConnectionLabel(scanner: LocalAgentScannerResponse): "USB" | "WIFI" | null {
  const serviceHints = [
    scanner.provider,
    scanner.source,
    scanner.preferredServiceType,
    ...scanner.serviceTypes,
    scanner.scannerId.split(":", 1)[0],
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  if (serviceHints.some((value) => value === "wia" || value === "twain")) return "USB";
  if (scanner.hostName || serviceHints.some((value) => value === "escl" || value === "manual")) return "WIFI";
  return null;
}

function scannerConnectionSuffix(scanner: LocalAgentScannerResponse): string {
  const label = scannerConnectionLabel(scanner);
  return label ? ` (${label})` : "";
}

function scannerConnectionBadge(scanner: LocalAgentScannerResponse): string | null {
  return scannerConnectionLabel(scanner);
}

function scannerOptionLabel(scanner: LocalAgentScannerResponse): string {
  const label = `${scanner.name || scanner.model || scanner.scannerId}${scannerConnectionSuffix(scanner)}`;
  if (scanner.state === "Kontrol ediliyor") return `${label} (kontrol ediliyor)`;
  return isScannerEligible(scanner) ? label : `${label} (uygun değil)`;
}

function scannerDisplayName(scanner: LocalAgentScannerResponse): string {
  return scanner.model || scanner.name || scanner.hostName || scanner.scannerId;
}

function scannerStateLabel(state: string | null | undefined, t: (key: TranslationKey) => string): string {
  if (!state) return t("documentScanner.state.unknown");
  const normalized = state.trim().toLowerCase();
  if (normalized === "idle") return t("documentScanner.state.idle");
  if (normalized === "kontrol ediliyor") return t("documentScanner.state.checking");
  return state;
}

function scanJobStatusLabel(status: LocalAgentScanJobStatus, t: (key: TranslationKey) => string): string {
  return t(`documentScanner.jobStatus.${status}`);
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
  const selectedScannerEligible = selectedScanner ? isScannerEligible(selectedScanner) : false;
  const selectedScannerConnection = selectedScanner ? scannerConnectionBadge(selectedScanner) : null;

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
      setError("LocalAgent çalışmıyor veya tarayıcı listesi alınamadı.");
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
        setError(job.error ?? "Tarama tamamlanamadı.");
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
      setError(scanError instanceof Error ? scanError.message : "Tarama başlatılamadı.");
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
      <button className="btn btn-secondary" onClick={closeModal} type="button">
        İptal
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
        disabled={!selectedScanner || !isScannerEligible(selectedScanner) || loading || scanning}
        onClick={() => void startScan()}
        type="button"
      >
        {scanning ? "Taranıyor..." : "Tara"}
      </button>
    </>
  );

  return (
    <Modal footer={footer} onClose={closeModal} open={open} title="Tarayıcı">
      <div className="document-scanner-modal">
        {error ? <div className="form-error-banner">{error}</div> : null}

        <div className="document-scanner-picker">
          <div className="form-group">
            <label className="form-label" htmlFor="document-scanner-device">
              {t("documentScanner.deviceLabel")}
            </label>
            <CustomSelect
              className="form-select"
              disabled={loading || scanning || scanners.length === 0}
              id="document-scanner-device"
              onChange={(event) => setSelectedScannerId(event.target.value)}
              value={selectedScannerId}
            >
              {scanners.length === 0 ? (
                <option value="">
                  {loading ? t("documentScanner.searchingScanner") : t("documentScanner.noScannerFound")}
                </option>
              ) : null}
              {scanners.map((scanner) => (
                <option
                  disabled={!isScannerEligible(scanner)}
                  key={scanner.scannerId}
                  value={scanner.scannerId}
                >
                  {scannerOptionLabel(scanner)}
                </option>
              ))}
            </CustomSelect>
            <span className="document-scanner-picker-hint">
              {loading
                ? t("documentScanner.searchingScanner")
                : selectedScanner
                  ? t("documentScanner.readyHint")
                  : t("documentScanner.emptyHint")}
            </span>
          </div>
        </div>

        {selectedScanner ? (
          <div className={selectedScannerEligible ? "document-scanner-device-card" : "document-scanner-device-card is-disabled"}>
            <span className="document-scanner-device-icon" aria-hidden="true">
              <ScannerIcon size={15} />
            </span>
            <div>
              <div className="document-scanner-device-title">
                <strong>{scannerDisplayName(selectedScanner)}</strong>
                {selectedScannerConnection ? (
                  <span className="document-scanner-connection-badge">{selectedScannerConnection}</span>
                ) : null}
              </div>
              <span>{scannerStateLabel(selectedScanner.state, t)} · {t("documentScanner.format.colorJpeg")}</span>
            </div>
          </div>
        ) : null}

        {scanJob ? (
          <div className={`document-scanner-job is-${scanJob.status}`}>
            <div>
              <span>{t("documentScanner.jobStatusLabel")}</span>
              <strong>{scanJobStatusLabel(scanJob.status, t)}</strong>
            </div>
            {scanJob.status === "pending" || scanJob.status === "scanning" ? (
              <span className="document-scanner-spinner" aria-hidden="true" />
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
