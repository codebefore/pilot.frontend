import type { JobStatus } from "../types";

export type PaymentMethod = "Nakit" | "Havale" | "Kredi Kartı";

export type Payment = {
  id: string;
  date: string;
  candidate: string;
  amount: number;
  method: PaymentMethod;
  receiptStatus: JobStatus;
  receiptLabel: string;
};

export const mockPayments: Payment[] = [
  {
    id: "p1",
    date: "07.04.2026",
    candidate: "Emre Şahin",
    amount: 2400,
    method: "Nakit",
    receiptStatus: "success",
    receiptLabel: "Kesildi",
  },
  {
    id: "p2",
    date: "07.04.2026",
    candidate: "Ahmet Yılmaz",
    amount: 2400,
    method: "Havale",
    receiptStatus: "queued",
    receiptLabel: "Bekliyor",
  },
  {
    id: "p3",
    date: "06.04.2026",
    candidate: "Mustafa Öztürk",
    amount: 3600,
    method: "Kredi Kartı",
    receiptStatus: "success",
    receiptLabel: "Kesildi",
  },
  {
    id: "p4",
    date: "05.04.2026",
    candidate: "Zeynep Kara",
    amount: 4800,
    method: "Nakit",
    receiptStatus: "success",
    receiptLabel: "Kesildi",
  },
];

export type PaymentSummaryTone = "brand" | "red" | "blue";

export type PaymentSummary = {
  label: string;
  value: string;
  tone: PaymentSummaryTone;
};

export const paymentSummary: PaymentSummary[] = [
  { label: "Bu Ay Tahsilat",  value: "127.400 TL",  tone: "brand" },
  { label: "Toplam Bakiye",   value: "-38.600 TL", tone: "red" },
  { label: "Bekleyen Makbuz", value: "4",          tone: "blue" },
];

const amountFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 0,
  signDisplay: "always",
});

export function formatPaymentAmount(tl: number): string {
  return `${amountFormatter.format(tl)} TL`;
}
