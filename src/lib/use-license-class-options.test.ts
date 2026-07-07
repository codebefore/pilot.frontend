import { describe, expect, it } from "vitest";

import { getLicenseClassOptionsFromDefinitions } from "./use-license-class-options";
import type { LicenseClassDefinitionResponse } from "./types";

function definition(
  code: string,
  displayOrder: number,
  existingLicenseType: string | null = null
): LicenseClassDefinitionResponse {
  return {
    id: `def-${code}-${existingLicenseType ?? "base"}`,
    code,
    name: code,
    minimumAge: 18,
    theoryHours: 0,
    practiceHours: 0,
    simulatorHours: 0,
    fee: 0,
    displayOrder,
    isActive: true,
    existingLicenseType,
    existingLicensePre2016: false,
    createdAtUtc: "2026-07-01T00:00:00Z",
    updatedAtUtc: "2026-07-01T00:00:00Z",
    rowVersion: 1,
  };
}

describe("getLicenseClassOptionsFromDefinitions", () => {
  it("keeps target license classes that are defined through an existing-license rule", () => {
    const options = getLicenseClassOptionsFromDefinitions([
      definition("B", 10),
      definition("B-OTOMATIK", 20, "B"),
    ]);

    expect(options.map((option) => option.value)).toEqual(["B", "B-OTOMATIK"]);
  });
});
