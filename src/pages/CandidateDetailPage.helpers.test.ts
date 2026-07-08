import { describe, expect, it } from "vitest";

import {
  candidateHasExistingLicense,
  canRetryMebbisDocumentTransfer,
  hasExistingLicenseValue,
  isPenaltyPointsLicenseClass,
  shouldShowMebbisDocumentTransferAction,
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

  it("detects 100CP penalty point license class across common formats", () => {
    expect(isPenaltyPointsLicenseClass("100CP")).toBe(true);
    expect(isPenaltyPointsLicenseClass("100 cp")).toBe(true);
    expect(isPenaltyPointsLicenseClass("100-CP")).toBe(true);
    expect(isPenaltyPointsLicenseClass("100_CP")).toBe(true);
    expect(isPenaltyPointsLicenseClass("100 ceza puanı")).toBe(true);
    expect(isPenaltyPointsLicenseClass("B")).toBe(false);
    expect(isPenaltyPointsLicenseClass(null)).toBe(false);
  });

  it("allows MEBBIS job document transfer retry even after it was marked transferred", () => {
    expect(canRetryMebbisDocumentTransfer("biometric_photo", true)).toBe(true);
    expect(canRetryMebbisDocumentTransfer("webcam_photo", true)).toBe(true);
    expect(canRetryMebbisDocumentTransfer("signature_sample", true)).toBe(true);
    expect(canRetryMebbisDocumentTransfer("contract_front", true)).toBe(true);
    expect(canRetryMebbisDocumentTransfer("contract_back", true)).toBe(true);
    expect(canRetryMebbisDocumentTransfer("education_certificate", true)).toBe(true);
    expect(canRetryMebbisDocumentTransfer("criminal_record", true)).toBe(true);
    expect(canRetryMebbisDocumentTransfer("identity_copy", true)).toBe(false);
    expect(canRetryMebbisDocumentTransfer("identity_copy", false)).toBe(true);
  });

  it("shows a single transfer action for two-sided contract upload", () => {
    expect(shouldShowMebbisDocumentTransferAction("contract_front")).toBe(true);
    expect(shouldShowMebbisDocumentTransferAction("contract_back")).toBe(false);
    expect(shouldShowMebbisDocumentTransferAction("health_report")).toBe(true);
  });
});
