import { describe, expect, it } from "vitest";

import { formatNationalId } from "./national-id";

describe("formatNationalId", () => {
  it("groups an 11-digit value as XXX XXX XXX XX", () => {
    expect(formatNationalId("12345678901")).toBe("123 456 789 01");
  });

  it("strips non-digit characters before grouping", () => {
    expect(formatNationalId("123-456-789 01")).toBe("123 456 789 01");
  });

  it("returns the placeholder for null / undefined / empty", () => {
    expect(formatNationalId(null)).toBe("—");
    expect(formatNationalId(undefined)).toBe("—");
    expect(formatNationalId("")).toBe("—");
  });

  it("returns the input as-is when digit count is not 11", () => {
    expect(formatNationalId("123")).toBe("123");
    expect(formatNationalId("123456789012")).toBe("123456789012");
  });
});
