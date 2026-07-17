import { beforeEach, describe, expect, it } from "vitest";

import {
  RECEIPT_PRINT_PROFILE_STORAGE_KEY,
  readReceiptPrintProfileId,
} from "./receipt-print-settings";

describe("receipt print settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("prefers the institution profile over the browser fallback", () => {
    localStorage.setItem(RECEIPT_PRINT_PROFILE_STORAGE_KEY, "a4");

    expect(readReceiptPrintProfileId("a4-landscape-2up")).toBe("a4-landscape-2up");
  });

  it("uses the browser profile when an institution profile is unavailable", () => {
    localStorage.setItem(RECEIPT_PRINT_PROFILE_STORAGE_KEY, "thermal-80");

    expect(readReceiptPrintProfileId(null)).toBe("thermal-80");
  });
});
