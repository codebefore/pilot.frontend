import { describe, expect, it } from "vitest";

import {
  candidateHasExistingLicense,
  calculateLicenseContractTotal,
  canRetryMebbisDocumentTransfer,
  hasExistingLicenseValue,
  isPenaltyPointsLicenseClass,
  parseTurkishMoneyInput,
  shouldShowEmptyLicenseFeeWarning,
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

  it("shows the license fee warning only when every default fee is empty", () => {
    const emptyProgram = { courseFee: null, mebbisFee: null, failureRetryFee: null, privateLessonFee: null };
    const emptyTheory = { institutionTheoryExamFee: null, contractTheoryExamFee: null, vatIncludedHourlyRate: null };
    const emptyPractice = { institutionPracticeExamFee: null, contractPracticeExamFee: null, vatIncludedHourlyRate: null };
    expect(shouldShowEmptyLicenseFeeWarning(undefined, undefined, undefined)).toBe(true);
    expect(shouldShowEmptyLicenseFeeWarning(
      emptyProgram,
      emptyTheory,
      emptyPractice
    )).toBe(true);
    expect(shouldShowEmptyLicenseFeeWarning(
      { ...emptyProgram, courseFee: 0 },
      emptyTheory,
      emptyPractice
    )).toBe(false);
    expect(shouldShowEmptyLicenseFeeWarning(
      emptyProgram,
      emptyTheory,
      { ...emptyPractice, institutionPracticeExamFee: 1500 }
    )).toBe(false);
  });

  it("calculates the contract total from lesson hours and VAT-included hourly rates", () => {
    expect(calculateLicenseContractTotal(
      { lessonHours: 34 },
      { lessonHours: 14 },
      100,
      200
    )).toBe(6200);
    expect(calculateLicenseContractTotal(undefined, undefined, null, null)).toBeNull();
    expect(calculateLicenseContractTotal({ lessonHours: 34 }, undefined, 0, null)).toBe(0);
  });

  it("parses Turkish money input without confusing thousands and decimals", () => {
    expect(parseTurkishMoneyInput("")).toBeNull();
    expect(parseTurkishMoneyInput("0")).toBe(0);
    expect(parseTurkishMoneyInput("1.250")).toBe(1250);
    expect(parseTurkishMoneyInput("12.500,75")).toBe(12500.75);
    expect(parseTurkishMoneyInput("1250.50")).toBe(1250.5);
    expect(parseTurkishMoneyInput("1 250,50")).toBe(1250.5);
    expect(parseTurkishMoneyInput("1,2,3")).toBeNull();
    expect(parseTurkishMoneyInput("-10")).toBeNull();
  });
});
