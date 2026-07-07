export const MEBBIS_LIVE_VIEW_STORAGE_KEY = "pilot.mebbis.liveView";

export function readMebbisLiveViewEnabled(): boolean {
  try {
    return window.localStorage.getItem(MEBBIS_LIVE_VIEW_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeMebbisLiveViewEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(MEBBIS_LIVE_VIEW_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Keep the UI usable when storage is unavailable; the setting remains session-local.
  }
}
