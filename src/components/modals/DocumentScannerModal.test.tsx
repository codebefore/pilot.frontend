import { describe, expect, it } from "vitest";

import { pickScannerResolution, supportedResolutions } from "./DocumentScannerModal";

describe("DocumentScannerModal resolution defaults", () => {
  it("prefers 150 dpi when the scanner supports it", () => {
    expect(pickScannerResolution({ resolutions: [300, 150, 200] })).toBe(150);
  });

  it("falls back to 200 dpi when 150 dpi is unavailable", () => {
    expect(pickScannerResolution({ resolutions: [300, 200, 600] })).toBe(200);
  });

  it("uses the lowest supported scanner resolution when 150 and 200 dpi are unavailable", () => {
    expect(pickScannerResolution({ resolutions: [600, 300, 100] })).toBe(100);
  });

  it("does not let an old high dpi stored setting override the compact default", () => {
    expect(pickScannerResolution({ resolutions: [150, 200, 300] }, 300)).toBe(150);
  });

  it("keeps a compact stored setting when the scanner still supports it", () => {
    expect(pickScannerResolution({ resolutions: [150, 200, 300] }, 200)).toBe(200);
  });

  it("sorts and de-duplicates scanner resolution options", () => {
    expect(supportedResolutions({ resolutions: [300, 150, 150, 0, 200] })).toEqual([150, 200, 300]);
  });
});
