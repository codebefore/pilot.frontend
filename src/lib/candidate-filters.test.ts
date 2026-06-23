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
});
