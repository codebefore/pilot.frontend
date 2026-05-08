import { describe, expect, it } from "vitest";

import {
  buildWhatsAppUrl,
  formatPhoneInput,
  formatPhoneNumber,
  isValidTurkishMobilePhoneNumber,
  isValidTurkishPhoneNumber,
  normalizePhoneForSubmit,
} from "./phone";

describe("phone helpers", () => {
  it("formats Turkish phone input as the user types", () => {
    expect(formatPhoneInput("5551234567")).toBe("0 555 123 45 67");
    expect(formatPhoneInput("05551234567")).toBe("0 555 123 45 67");
    expect(formatPhoneInput("+90 555 123 45 67")).toBe("0 555 123 45 67");
    expect(formatPhoneInput("55512")).toBe("0 555 12");
  });

  it("normalizes valid phone numbers to local ten digits", () => {
    expect(normalizePhoneForSubmit("0 555 123 45 67")).toBe("5551234567");
    expect(normalizePhoneForSubmit("+90 312 000 00 00")).toBe("3120000000");
    expect(normalizePhoneForSubmit("555")).toBeNull();
  });

  it("validates landline and mobile phone numbers", () => {
    expect(isValidTurkishPhoneNumber("0 312 000 00 00")).toBe(true);
    expect(isValidTurkishMobilePhoneNumber("0 312 000 00 00")).toBe(false);
    expect(isValidTurkishMobilePhoneNumber("0 555 123 45 67")).toBe(true);
  });

  it("keeps display and WhatsApp formatting compatible", () => {
    expect(formatPhoneNumber("5551234567")).toBe("0 555 123 45 67");
    expect(buildWhatsAppUrl("0 555 123 45 67")).toBe("https://wa.me/905551234567");
    expect(buildWhatsAppUrl("0 312 000 00 00")).toBeNull();
  });
});
