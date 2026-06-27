import { describe, expect, it } from "vitest";

import { formatNationalId } from "./national-id";

describe("formatNationalId", () => {
  it("returns an 11-digit value as-is", () => {
    expect(formatNationalId("12345678901")).toBe("12345678901");
  });

  it("does not normalize already formatted input", () => {
    expect(formatNationalId("123-456-789 01")).toBe("123-456-789 01");
  });

  it("returns the placeholder for null / undefined / empty", () => {
    expect(formatNationalId(null)).toBe("—");
    expect(formatNationalId(undefined)).toBe("—");
    expect(formatNationalId("")).toBe("—");
  });

  it("returns other input as-is", () => {
    expect(formatNationalId("123")).toBe("123");
    expect(formatNationalId("123456789012")).toBe("123456789012");
  });
});
