import { describe, expect, it } from "vitest";

import { countActiveCandidateFilters, EMPTY_CANDIDATE_FILTERS } from "./candidate-filters";

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
});
