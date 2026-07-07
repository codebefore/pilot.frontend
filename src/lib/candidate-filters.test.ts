import { describe, expect, it } from "vitest";

import { countActiveCandidateFilters, EMPTY_CANDIDATE_FILTERS, filtersToQuery } from "./candidate-filters";

describe("countActiveCandidateFilters", () => {
  it("ignores single-character text filters that are dropped from the query", () => {
    expect(
      countActiveCandidateFilters({
        ...EMPTY_CANDIDATE_FILTERS,
        firstName: "A",
      })
    ).toBe(0);
  });

  it("counts effective text and non-text filters", () => {
    expect(
      countActiveCandidateFilters({
        ...EMPTY_CANDIDATE_FILTERS,
        firstName: "Ay",
        hasPhoto: "true",
      })
    ).toBe(2);
  });

  it("maps exam result filters to backend query params", () => {
    expect(
      filtersToQuery({
        ...EMPTY_CANDIDATE_FILTERS,
        hasExamResult: "true",
        mebExamResult: "passed",
      })
    ).toMatchObject({
      hasExamResult: true,
      mebExamResult: "passed",
    });
  });

  it("maps exam status and numeric ranges to backend query params", () => {
    expect(
      filtersToQuery({
        ...EMPTY_CANDIDATE_FILTERS,
        examStatus: ["e_sinav_havuz", "direksiyon_basarisiz", "direksiyon_basarili"],
        examAttemptCount: ["e_sinav_2", "direksiyon_3"],
        totalFeeMin: "1000",
        totalFeeMax: "5000",
        totalPaidMin: "300",
        totalDebtMax: "2500",
      })
    ).toMatchObject({
      examStatus: ["e_sinav_havuz", "direksiyon_basarisiz", "direksiyon_basarili"],
      examAttemptCount: ["e_sinav_2", "direksiyon_3"],
      totalFeeMin: 1000,
      totalFeeMax: 5000,
      totalPaidMin: 300,
      totalDebtMax: 2500,
    });
  });

  it("does not send legacy term-only filters to candidate queries", () => {
    expect(
      filtersToQuery({
        ...EMPTY_CANDIDATE_FILTERS,
        termIds: ["term-1"],
        groupIds: ["group-1"],
      })
    ).toMatchObject({
      termIds: undefined,
      groupIds: ["group-1"],
    });
  });
});
