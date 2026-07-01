import { describe, expect, it } from "vitest";

import { normalizeSearchComparable, normalizeTextQuery } from "./search";

describe("search helpers", () => {
  it.each([
    ["IŞIK", "isik"],
    ["ışık", "isik"],
    ["İSMAİL", "ismail"],
    ["GÜNEŞ", "gunes"],
    ["AĞUSTOS", "agustos"],
    ["DÖNEM", "donem"],
    ["Çağrı Şen", "cagri sen"],
  ])("normalizes %s for comparable search", (value, expected) => {
    expect(normalizeSearchComparable(value)).toBe(expected);
  });

  it("keeps normalizeTextQuery limited to trim and minimum length", () => {
    expect(normalizeTextQuery(" ağ ")).toBe("ağ");
    expect(normalizeTextQuery(" a ")).toBeUndefined();
  });
});
