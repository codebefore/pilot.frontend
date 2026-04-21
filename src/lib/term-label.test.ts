import { describe, expect, it } from "vitest";

import { buildGroupHeading, buildTermLabel, pickDefaultTermId } from "./term-label";

describe("pickDefaultTermId", () => {
  it("prefers the current month term over a newer future term", () => {
    const terms = [
      {
        id: "may-1",
        monthDate: "2026-05-01",
        sequence: 1,
        name: null,
      },
      {
        id: "apr-2",
        monthDate: "2026-04-01",
        sequence: 2,
        name: "EK DÖNEM",
      },
      {
        id: "apr-1",
        monthDate: "2026-04-01",
        sequence: 1,
        name: null,
      },
    ];

    expect(pickDefaultTermId(terms, new Date("2026-04-15T12:00:00Z"))).toBe("apr-2");
  });

  it("falls back to the newest term when the current month has no term", () => {
    const terms = [
      {
        id: "may-1",
        monthDate: "2026-05-01",
        sequence: 1,
        name: null,
      },
      {
        id: "mar-1",
        monthDate: "2026-03-01",
        sequence: 1,
        name: null,
      },
    ];

    expect(pickDefaultTermId(terms, new Date("2026-04-15T12:00:00Z"))).toBe("may-1");
  });
});

describe("buildGroupHeading", () => {
  const aprilTerm = {
    id: "apr-1",
    monthDate: "2026-04-01",
    sequence: 1,
    name: null,
  };

  it("renders legacy code titles with month first", () => {
    expect(buildGroupHeading("1A", aprilTerm, [aprilTerm], "tr")).toBe("NİSAN 2026 - 1A");
  });

  it("keeps stored month-first code titles stable", () => {
    expect(buildGroupHeading("NİSAN 2026 - 1A", aprilTerm, [aprilTerm], "tr")).toBe(
      "NİSAN 2026 - 1A"
    );
  });

  it("does not collapse custom titles that only start with a code-looking prefix", () => {
    expect(buildGroupHeading("1C Sinifi - NİSAN 2026", aprilTerm, [aprilTerm], "tr")).toBe(
      "1C Sinifi — NİSAN 2026"
    );
  });

  it("renders supplemental terms with sequence suffix", () => {
    const supplementalAprilTerm = {
      id: "apr-2",
      monthDate: "2026-04-01",
      sequence: 2,
      name: null,
    };

    expect(buildTermLabel(supplementalAprilTerm, [aprilTerm, supplementalAprilTerm], "tr")).toBe(
      "NİSAN 2026 / 2"
    );
    expect(
      buildGroupHeading("1A", supplementalAprilTerm, [aprilTerm, supplementalAprilTerm], "tr")
    ).toBe("NİSAN 2026 / 2 - 1A");
  });
});
