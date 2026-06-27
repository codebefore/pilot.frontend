import { describe, expect, it } from "vitest";

import { scannerConnectionKind, supportedResolutions } from "./DocumentScannerModal";
import type { LocalAgentScannerResponse } from "../../lib/local-agent-api";

function createScanner(overrides: Partial<LocalAgentScannerResponse>): LocalAgentScannerResponse {
  return {
    scannerId: "escl:test-scanner",
    name: "Test Scanner",
    manufacturer: null,
    model: null,
    serviceTypes: [],
    hostName: null,
    advertisedPort: null,
    preferredServiceType: null,
    state: "Idle",
    available: true,
    supportsScan: true,
    supportsJpeg: true,
    supportsPdf: false,
    resolutions: [300],
    colorModes: ["RGB24"],
    supportsFlatbed: true,
    supportsFeeder: false,
    error: null,
    provider: null,
    source: null,
    ...overrides,
  };
}

describe("DocumentScannerModal resolution defaults", () => {
  it("uses 400 dpi only as the hidden placeholder when scanner resolutions are unknown", () => {
    expect(supportedResolutions(null)).toEqual([400]);
  });

  it("sorts and de-duplicates scanner resolution options", () => {
    expect(supportedResolutions({ resolutions: [300, 150, 150, 0, 200] })).toEqual([150, 200, 300]);
  });
});

describe("DocumentScannerModal scanner connection kind", () => {
  it("treats host-backed WIA scanners as Wi-Fi instead of USB", () => {
    expect(scannerConnectionKind(createScanner({
      scannerId: "wia:{scanner-id}",
      provider: "wia",
      source: "wia",
      hostName: "BRWACF23C0E9C4B.local.",
    }))).toBe("wifi");
  });

  it("does not treat WIA by itself as a USB connection", () => {
    expect(scannerConnectionKind(createScanner({
      scannerId: "wia:{scanner-id}",
      provider: "wia",
      source: "wia",
    }))).toBeNull();
  });

  it("treats WIA-reported WSD scanners as Wi-Fi even when their id contains USB", () => {
    expect(scannerConnectionKind(createScanner({
      scannerId: "wia:usb\\vid_04f9&pid_042b",
      name: "WSD Scan Device",
      provider: "wia",
      source: "wia",
    }))).toBe("wifi");
  });

  it("recognizes Bonjour scanner services as Wi-Fi", () => {
    expect(scannerConnectionKind(createScanner({
      preferredServiceType: "_scanner._tcp",
      serviceTypes: ["_scanner._tcp", "_uscan._tcp"],
    }))).toBe("wifi");
  });

  it("shows USB for WIA scanner ids that contain an explicit USB path", () => {
    expect(scannerConnectionKind(createScanner({
      scannerId: "wia:usb\\vid_04f9&pid_042b",
      provider: "wia",
      source: "wia",
    }))).toBe("usb");
  });

  it("shows USB when the scanner source explicitly reports USB", () => {
    expect(scannerConnectionKind(createScanner({
      scannerId: "usb:test-scanner",
      provider: "usb",
      source: "usb",
    }))).toBe("usb");
  });
});
