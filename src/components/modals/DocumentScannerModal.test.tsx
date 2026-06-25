import { describe, expect, it } from "vitest";

import { supportedResolutions } from "./DocumentScannerModal";

describe("DocumentScannerModal resolution defaults", () => {
  it("uses 400 dpi only as the hidden placeholder when scanner resolutions are unknown", () => {
    expect(supportedResolutions(null)).toEqual([400]);
  });

  it("sorts and de-duplicates scanner resolution options", () => {
    expect(supportedResolutions({ resolutions: [300, 150, 150, 0, 200] })).toEqual([150, 200, 300]);
  });
});
