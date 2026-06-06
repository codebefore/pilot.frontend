import { describe, expect, it } from "vitest";

import { buildCandidateUpdatePayload } from "./candidate-bulk";
import type { CandidateResponse } from "./types";

describe("buildCandidateUpdatePayload", () => {
  it("preserves license rule identity for bulk updates", () => {
    const candidate = {
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "12345678910",
      referenceName: null,
      phoneNumber: null,
      birthDate: null,
      gender: null,
      licenseClass: "C",
      licenseClassDefinitionId: "rule-b-to-c",
      hasExistingLicense: true,
      existingLicenseType: "B",
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "pre_registered",
      rowVersion: 3,
    } as CandidateResponse;

    const payload = buildCandidateUpdatePayload(candidate, { status: "active" });

    expect(payload.status).toBe("active");
    expect(payload.licenseClassDefinitionId).toBe("rule-b-to-c");
    expect(payload.hasExistingLicense).toBe(true);
    expect(payload.existingLicenseType).toBe("B");
  });
});
