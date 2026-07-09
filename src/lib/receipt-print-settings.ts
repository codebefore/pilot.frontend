export type ReceiptPrintProfileId = "a4" | "a4-landscape-2up" | "thermal-58" | "thermal-80";

export const RECEIPT_PRINT_PROFILE_STORAGE_KEY = "pilot.receipt.defaultPrintProfile";
export const DEFAULT_RECEIPT_PRINT_PROFILE_ID: ReceiptPrintProfileId = "a4";

export const RECEIPT_PRINT_PROFILE_OPTIONS: Array<{
  id: ReceiptPrintProfileId;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    id: "a4",
    labelKey: "settings.general.receiptPrintProfile.a4.label",
    descriptionKey: "settings.general.receiptPrintProfile.a4.description",
  },
  {
    id: "a4-landscape-2up",
    labelKey: "settings.general.receiptPrintProfile.a4Landscape2up.label",
    descriptionKey: "settings.general.receiptPrintProfile.a4Landscape2up.description",
  },
  {
    id: "thermal-58",
    labelKey: "settings.general.receiptPrintProfile.thermal58.label",
    descriptionKey: "settings.general.receiptPrintProfile.thermal58.description",
  },
  {
    id: "thermal-80",
    labelKey: "settings.general.receiptPrintProfile.thermal80.label",
    descriptionKey: "settings.general.receiptPrintProfile.thermal80.description",
  },
];

export function isReceiptPrintProfileId(value: string | null | undefined): value is ReceiptPrintProfileId {
  return RECEIPT_PRINT_PROFILE_OPTIONS.some((option) => option.id === value);
}

export function readReceiptPrintProfileId(): ReceiptPrintProfileId {
  try {
    const stored = window.localStorage.getItem(RECEIPT_PRINT_PROFILE_STORAGE_KEY);
    return isReceiptPrintProfileId(stored) ? stored : DEFAULT_RECEIPT_PRINT_PROFILE_ID;
  } catch {
    return DEFAULT_RECEIPT_PRINT_PROFILE_ID;
  }
}

export function writeReceiptPrintProfileId(profileId: ReceiptPrintProfileId): void {
  try {
    window.localStorage.setItem(RECEIPT_PRINT_PROFILE_STORAGE_KEY, profileId);
  } catch {
    // Printing can still use the in-memory selection for the current render.
  }
}
