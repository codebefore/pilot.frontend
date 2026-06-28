import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl, formatPhoneDisplay, isPhoneStartingWith5 } from "./phone";

describe("isPhoneStartingWith5", () => {
  it("accepts values starting with 5", () => {
    expect(isPhoneStartingWith5("5073737262")).toBe(true);
    expect(isPhoneStartingWith5("  5073737262")).toBe(true);
    expect(isPhoneStartingWith5("5")).toBe(true);
  });

  it("rejects empty or non-5 starting values", () => {
    expect(isPhoneStartingWith5("")).toBe(false);
    expect(isPhoneStartingWith5(null)).toBe(false);
    expect(isPhoneStartingWith5(undefined)).toBe(false);
    expect(isPhoneStartingWith5("0507")).toBe(false);
    expect(isPhoneStartingWith5("+90")).toBe(false);
  });
});

describe("buildWhatsAppUrl", () => {
  it("builds wa.me link for a Turkish mobile number regardless of input format", () => {
    expect(buildWhatsAppUrl("5551234567")).toBe("https://wa.me/905551234567");
    expect(buildWhatsAppUrl("0 555 123 45 67")).toBe("https://wa.me/905551234567");
    expect(buildWhatsAppUrl("+90 555 123 45 67")).toBe("https://wa.me/905551234567");
  });

  it("returns null for non-mobile or invalid numbers", () => {
    expect(buildWhatsAppUrl("0 312 000 00 00")).toBeNull();
    expect(buildWhatsAppUrl("555")).toBeNull();
    expect(buildWhatsAppUrl(null)).toBeNull();
    expect(buildWhatsAppUrl("")).toBeNull();
  });
});

describe("formatPhoneDisplay", () => {
  it("formats Turkish phone numbers for display", () => {
    expect(formatPhoneDisplay("5551234567")).toBe("+90 555 123 45 67");
    expect(formatPhoneDisplay("0 555 123 45 67")).toBe("+90 555 123 45 67");
    expect(formatPhoneDisplay("+90 555 123 45 67")).toBe("+90 555 123 45 67");
    expect(formatPhoneDisplay("3120000000")).toBe("+90 312 000 00 00");
  });

  it("preserves non-matching values and uses fallback for empty values", () => {
    expect(formatPhoneDisplay("555")).toBe("555");
    expect(formatPhoneDisplay(null)).toBe("—");
    expect(formatPhoneDisplay("", "-")).toBe("-");
  });
});
