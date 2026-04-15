import { describe, expect, it } from "vitest";

import { pickDefaultTermId } from "./term-label";

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
        name: "Ek Donem",
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
