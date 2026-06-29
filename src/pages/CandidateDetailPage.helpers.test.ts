import { describe, expect, it } from "vitest";

import {
  candidateHasExistingLicense,
  canRetryMebbisDocumentTransfer,
  hasExistingLicenseValue,
} from "./CandidateDetailPage.helpers";

describe("CandidateDetailPage helpers", () => {
  it("detects existing license from either flag or license type", () => {
    expect(candidateHasExistingLicense({ hasExistingLicense: true, existingLicenseType: null })).toBe(true);
    expect(candidateHasExistingLicense({ hasExistingLicense: false, existingLicenseType: "B" })).toBe(true);
    expect(candidateHasExistingLicense({ hasExistingLicense: false, existingLicenseType: "Yok" })).toBe(false);
    expect(candidateHasExistingLicense({ hasExistingLicense: undefined, existingLicenseType: "A1" })).toBe(true);
  });

  it("ignores empty existing license placeholders", () => {
    expect(hasExistingLicenseValue("")).toBe(false);
    expect(hasExistingLicenseValue("-")).toBe(false);
    expect(hasExistingLicenseValue("none")).toBe(false);
    expect(hasExistingLicenseValue("exempt")).toBe(false);
  });

  it("allows MEBBIS job document transfer retry even after it was marked transferred", () => {
    expect(canRetryMebbisDocumentTransfer("biometric_photo", true)).toBe(true);
    expect(canRetryMebbisDocumentTransfer("education_certificate", true)).toBe(true);
    expect(canRetryMebbisDocumentTransfer("identity_copy", true)).toBe(false);
    expect(canRetryMebbisDocumentTransfer("identity_copy", false)).toBe(true);
  });
});
