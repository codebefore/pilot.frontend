import { getLocalAgentBaseUrl } from "./api";

export type LocalAgentHealthResponse = {
  status: string;
  service: string;
  version: string;
  machineName: string;
  timestampUtc: string;
};

export type LocalAgentPairResponse = {
  token: string;
  machineName: string;
};

export type LocalAgentScannerResponse = {
  scannerId: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  serviceTypes: string[];
  hostName?: string | null;
  advertisedPort?: number | null;
  preferredServiceType?: string | null;
  state?: string | null;
  available: boolean;
  supportsScan: boolean;
  supportsJpeg: boolean;
  supportsPdf: boolean;
  resolutions: number[];
  colorModes: string[];
  supportsFlatbed: boolean;
  supportsFeeder: boolean;
  error?: string | null;
};

export type LocalAgentScannerListResponse = {
  scanners: LocalAgentScannerResponse[];
};

export type LocalAgentScanJobStatus = "pending" | "scanning" | "completed" | "failed";

export type LocalAgentScanJobResponse = {
  jobId: string;
  scannerId: string;
  status: LocalAgentScanJobStatus;
  error?: string | null;
  resultContentType?: string | null;
  resultSizeBytes?: number | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type CreateLocalAgentScanJobResponse = {
  jobId: string;
  status: LocalAgentScanJobStatus;
};

export type LocalAgentScanSettings = {
  resolution?: number;
  documentFormat?: "image/jpeg" | "application/pdf";
  source?: string;
};

export type StoredLocalAgentScannerSettings = {
  hostName?: string | null;
  name?: string | null;
  model?: string | null;
  scannerId?: string | null;
  resolution?: number | null;
};

export type LocalAgentMebbisSessionStatus =
  | "inactive"
  | "starting"
  | "waiting_verification"
  | "connected"
  | "failed"
  | "stopping";

export type LocalAgentMebbisSessionResponse = {
  status: LocalAgentMebbisSessionStatus | string;
  message: string;
  currentUrl?: string | null;
  mebbisUser?: string | null;
  requiresVerificationCode: boolean;
  error?: string | null;
  updatedAtUtc: string;
};

export class LocalAgentError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LocalAgentError";
    this.status = status;
  }
}

