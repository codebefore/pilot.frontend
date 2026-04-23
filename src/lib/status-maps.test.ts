import { describe, expect, it } from "vitest";

import {
  CANDIDATE_GENDER_OPTIONS,
  candidateGenderLabel,
  candidateExamResultLabel,
  candidateMebSyncStatusLabel,
  normalizeCandidateExamResultValue,
  normalizeCandidateMebSyncStatusValue,
  normalizeCandidateGender,
} from "./status-maps";

describe("normalizeCandidateGender", () => {
  it("returns canonical English values unchanged", () => {
    expect(normalizeCandidateGender("female")).toBe("female");
    expect(normalizeCandidateGender("male")).toBe("male");
    expect(normalizeCandidateGender("unspecified")).toBe("unspecified");
  });

  it("maps Turkish legacy aliases to canonical English", () => {
    expect(normalizeCandidateGender("kadın")).toBe("female");
    expect(normalizeCandidateGender("kadin")).toBe("female");
    expect(normalizeCandidateGender("erkek")).toBe("male");
    expect(normalizeCandidateGender("seçilmemiş")).toBe("unspecified");
    expect(normalizeCandidateGender("secilmemis")).toBe("unspecified");
    expect(normalizeCandidateGender("belirsiz")).toBe("unspecified");
  });

  it("maps legacy numeric codes to canonical English", () => {
    expect(normalizeCandidateGender("0")).toBe("female");
    expect(normalizeCandidateGender("1")).toBe("male");
    expect(normalizeCandidateGender("-1")).toBe("unspecified");
  });

  it("is case / whitespace / accent tolerant via Turkish locale lowercasing", () => {
    expect(normalizeCandidateGender("  KADIN  ")).toBe("female");
    expect(normalizeCandidateGender("Erkek")).toBe("male");
    expect(normalizeCandidateGender("FEMALE")).toBe("female");
  });

  it("returns null for empty, null, undefined, or unknown input", () => {
    expect(normalizeCandidateGender(null)).toBeNull();
    expect(normalizeCandidateGender(undefined)).toBeNull();
    expect(normalizeCandidateGender("")).toBeNull();
    expect(normalizeCandidateGender("   ")).toBeNull();
    expect(normalizeCandidateGender("robot")).toBeNull();
    expect(normalizeCandidateGender("42")).toBeNull();
  });
});

describe("candidateGenderLabel", () => {
  it("returns the Turkish display label for canonical values", () => {
    expect(candidateGenderLabel("female")).toBe("Kadın");
    expect(candidateGenderLabel("male")).toBe("Erkek");
    expect(candidateGenderLabel("unspecified")).toBe("Seçilmemiş");
  });

  it("returns the Turkish display label for legacy values via normalization", () => {
    expect(candidateGenderLabel("kadın")).toBe("Kadın");
    expect(candidateGenderLabel("erkek")).toBe("Erkek");
    expect(candidateGenderLabel("0")).toBe("Kadın");
  });

  it("returns an empty string for null/unknown so the caller can render —", () => {
    expect(candidateGenderLabel(null)).toBe("");
    expect(candidateGenderLabel(undefined)).toBe("");
    expect(candidateGenderLabel("")).toBe("");
    expect(candidateGenderLabel("robot")).toBe("");
  });
});

describe("CANDIDATE_GENDER_OPTIONS", () => {
  it("exposes the three canonical values with Turkish labels, in stable order", () => {
    expect(CANDIDATE_GENDER_OPTIONS).toEqual([
      { value: "female", label: "Kadın" },
      { value: "male", label: "Erkek" },
      { value: "unspecified", label: "Seçilmemiş" },
    ]);
  });
});

describe("normalizeCandidateMebSyncStatusValue", () => {
  it("maps Turkish and canonical variants to sync status values", () => {
    expect(normalizeCandidateMebSyncStatusValue("SENKRONIZE")).toBe("synced");
    expect(normalizeCandidateMebSyncStatusValue("Beklemede")).toBe("not_synced");
    expect(normalizeCandidateMebSyncStatusValue("not_synced")).toBe("not_synced");
  });
});

describe("candidateMebSyncStatusLabel", () => {
  it("renders sync labels for canonical and Turkish values", () => {
    expect(candidateMebSyncStatusLabel("synced")).toBe("Senkronize");
    expect(candidateMebSyncStatusLabel("Beklemede")).toBe("Beklemede");
  });
});

describe("normalizeCandidateExamResultValue", () => {
  it("maps Turkish and ASCII variants to canonical values", () => {
    expect(normalizeCandidateExamResultValue("BAŞARISIZ")).toBe("failed");
    expect(normalizeCandidateExamResultValue("BASARISIZ")).toBe("failed");
    expect(normalizeCandidateExamResultValue("BAŞARILI")).toBe("passed");
  });
});

describe("candidateExamResultLabel", () => {
  it("renders canonical labels for exam results", () => {
    expect(candidateExamResultLabel("başarisiz")).toBe("Başarısız");
    expect(candidateExamResultLabel("BAŞARILI")).toBe("Başarılı");
    expect(candidateExamResultLabel(null)).toBe("—");
  });
});
