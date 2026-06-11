import { useEffect, useMemo, useRef, useState } from "react";

import {
  createLocalAgentScanJob,
  getLocalAgentHealth,
  getLocalAgentScanJob,
  getLocalAgentScanJobResult,
  listLocalAgentScanners,
  type LocalAgentScannerResponse,
  type LocalAgentScanJobResponse,
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
  return isScannerEligible(scanner) ? label : `${label} (uygun değil)`;
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

  const selectedScanner = useMemo(
    () => scanners.find((scanner) => scanner.scannerId === selectedScannerId) ?? null,
    [scanners, selectedScannerId]
  );
  const resolutionOptions = useMemo(() => supportedResolutions(selectedScanner), [selectedScanner]);

  const loadScanners = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setScanJob(null);
    try {
      await getLocalAgentHealth(signal);
      const nextScanners = await listLocalAgentScanners(signal);
      setScanners(nextScanners);
      const firstReadyScanner = nextScanners.find(isScannerEligible)
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
            <span>{loading ? "Tarayıcılar aranıyor..." : `${scanners.length} cihaz bulundu`}</span>
          </div>
          <button
            className="icon-btn"
            disabled={loading || scanning}
            onClick={() => void loadScanners()}
            title="Yenile"
            type="button"
          >
            <RefreshIcon size={14} />
          </button>
        </div>

        {error ? <div className="form-error-banner">{error}</div> : null}

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
              <strong>{selectedScanner.model || selectedScanner.name}</strong>
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