export function getLocalAgentUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getLocalAgentBaseUrl()}${normalizedPath}`;
}

export async function getLocalAgentHealth(signal?: AbortSignal): Promise<LocalAgentHealthResponse> {
  return getLocalAgentJson<LocalAgentHealthResponse>("/health", signal);
}

export async function pairLocalAgent(signal?: AbortSignal): Promise<LocalAgentPairResponse> {
  const response = await fetch(getLocalAgentUrl("/pair"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    signal,
  });
  const pair = await handleLocalAgentJson<LocalAgentPairResponse>(response);
  writeStoredLocalAgentToken(pair.token);
  return pair;
}

export async function getLocalAgentMebbisSession(
  signal?: AbortSignal
): Promise<LocalAgentMebbisSessionResponse> {
  return getLocalAgentJson<LocalAgentMebbisSessionResponse>("/mebbis/session", signal, true);
}

export async function startLocalAgentMebbisSession(
  input: { apiBaseUrl: string; extensionToken?: string | null; debugVisible?: boolean },
  signal?: AbortSignal
): Promise<LocalAgentMebbisSessionResponse> {
  const response = await fetch(getLocalAgentUrl("/mebbis/session/start"), {
    method: "POST",
    headers: buildLocalAgentHeaders(true),
    body: JSON.stringify({
      apiBaseUrl: input.apiBaseUrl,
      extensionToken: input.extensionToken ?? null,
      debugVisible: input.debugVisible ?? false,
    }),
    signal,
  });
  return handleLocalAgentJson<LocalAgentMebbisSessionResponse>(response);
}

export async function submitLocalAgentMebbisVerificationCode(
  code: string,
  signal?: AbortSignal
): Promise<LocalAgentMebbisSessionResponse> {
  const response = await fetch(getLocalAgentUrl("/mebbis/session/verification-code"), {
    method: "POST",
    headers: buildLocalAgentHeaders(true),
    body: JSON.stringify({ code }),
    signal,
  });
  return handleLocalAgentJson<LocalAgentMebbisSessionResponse>(response);
}

export async function stopLocalAgentMebbisSession(
  signal?: AbortSignal
): Promise<LocalAgentMebbisSessionResponse> {
  const response = await fetch(getLocalAgentUrl("/mebbis/session/stop"), {
    method: "POST",
    headers: buildLocalAgentHeaders(true),
    body: JSON.stringify({}),
    signal,
  });
  return handleLocalAgentJson<LocalAgentMebbisSessionResponse>(response);
}

export async function listLocalAgentScanners(signal?: AbortSignal): Promise<LocalAgentScannerResponse[]> {
  const response = await getLocalAgentJson<LocalAgentScannerListResponse>("/scanners", signal);
  return response.scanners;
}

export async function addLocalAgentManualScanner(
  host: string,
  signal?: AbortSignal
): Promise<LocalAgentScannerResponse> {
  const response = await fetch(getLocalAgentUrl("/scanners/manual"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host }),
    signal,
  });
  return handleLocalAgentJson<LocalAgentScannerResponse>(response);
}

export async function createLocalAgentScanJob(
  scannerId: string,
  settings: LocalAgentScanSettings,
  signal?: AbortSignal
): Promise<CreateLocalAgentScanJobResponse> {
  const response = await fetch(getLocalAgentUrl("/scan-jobs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scannerId, settings }),
    signal,
  });
  return handleLocalAgentJson<CreateLocalAgentScanJobResponse>(response);
}

export async function getLocalAgentScanJob(
  jobId: string,
  signal?: AbortSignal
): Promise<LocalAgentScanJobResponse> {
  return getLocalAgentJson<LocalAgentScanJobResponse>(`/scan-jobs/${encodeURIComponent(jobId)}`, signal);
}

export async function getLocalAgentScanJobResult(jobId: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(getLocalAgentUrl(`/scan-jobs/${encodeURIComponent(jobId)}/result`), {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new LocalAgentError(`LocalAgent result error ${response.status}`, response.status);
  }
  return response.blob();
}

async function getLocalAgentJson<T>(path: string, signal?: AbortSignal, includeToken = false): Promise<T> {
  const response = await fetch(getLocalAgentUrl(path), {
    cache: "no-store",
    headers: includeToken ? buildLocalAgentHeaders(false) : undefined,
    signal,
  });
  return handleLocalAgentJson<T>(response);
}

function buildLocalAgentHeaders(json: boolean): HeadersInit {
  const headers = new Headers();
  if (json) headers.set("Content-Type", "application/json");
  const token = readStoredLocalAgentToken();
  if (token) headers.set("X-Pilot-Local-Agent-Token", token);
  return headers;
}

async function handleLocalAgentJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `LocalAgent error ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the status-based fallback.
    }
    throw new LocalAgentError(message, response.status);
  }
  return response.json() as Promise<T>;
}

const LOCAL_AGENT_SCANNER_SETTINGS_KEY = "pilot.localAgent.scannerSettings";
const LOCAL_AGENT_TOKEN_KEY = "pilot.localAgent.token";

export function readStoredLocalAgentScannerSettings(): StoredLocalAgentScannerSettings | null {
  try {
    const raw = localStorage.getItem(LOCAL_AGENT_SCANNER_SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredLocalAgentScannerSettings;
  } catch {
    return null;
  }
}

export function writeStoredLocalAgentScannerSettings(settings: StoredLocalAgentScannerSettings): void {
  try {
    localStorage.setItem(LOCAL_AGENT_SCANNER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage may be unavailable; scanning should still work for this session.
  }
}

export function readStoredLocalAgentToken(): string | null {
  try {
    return localStorage.getItem(LOCAL_AGENT_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeStoredLocalAgentToken(token: string): void {
  try {
    localStorage.setItem(LOCAL_AGENT_TOKEN_KEY, token);
  } catch {
    // localStorage may be unavailable; pairing can run again next time.
  }
}
