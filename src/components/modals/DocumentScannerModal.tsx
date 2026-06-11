import { useEffect, useMemo, useRef, useState } from "react";

import {
  addLocalAgentManualScanner,
  createLocalAgentScanJob,
  getLocalAgentHealth,
  getLocalAgentScanJob,
  getLocalAgentScanJobResult,
  listLocalAgentScanners,
  readStoredLocalAgentScannerSettings,
  type LocalAgentScannerResponse,
  type LocalAgentScanJobResponse,
  writeStoredLocalAgentScannerSettings,
  type StoredLocalAgentScannerSettings,
} from "../../lib/local-agent-api";
import { RefreshIcon, ScannerIcon } from "../icons";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";

type DocumentScannerModalProps = {
  open: boolean;
  onClose: () => void;
  onScanned: (file: File) => Promise<void> | void;
};

const DEFAULT_RESOLUTION = 300;
const PREFERRED_RESOLUTIONS = [300, 400, 600];
const POLL_DELAY_MS = 1200;

type ScannerLoadMode = "stored" | "discovery";

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

function supportedResolutions(scanner: LocalAgentScannerResponse | null): number[] {
  if (!scanner) return [DEFAULT_RESOLUTION];
  const deviceResolutions = scanner.resolutions.filter((value) => value > 0);
  const preferred = PREFERRED_RESOLUTIONS.filter((value) => deviceResolutions.includes(value));
  if (preferred.length > 0) return preferred;
  return deviceResolutions.length > 0 ? deviceResolutions : [DEFAULT_RESOLUTION];
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

function scannerOptionLabel(scanner: LocalAgentScannerResponse): string {
  const label = scanner.name || scanner.model || scanner.scannerId;
  if (scanner.state === "Kontrol ediliyor") return `${label} (kontrol ediliyor)`;
  return isScannerEligible(scanner) ? label : `${label} (uygun değil)`;
}

function scannerDisplayName(scanner: LocalAgentScannerResponse): string {
  return scanner.model || scanner.name || scanner.hostName || scanner.scannerId;
}

function storedScannerPlaceholder(stored: StoredLocalAgentScannerSettings): LocalAgentScannerResponse | null {
  const scannerId = stored.scannerId ?? stored.hostName;
  if (!scannerId) return null;
  const name = stored.model ?? stored.name ?? stored.hostName ?? scannerId;
  return {
    scannerId,
    name,
    manufacturer: null,
    model: stored.model ?? stored.name ?? null,
    serviceTypes: ["manual"],
    hostName: stored.hostName ?? null,
    advertisedPort: null,
    preferredServiceType: "manual",
    state: "Kontrol ediliyor",
    available: false,
    supportsScan: false,
    supportsJpeg: false,
    supportsPdf: false,
    resolutions: stored.resolution ? [stored.resolution] : [DEFAULT_RESOLUTION],
    colorModes: [],
    supportsFlatbed: false,
    supportsFeeder: false,
    error: null,
  };
}

export function DocumentScannerModal({ open, onClose, onScanned }: DocumentScannerModalProps) {
  const scanControllerRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanners, setScanners] = useState<LocalAgentScannerResponse[]>([]);
  const [selectedScannerId, setSelectedScannerId] = useState("");
  const [selectedResolution, setSelectedResolution] = useState(DEFAULT_RESOLUTION);
  const [scanJob, setScanJob] = useState<LocalAgentScanJobResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualHost, setManualHost] = useState("");
  const [manualAdding, setManualAdding] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [loadMode, setLoadMode] = useState<ScannerLoadMode>("discovery");

  const selectedScanner = useMemo(
    () => scanners.find((scanner) => scanner.scannerId === selectedScannerId) ?? null,
    [scanners, selectedScannerId]
  );
  const resolutionOptions = useMemo(() => supportedResolutions(selectedScanner), [selectedScanner]);

  const loadScanners = async (signal?: AbortSignal, forceDiscovery = false) => {
    const stored = readStoredLocalAgentScannerSettings();
    setLoading(true);
    setLoadMode(!forceDiscovery && stored?.hostName ? "stored" : "discovery");
    setError(null);
    setScanJob(null);
    try {
      await getLocalAgentHealth(signal);
      if (!forceDiscovery && stored?.hostName) {
        const placeholder = storedScannerPlaceholder(stored);
        if (placeholder) {
          setScanners([placeholder]);
          setSelectedScannerId(placeholder.scannerId);
          if (stored.resolution) {
            setSelectedResolution(stored.resolution);
          }
        }
        try {
          const scanner = await addLocalAgentManualScanner(stored.hostName, signal);
          setScanners([scanner]);
          if (isScannerEligible(scanner)) {
            setSelectedScannerId(scanner.scannerId);
            if (stored.resolution && supportedResolutions(scanner).includes(stored.resolution)) {
              setSelectedResolution(stored.resolution);
            }
          } else {
            setSelectedScannerId("");
          }
          return;
        } catch (storedError) {
          if (storedError instanceof DOMException && storedError.name === "AbortError") return;
          setScanners(placeholder ? [placeholder] : []);
          setSelectedScannerId("");
          setError("Son kullanılan tarayıcıya ulaşılamadı. Yenile ile ağdaki tarayıcıları arayabilirsin.");
          return;
        }
      }
      setLoadMode("discovery");
      const nextScanners = await listLocalAgentScanners(signal);
      setScanners(nextScanners);
      const storedScanner = stored?.scannerId
        ? nextScanners.find((scanner) => scanner.scannerId === stored.scannerId && isScannerEligible(scanner))
        : null;
      const firstReadyScanner = storedScanner
        ?? nextScanners.find(isScannerEligible)
        ?? null;
      if (stored?.resolution && supportedResolutions(firstReadyScanner).includes(stored.resolution)) {
        setSelectedResolution(stored.resolution);
      }
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
    void loadScanners(controller.signal, false);
    return () => {
      controller.abort();
      scanControllerRef.current?.abort();
      scanControllerRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!resolutionOptions.includes(selectedResolution)) {
      setSelectedResolution(resolutionOptions[0] ?? DEFAULT_RESOLUTION);
    }
  }, [resolutionOptions, selectedResolution]);

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
          resolution: selectedResolution,
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
        resolution: selectedResolution,
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

  const addManualScanner = async () => {
    const host = manualHost.trim();
    if (!host || manualAdding) return;

    const controller = new AbortController();
    setManualAdding(true);
    setManualError(null);
    setError(null);
    try {
      const scanner = await addLocalAgentManualScanner(host, controller.signal);
      setScanners((current) => {
        const withoutDuplicate = current.filter((item) => item.scannerId !== scanner.scannerId);
        return [...withoutDuplicate, scanner].sort((a, b) => a.name.localeCompare(b.name, "tr"));
      });
      setSelectedScannerId(scanner.scannerId);
      const nextResolutions = supportedResolutions(scanner);
      if (!nextResolutions.includes(selectedResolution)) {
        setSelectedResolution(nextResolutions[0] ?? DEFAULT_RESOLUTION);
      }
      setManualHost("");
    } catch (manualAddError) {
      setManualError(
        manualAddError instanceof Error
          ? manualAddError.message
          : "Bu adreste desteklenen tarayıcı bulunamadı."
      );
    } finally {
      setManualAdding(false);
    }
  };

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={closeModal} type="button">
        İptal
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
        <div className="document-scanner-toolbar">
          <div>
            <strong>LocalAgent</strong>
            <span>
              {loading
                ? loadMode === "stored"
                  ? "Son tarayıcı kontrol ediliyor..."
                  : "Tarayıcılar aranıyor..."
                : `${scanners.length} cihaz bulundu`}
            </span>
          </div>
          <button
            className="icon-btn"
            disabled={loading || scanning}
            onClick={() => void loadScanners(undefined, true)}
            title="Yenile"
            type="button"
          >
            <RefreshIcon size={14} />
          </button>
        </div>

        {error ? <div className="form-error-banner">{error}</div> : null}

        <div className="document-scanner-manual">
          <label className="form-label" htmlFor="document-scanner-manual-host">IP / Host</label>
          <div className="document-scanner-manual-row">
            <input
              className="form-input"
              disabled={manualAdding || scanning}
              id="document-scanner-manual-host"
              onChange={(event) => {
                setManualHost(event.target.value);
                setManualError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addManualScanner();
                }
              }}
              placeholder="192.168.1.102"
              type="text"
              value={manualHost}
            />
            <button
              className="btn btn-secondary btn-sm"
              disabled={manualAdding || scanning || manualHost.trim() === ""}
              onClick={() => void addManualScanner()}
              type="button"
            >
              {manualAdding ? "Deneniyor..." : "Ekle"}
            </button>
          </div>
          {manualError ? <div className="form-error">{manualError}</div> : null}
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor="document-scanner-device">Tarayıcı</label>
            <CustomSelect
              className="form-select"
              disabled={loading || scanning || scanners.length === 0}
              id="document-scanner-device"
              onChange={(event) => setSelectedScannerId(event.target.value)}
              value={selectedScannerId}
            >
              {scanners.length === 0 ? <option value="">Tarayıcı bulunamadı</option> : null}
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
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor="document-scanner-resolution">Çözünürlük</label>
            <CustomSelect
              className="form-select"
              disabled={!selectedScanner || scanning}
              id="document-scanner-resolution"
              onChange={(event) => setSelectedResolution(Number(event.target.value))}
              value={selectedResolution}
            >
              {resolutionOptions.map((resolution) => (
                <option key={resolution} value={resolution}>
                  {resolution} dpi
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        {selectedScanner ? (
          <div className="document-scanner-summary">
            <span className="candidate-doc-upload-option-icon" aria-hidden="true">
              <ScannerIcon size={15} />
            </span>
            <div>
              <strong>{scannerDisplayName(selectedScanner)}</strong>
              <span>
                {selectedScanner.state ?? "Durum bilinmiyor"} · {selectedResolution} dpi · Renkli JPEG
              </span>
            </div>
          </div>
        ) : null}

        {scanJob ? (
          <div className="document-scanner-job">
            <span>İş durumu</span>
            <strong>{scanJob.status}</strong>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
