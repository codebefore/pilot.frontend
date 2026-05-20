import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { ColumnPicker, type ColumnOption } from "../components/ui/ColumnPicker";
import { CustomSelect } from "../components/ui/CustomSelect";
import { LocalizedDateInput } from "../components/ui/LocalizedDateInput";
import { PageLoadError } from "../components/ui/PageLoadError";
import {
  TableHeaderFilter,
  type TableHeaderFilterOption,
} from "../components/ui/TableHeaderFilter";
import { getPaymentsOverview } from "../lib/payments-api";
import { formatDateTR } from "../lib/status-maps";
import { useLicenseClassOptions } from "../lib/use-license-class-options";
import type {
  CandidateAccountingType,
  PaymentCandidateSummaryResponse,
  PaymentInvoiceOverviewResponse,
  PaymentInstallmentOverviewResponse,
  PaymentMovementResponse,
  PaymentRefundMovementResponse,
  PaymentsOverviewResponse,
} from "../lib/types";

type DetailGroup = "movements" | "invoices" | "cashSummary" | "cashMovements";
type DetailTab =
  | "all"
  | "payment"
  | "refund"
  | "cancelled"
  | "installment"
  | "debt";
type DetailColumnId =
  | "photo"
  | "candidate"
  | "group"
  | "type"
  | "date"
  | "amount"
  | "method"
  | "cashRegister"
  | "description";
type DetailSortField = Exclude<DetailColumnId, "photo">;
type InvoiceColumnId =
  | "photo"
  | "candidate"
  | "group"
  | "invoiceNo"
  | "invoiceType"
  | "date"
  | "subtotal"
  | "vatRate"
  | "vatAmount"
  | "total"
  | "notes";
type InvoiceSortField = Exclude<InvoiceColumnId, "photo">;
type CashSummaryColumnId =
  | "name"
  | "balance"
  | "lastMovementDate"
  | "selectedInflow"
  | "selectedOutflow";
type CashSummarySortField = CashSummaryColumnId;
type CashMovementColumnId = "cashRegister" | "date" | "description" | "amount";
type CashMovementSortField = CashMovementColumnId;
type InstallmentColumnId =
  | "photo"
  | "candidate"
  | "group"
  | "licenseClass"
  | "type"
  | "dueDate"
  | "amount"
  | "description";
type InstallmentSortField = Exclude<InstallmentColumnId, "photo">;
type DebtColumnId =
  | "photo"
  | "candidate"
  | "group"
  | "licenseClass"
  | "kurs"
  | "teorikSinav"
  | "direksiyonSinav"
  | "diger"
  | "total";
type DebtSortField = Exclude<DebtColumnId, "photo">;
type PeriodStatsColumnId =
  | "licenseClass"
  | "count"
  | "revenue"
  | "average"
  | "collected"
  | "collectionRate";
type PeriodStatsSortField = PeriodStatsColumnId;
type SortDirection = "asc" | "desc";
type DetailSortState = { field: DetailSortField; direction: SortDirection };
type InvoiceSortState = { field: InvoiceSortField; direction: SortDirection };
type CashSummarySortState = {
  field: CashSummarySortField;
  direction: SortDirection;
};
type CashMovementSortState = {
  field: CashMovementSortField;
  direction: SortDirection;
};
type InstallmentSortState = {
  field: InstallmentSortField;
  direction: SortDirection;
};
type DebtSortState = {
  field: DebtSortField;
  direction: SortDirection;
};
type PeriodStatsSortState = {
  field: PeriodStatsSortField;
  direction: SortDirection;
};
type DetailColumnFilters = Partial<Record<DetailSortField, string>>;
type InvoiceColumnFilters = Partial<Record<InvoiceSortField, string>>;
type CashSummaryColumnFilters = Partial<Record<CashSummarySortField, string>>;
type CashMovementColumnFilters = Partial<Record<CashMovementSortField, string>>;
type InstallmentColumnFilters = Partial<Record<InstallmentSortField, string>>;
type DebtColumnFilters = Partial<Record<DebtSortField, string>>;
type PeriodStatsColumnFilters = Partial<Record<PeriodStatsSortField, string>>;
type PeriodStatsRow = {
  key: string;
  licenseClass: string;
  count: number;
  revenue: number;
  collected: number;
};
type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_7_days"
  | "last_30_days"
  | "custom";

const NO_CASH_REGISTER_KEY = "__no_cash_register__";

const PAYMENT_TYPE_ROWS: { key: CandidateAccountingType; label: string }[] = [
  { key: "kurs", label: "Kurs Ücreti" },
  { key: "teorik_sinav", label: "Teorik Sınav Ücreti" },
  { key: "direksiyon_sinav", label: "Direksiyon Sınav Ücreti" },
  { key: "diger", label: "Diğer Ücret" },
];

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "today", label: "Bugün" },
  { value: "yesterday", label: "Dün" },
  { value: "this_week", label: "Bu Hafta" },
  { value: "this_month", label: "Bu Ay" },
  { value: "last_month", label: "Geçen Ay" },
  { value: "this_year", label: "Bu Yıl" },
  { value: "last_7_days", label: "Son 7 Gün" },
  { value: "last_30_days", label: "Son 30 Gün" },
  { value: "custom", label: "Özel Aralık" },
];

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "payment", label: "Tahsilat" },
  { key: "refund", label: "İade" },
  { key: "cancelled", label: "İptal" },
  { key: "installment", label: "Vade" },
  { key: "debt", label: "Borçlar" },
];

const DETAIL_COLUMNS: {
  id: DetailColumnId;
  filterable?: boolean;
  label: string;
  sortable?: boolean;
  numeric?: boolean;
}[] = [
  { id: "photo", label: "Resim" },
  { id: "candidate", label: "Ad Soyad", sortable: true },
  { id: "group", label: "Dönem / Sınıf", sortable: true, filterable: true },
  { id: "type", label: "Ödeme Türü", sortable: true, filterable: true },
  { id: "date", label: "Tarih", sortable: true },
  { id: "amount", label: "Tutar", sortable: true, numeric: true },
  { id: "method", label: "Yöntem", sortable: true, filterable: true },
  { id: "cashRegister", label: "Kasa", sortable: true, filterable: true },
  { id: "description", label: "Açıklama", sortable: true },
];

const DEFAULT_DETAIL_COLUMNS = DETAIL_COLUMNS.map((column) => column.id);

const INVOICE_COLUMNS: {
  id: InvoiceColumnId;
  filterable?: boolean;
  label: string;
  sortable?: boolean;
  numeric?: boolean;
}[] = [
  { id: "photo", label: "Resim" },
  { id: "candidate", label: "Ad Soyad", sortable: true },
  { id: "group", label: "Dönem / Sınıf", sortable: true, filterable: true },
  { id: "invoiceNo", label: "Fatura No", sortable: true },
  { id: "invoiceType", label: "Fatura Tipi", sortable: true, filterable: true },
  { id: "date", label: "Tarih", sortable: true },
  { id: "subtotal", label: "Ara Toplam", sortable: true, numeric: true },
  { id: "vatRate", label: "KDV Oranı", sortable: true, numeric: true },
  { id: "vatAmount", label: "KDV Tutarı", sortable: true, numeric: true },
  { id: "total", label: "Toplam", sortable: true, numeric: true },
  { id: "notes", label: "Açıklama", sortable: true },
];

const CASH_SUMMARY_COLUMNS: {
  id: CashSummaryColumnId;
  filterable?: boolean;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
}[] = [
  { id: "name", label: "Kasa Adı", sortable: true, filterable: true },
  { id: "balance", label: "Bakiye", sortable: true, numeric: true },
  { id: "lastMovementDate", label: "Son Hareket Tarihi", sortable: true },
  {
    id: "selectedInflow",
    label: "Seçili Tarihte Giriş",
    sortable: true,
    numeric: true,
  },
  {
    id: "selectedOutflow",
    label: "Seçili Tarihte Çıkış",
    sortable: true,
    numeric: true,
  },
];

type CashSummaryRow = {
  key: string;
  name: string;
  balance: number;
  lastMovementDate: string;
  selectedInflow: number;
  selectedOutflow: number;
};

type CashMovementRow = {
  id: string;
  type: "Giriş" | "Çıkış";
  cashRegister: string;
  date: string;
  description: string;
  amount: number;
};

const CASH_MOVEMENT_COLUMNS: {
  id: CashMovementColumnId;
  filterable?: boolean;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
}[] = [
  { id: "cashRegister", label: "Kasa", sortable: true, filterable: true },
  { id: "date", label: "İşlem Tarihi", sortable: true },
  { id: "description", label: "Açıklama", sortable: true },
  { id: "amount", label: "Tutar", sortable: true, numeric: true },
];

const INSTALLMENT_COLUMNS: {
  id: InstallmentColumnId;
  filterable?: boolean;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
}[] = [
  { id: "photo", label: "Resim" },
  { id: "candidate", label: "Aday", sortable: true },
  { id: "group", label: "Dönem / Sınıf", sortable: true, filterable: true },
  { id: "licenseClass", label: "Ehliyet Tipi", sortable: true, filterable: true },
  { id: "type", label: "Ödeme Türü", sortable: true, filterable: true },
  { id: "dueDate", label: "Vade", sortable: true },
  { id: "amount", label: "Tutar", sortable: true, numeric: true },
  { id: "description", label: "Açıklama", sortable: true },
];

type DebtRow = {
  candidate: PaymentCandidateSummaryResponse;
  kurs: number;
  teorikSinav: number;
  direksiyonSinav: number;
  diger: number;
  total: number;
};

const DEBT_COLUMNS: {
  id: DebtColumnId;
  filterable?: boolean;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
}[] = [
  { id: "photo", label: "Resim" },
  { id: "candidate", label: "Aday", sortable: true },
  { id: "group", label: "Dönem", sortable: true, filterable: true },
  { id: "licenseClass", label: "Ehliyet Tipi", sortable: true, filterable: true },
  { id: "kurs", label: "Kurs Borcu", sortable: true, numeric: true },
  { id: "teorikSinav", label: "E-Sınav Borcu", sortable: true, numeric: true },
  { id: "direksiyonSinav", label: "Direksiyon Borcu", sortable: true, numeric: true },
  { id: "diger", label: "Diğer Borç", sortable: true, numeric: true },
  { id: "total", label: "Toplam", sortable: true, numeric: true },
];

const PERIOD_STATS_COLUMNS: {
  id: PeriodStatsColumnId;
  filterable?: boolean;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
}[] = [
  { id: "licenseClass", label: "Ehliyet Tipi", sortable: true, filterable: true },
  { id: "count", label: "Adet", sortable: true, numeric: true },
  { id: "revenue", label: "Ciro", sortable: true, numeric: true },
  { id: "average", label: "Ortalama", sortable: true, numeric: true },
  { id: "collected", label: "Tahsilat", sortable: true, numeric: true },
  { id: "collectionRate", label: "%", sortable: true, numeric: true },
];

type PaymentDetailRow =
  | {
      kind: "payment";
      id: string;
      payment: PaymentMovementResponse;
      date: string;
      amount: number;
    }
  | {
      kind: "refund";
      id: string;
      refund: PaymentRefundMovementResponse;
      date: string;
      amount: number;
    }
  | {
      kind: "cancelled";
      id: string;
      payment: PaymentMovementResponse;
      date: string;
      amount: number;
    };

function money(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function percent(value: number): string {
  return `${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value)}%`;
}

function paymentTypeLabel(type: CandidateAccountingType): string {
  return PAYMENT_TYPE_ROWS.find((item) => item.key === type)?.label ?? type;
}

function paymentMethodLabel(method: string): string {
  if (method === "cash") return "Nakit";
  if (method === "bank_transfer") return "Havale/EFT";
  if (method === "credit_card") return "Kredi Kartı";
  if (method === "mail_order") return "Mail Order";
  return "Diğer";
}

function licenseClassLabel(
  code: string,
  licenseClassLabelByCode?: Map<string, string>,
): string {
  const value = code.trim();
  if (!value) return "-";
  return (
    licenseClassLabelByCode?.get(value) ??
    licenseClassLabelByCode?.get(value.toLocaleUpperCase("tr-TR")) ??
    value
  );
}

function termLabel(monthDate: string, name: string | null): string {
  if (name?.trim()) return name.trim().toLocaleUpperCase("tr-TR");
  const [year, month] = monthDate.slice(0, 7).split("-");
  if (!year || !month) return monthDate.toLocaleUpperCase("tr-TR");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date
    .toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
    .toLocaleUpperCase("tr-TR");
}

function rowCandidate(row: PaymentDetailRow) {
  return row.kind === "refund" ? row.refund.candidate : row.payment.candidate;
}

function rowType(row: PaymentDetailRow): CandidateAccountingType {
  return row.kind === "refund" ? row.refund.type : row.payment.type;
}

function rowCashRegisterLabel(row: PaymentDetailRow): string {
  if (row.kind === "refund") return row.refund.cashRegister?.name ?? "Kasa Yok";
  return cashRegisterLabel(row.payment);
}

function rowDescription(row: PaymentDetailRow): string {
  if (row.kind === "refund") return row.refund.note?.trim() || "İade";
  if (row.kind === "cancelled")
    return row.payment.cancellationReason?.trim() || "İptal";
  return row.payment.note?.trim() || row.payment.installmentDescription || "-";
}

function rowMethodLabel(row: PaymentDetailRow): string {
  if (row.kind === "refund") return "İade";
  if (row.kind === "cancelled")
    return paymentMethodLabel(row.payment.paymentMethod);
  return paymentMethodLabel(row.payment.paymentMethod);
}

function rowGroupLabel(row: PaymentDetailRow): string {
  const candidate = rowCandidate(row);
  const group = candidate.currentGroup;
  if (!group) return "-";
  const term = termLabel(group.term.monthDate, group.term.name);
  const title = group.title.trim();
  const normalizedTitle = title.toLocaleUpperCase("tr-TR");
  const prefix = `${term} - `;
  if (normalizedTitle.startsWith(prefix)) return normalizedTitle;
  return `${term} - ${title}`;
}

function rowCandidateName(row: PaymentDetailRow): string {
  const candidate = rowCandidate(row);
  return `${candidate.firstName} ${candidate.lastName}`.trim();
}

function invoiceCandidateName(invoice: PaymentInvoiceOverviewResponse): string {
  return `${invoice.candidate.firstName} ${invoice.candidate.lastName}`.trim();
}

function invoiceGroupLabel(invoice: PaymentInvoiceOverviewResponse): string {
  const group = invoice.candidate.currentGroup;
  if (!group) return "-";
  const term = termLabel(group.term.monthDate, group.term.name);
  const title = group.title.trim();
  const normalizedTitle = title.toLocaleUpperCase("tr-TR");
  const prefix = `${term} - `;
  if (normalizedTitle.startsWith(prefix)) return normalizedTitle;
  return `${term} - ${title}`;
}

function invoiceNotes(invoice: PaymentInvoiceOverviewResponse): string {
  return invoice.notes?.trim() || "-";
}

function installmentCandidateName(
  installment: PaymentInstallmentOverviewResponse,
): string {
  return `${installment.candidate.firstName} ${installment.candidate.lastName}`.trim();
}

function installmentGroupLabel(
  installment: PaymentInstallmentOverviewResponse,
): string {
  const group = installment.candidate.currentGroup;
  if (!group) return "-";
  const term = termLabel(group.term.monthDate, group.term.name);
  const title = group.title.trim();
  const normalizedTitle = title.toLocaleUpperCase("tr-TR");
  const prefix = `${term} - `;
  if (normalizedTitle.startsWith(prefix)) return normalizedTitle;
  return `${term} - ${title}`;
}

function installmentDescription(
  installment: PaymentInstallmentOverviewResponse,
): string {
  return installment.description?.trim() || "-";
}

function installmentSortValue(
  installment: PaymentInstallmentOverviewResponse,
  field: InstallmentSortField,
  licenseClassLabelByCode?: Map<string, string>,
): string | number {
  if (field === "candidate") return installmentCandidateName(installment);
  if (field === "group") return installmentGroupLabel(installment);
  if (field === "licenseClass") {
    return licenseClassLabel(installment.candidate.licenseClass, licenseClassLabelByCode);
  }
  if (field === "type") return paymentTypeLabel(installment.type);
  if (field === "dueDate") return installment.dueDate;
  if (field === "amount") return installment.amount;
  return installmentDescription(installment);
}

function installmentFilterValue(
  installment: PaymentInstallmentOverviewResponse,
  field: InstallmentSortField,
  licenseClassLabelByCode?: Map<string, string>,
): string {
  if (field === "candidate") return installmentCandidateName(installment);
  if (field === "group") return installmentGroupLabel(installment);
  if (field === "licenseClass") {
    return licenseClassLabel(installment.candidate.licenseClass, licenseClassLabelByCode);
  }
  if (field === "type") return paymentTypeLabel(installment.type);
  if (field === "dueDate") return dateKey(installment.dueDate);
  if (field === "amount") return String(installment.amount);
  return installmentDescription(installment);
}

function installmentFilterLabel(
  installment: PaymentInstallmentOverviewResponse,
  field: InstallmentSortField,
  licenseClassLabelByCode?: Map<string, string>,
): string {
  if (field === "dueDate") return formatDateTR(installment.dueDate);
  if (field === "amount") return money(installment.amount);
  return installmentFilterValue(installment, field, licenseClassLabelByCode);
}

function paymentCandidateName(candidate: PaymentCandidateSummaryResponse): string {
  return `${candidate.firstName} ${candidate.lastName}`.trim();
}

function paymentCandidateGroupLabel(
  candidate: PaymentCandidateSummaryResponse,
): string {
  const group = candidate.currentGroup;
  if (!group) return "-";
  const term = termLabel(group.term.monthDate, group.term.name);
  const title = group.title.trim();
  const normalizedTitle = title.toLocaleUpperCase("tr-TR");
  const prefix = `${term} - `;
  if (normalizedTitle.startsWith(prefix)) return normalizedTitle;
  return `${term} - ${title}`;
}

function debtSortValue(
  row: DebtRow,
  field: DebtSortField,
  licenseClassLabelByCode?: Map<string, string>,
): string | number {
  if (field === "candidate") return paymentCandidateName(row.candidate);
  if (field === "group") return paymentCandidateGroupLabel(row.candidate);
  if (field === "licenseClass") {
    return licenseClassLabel(row.candidate.licenseClass, licenseClassLabelByCode);
  }
  return row[field];
}

function debtFilterValue(
  row: DebtRow,
  field: DebtSortField,
  licenseClassLabelByCode?: Map<string, string>,
): string {
  if (field === "candidate") return paymentCandidateName(row.candidate);
  if (field === "group") return paymentCandidateGroupLabel(row.candidate);
  if (field === "licenseClass") {
    return licenseClassLabel(row.candidate.licenseClass, licenseClassLabelByCode);
  }
  return String(row[field]);
}

function debtFilterLabel(
  row: DebtRow,
  field: DebtSortField,
  licenseClassLabelByCode?: Map<string, string>,
): string {
  if (
    field === "kurs" ||
    field === "teorikSinav" ||
    field === "direksiyonSinav" ||
    field === "diger" ||
    field === "total"
  ) {
    return money(Number(row[field]));
  }
  return debtFilterValue(row, field, licenseClassLabelByCode);
}

function debtBucketForType(type: CandidateAccountingType | undefined): keyof Pick<
  DebtRow,
  "kurs" | "teorikSinav" | "direksiyonSinav" | "diger"
> {
  if (type === "kurs") return "kurs";
  if (type === "teorik_sinav") return "teorikSinav";
  if (type === "direksiyon_sinav") return "direksiyonSinav";
  return "diger";
}

function periodStatsAverage(row: PeriodStatsRow): number {
  return row.count > 0 ? row.revenue / row.count : 0;
}

function periodStatsCollectionRate(row: PeriodStatsRow): number {
  return row.revenue > 0 ? (row.collected / row.revenue) * 100 : 0;
}

function periodStatsSortValue(
  row: PeriodStatsRow,
  field: PeriodStatsSortField,
): string | number {
  if (field === "licenseClass") return row.licenseClass;
  if (field === "count") return row.count;
  if (field === "revenue") return row.revenue;
  if (field === "average") return periodStatsAverage(row);
  if (field === "collected") return row.collected;
  return periodStatsCollectionRate(row);
}

function periodStatsFilterValue(
  row: PeriodStatsRow,
  field: PeriodStatsSortField,
): string {
  return String(periodStatsSortValue(row, field));
}

function periodStatsFilterLabel(
  row: PeriodStatsRow,
  field: PeriodStatsSortField,
): string {
  if (field === "revenue" || field === "average" || field === "collected") {
    return money(Number(periodStatsSortValue(row, field)));
  }
  if (field === "collectionRate") {
    return percent(Number(periodStatsSortValue(row, field)));
  }
  return periodStatsFilterValue(row, field);
}

function invoiceSortValue(
  invoice: PaymentInvoiceOverviewResponse,
  field: InvoiceSortField,
): string | number {
  if (field === "candidate") return invoiceCandidateName(invoice);
  if (field === "group") return invoiceGroupLabel(invoice);
  if (field === "invoiceNo") return invoice.invoiceNo;
  if (field === "invoiceType") return invoice.invoiceType;
  if (field === "date") return invoice.invoiceDate;
  if (field === "subtotal") return invoice.subtotal;
  if (field === "vatRate") return invoice.vatRate;
  if (field === "vatAmount") return invoice.vatAmount;
  if (field === "total") return invoice.totalAmount;
  return invoiceNotes(invoice);
}

function invoiceFilterValue(
  invoice: PaymentInvoiceOverviewResponse,
  field: InvoiceSortField,
): string {
  if (field === "candidate") return invoiceCandidateName(invoice);
  if (field === "group") return invoiceGroupLabel(invoice);
  if (field === "invoiceNo") return invoice.invoiceNo;
  if (field === "invoiceType") return invoice.invoiceType;
  if (field === "date") return dateKey(invoice.invoiceDate);
  if (field === "subtotal") return String(invoice.subtotal);
  if (field === "vatRate") return String(invoice.vatRate);
  if (field === "vatAmount") return String(invoice.vatAmount);
  if (field === "total") return String(invoice.totalAmount);
  return invoiceNotes(invoice);
}

function invoiceFilterLabel(
  invoice: PaymentInvoiceOverviewResponse,
  field: InvoiceSortField,
): string {
  if (field === "date") return formatDateTR(invoice.invoiceDate);
  if (field === "subtotal") return money(invoice.subtotal);
  if (field === "vatRate") return `%${invoice.vatRate}`;
  if (field === "vatAmount") return money(invoice.vatAmount);
  if (field === "total") return money(invoice.totalAmount);
  return invoiceFilterValue(invoice, field);
}

function cashSummarySortValue(
  row: CashSummaryRow,
  field: CashSummarySortField,
): string | number {
  if (field === "name") return row.name;
  if (field === "balance") return row.balance;
  if (field === "lastMovementDate") return row.lastMovementDate;
  if (field === "selectedInflow") return row.selectedInflow;
  return row.selectedOutflow;
}

function cashSummaryFilterValue(
  row: CashSummaryRow,
  field: CashSummarySortField,
): string {
  if (field === "name") return row.name;
  if (field === "lastMovementDate") return dateKey(row.lastMovementDate);
  return String(cashSummarySortValue(row, field));
}

function cashSummaryFilterLabel(
  row: CashSummaryRow,
  field: CashSummarySortField,
): string {
  if (field === "lastMovementDate") {
    return row.lastMovementDate ? formatDateTR(row.lastMovementDate) : "-";
  }
  if (field === "balance" || field === "selectedInflow" || field === "selectedOutflow") {
    return money(Number(cashSummarySortValue(row, field)));
  }
  return cashSummaryFilterValue(row, field);
}

function cashMovementSortValue(
  row: CashMovementRow,
  field: CashMovementSortField,
): string | number {
  if (field === "amount") return row.amount;
  if (field === "cashRegister") return row.cashRegister;
  if (field === "date") return row.date;
  return row.description;
}

function cashMovementFilterValue(
  row: CashMovementRow,
  field: CashMovementSortField,
): string {
  if (field === "date") return dateKey(row.date);
  if (field === "amount") return String(row.amount);
  return String(cashMovementSortValue(row, field));
}

function cashMovementFilterLabel(
  row: CashMovementRow,
  field: CashMovementSortField,
): string {
  if (field === "date") return formatDateTR(row.date);
  if (field === "amount") return money(row.amount);
  return cashMovementFilterValue(row, field);
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "tr-TR", { numeric: true });
}

function rowSortValue(
  row: PaymentDetailRow,
  field: DetailSortField,
): string | number {
  if (field === "candidate") return rowCandidateName(row);
  if (field === "group") return rowGroupLabel(row);
  if (field === "type") return paymentTypeLabel(rowType(row));
  if (field === "date") return row.date;
  if (field === "amount") return row.amount;
  if (field === "method") return rowMethodLabel(row);
  if (field === "cashRegister") return rowCashRegisterLabel(row);
  return rowDescription(row);
}

function rowFilterValue(row: PaymentDetailRow, field: DetailSortField): string {
  if (field === "candidate") return rowCandidateName(row);
  if (field === "group") return rowGroupLabel(row);
  if (field === "type") return paymentTypeLabel(rowType(row));
  if (field === "date") return dateKey(row.date);
  if (field === "amount") return String(row.amount);
  if (field === "method") return rowMethodLabel(row);
  if (field === "cashRegister") return rowCashRegisterLabel(row);
  return rowDescription(row);
}

function rowFilterLabel(row: PaymentDetailRow, field: DetailSortField): string {
  if (field === "date") return formatDateTR(row.date);
  if (field === "amount") return money(row.amount);
  return rowFilterValue(row, field);
}

function dateKey(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? "";
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthStart(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateRangeForPreset(preset: DatePreset): {
  fromDate: string;
  toDate: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === "today") {
    const day = formatDateInput(today);
    return { fromDate: day, toDate: day };
  }

  if (preset === "yesterday") {
    const day = formatDateInput(addDays(today, -1));
    return { fromDate: day, toDate: day };
  }

  if (preset === "this_week") {
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
    return {
      fromDate: formatDateInput(addDays(today, 1 - dayOfWeek)),
      toDate: formatDateInput(today),
    };
  }

  if (preset === "this_month") {
    return {
      fromDate: formatDateInput(
        new Date(today.getFullYear(), today.getMonth(), 1),
      ),
      toDate: formatDateInput(today),
    };
  }

  if (preset === "last_month") {
    return {
      fromDate: formatDateInput(
        new Date(today.getFullYear(), today.getMonth() - 1, 1),
      ),
      toDate: formatDateInput(
        new Date(today.getFullYear(), today.getMonth(), 0),
      ),
    };
  }

  if (preset === "this_year") {
    return {
      fromDate: formatDateInput(new Date(today.getFullYear(), 0, 1)),
      toDate: formatDateInput(today),
    };
  }

  if (preset === "last_7_days") {
    return {
      fromDate: formatDateInput(addDays(today, -6)),
      toDate: formatDateInput(today),
    };
  }

  if (preset === "last_30_days") {
    return {
      fromDate: formatDateInput(addDays(today, -29)),
      toDate: formatDateInput(today),
    };
  }

  return { fromDate: "", toDate: "" };
}

function isInDateRange(
  value: string,
  fromDate: string,
  toDate: string,
): boolean {
  const day = dateKey(value);
  if (!day) return true;
  if (fromDate && day < fromDate) return false;
  if (toDate && day > toDate) return false;
  return true;
}

function cashRegisterKey(payment: PaymentMovementResponse): string {
  return payment.cashRegisterId ?? NO_CASH_REGISTER_KEY;
}

function cashRegisterLabel(payment: PaymentMovementResponse): string {
  return payment.cashRegister?.name ?? "Kasa Yok";
}

function refundCashRegisterKey(refund: PaymentRefundMovementResponse): string {
  return refund.cashRegisterId ?? NO_CASH_REGISTER_KEY;
}

function refundCashRegisterLabel(refund: PaymentRefundMovementResponse): string {
  return refund.cashRegister?.name ?? "Kasa Yok";
}

function cashRegisterTypeLabel(type: string | null | undefined): string {
  if (type === "cash") return "Nakit kasa";
  if (type === "bank_transfer") return "Banka";
  if (type === "credit_card") return "Kredi kartı";
  if (type === "mail_order") return "Mail order";
  return "Tanımsız";
}

export function PaymentsPage() {
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const [overview, setOverview] = useState<PaymentsOverviewResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statsMonth, setStatsMonth] = useState(currentMonthStart);
  const [detailGroup, setDetailGroup] = useState<DetailGroup>("movements");
  const [detailTab, setDetailTab] = useState<DetailTab>("all");
  const [detailSort, setDetailSort] = useState<DetailSortState>({
    field: "date",
    direction: "desc",
  });
  const [invoiceSort, setInvoiceSort] = useState<InvoiceSortState>({
    field: "date",
    direction: "desc",
  });
  const [cashSummarySort, setCashSummarySort] =
    useState<CashSummarySortState>({
      field: "name",
      direction: "asc",
    });
  const [cashMovementSort, setCashMovementSort] =
    useState<CashMovementSortState>({
      field: "date",
      direction: "desc",
    });
  const [installmentSort, setInstallmentSort] =
    useState<InstallmentSortState>({
      field: "dueDate",
      direction: "asc",
    });
  const [debtSort, setDebtSort] = useState<DebtSortState>({
    field: "total",
    direction: "desc",
  });
  const [periodStatsSort, setPeriodStatsSort] =
    useState<PeriodStatsSortState>({
      field: "licenseClass",
      direction: "asc",
    });
  const [detailColumnFilters, setDetailColumnFilters] =
    useState<DetailColumnFilters>({});
  const [invoiceColumnFilters, setInvoiceColumnFilters] =
    useState<InvoiceColumnFilters>({});
  const [cashSummaryColumnFilters, setCashSummaryColumnFilters] =
    useState<CashSummaryColumnFilters>({});
  const [cashMovementColumnFilters, setCashMovementColumnFilters] =
    useState<CashMovementColumnFilters>({});
  const [installmentColumnFilters, setInstallmentColumnFilters] =
    useState<InstallmentColumnFilters>({});
  const [debtColumnFilters, setDebtColumnFilters] =
    useState<DebtColumnFilters>({});
  const [periodStatsColumnFilters, setPeriodStatsColumnFilters] =
    useState<PeriodStatsColumnFilters>({});
  const [visibleDetailColumns, setVisibleDetailColumns] = useState<
    DetailColumnId[]
  >(DEFAULT_DETAIL_COLUMNS);

  const licenseClassLabelByCode = useMemo(() => {
    const values = new Map<string, string>();
    for (const option of licenseClassOptions) {
      values.set(option.value, option.label);
      values.set(option.value.toLocaleUpperCase("tr-TR"), option.label);
    }
    return values;
  }, [licenseClassOptions]);
  const overviewStatsMonth = fromDate || toDate ? statsMonth : "";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    const hasDateFilter = Boolean(fromDate || toDate);
    getPaymentsOverview(
      hasDateFilter ? { fromDate, statsMonth: overviewStatsMonth, toDate } : undefined,
      controller.signal,
    )
      .then(setOverview)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fromDate, overviewStatsMonth, reloadKey, toDate]);

  const filteredPayments = useMemo(() => {
    if (!overview) return [];
    return overview.payments.filter((item) => {
      if (item.status !== "active") return false;
      return isInDateRange(item.paidAtUtc, fromDate, toDate);
    });
  }, [fromDate, overview, toDate]);

  const filteredRefunds = useMemo(() => {
    if (!overview) return [];
    return (overview.refunds ?? []).filter((refund) =>
      isInDateRange(refund.refundedAtUtc, fromDate, toDate),
    );
  }, [fromDate, overview, toDate]);

  const baseDetailRows = useMemo<PaymentDetailRow[]>(() => {
    if (!overview) return [];
    const rows: PaymentDetailRow[] = [];

    if (detailTab === "all" || detailTab === "payment") {
      rows.push(
        ...overview.payments
          .filter(
            (payment) =>
              payment.status === "active" &&
              isInDateRange(payment.paidAtUtc, fromDate, toDate),
          )
          .map((payment) => ({
            kind: "payment" as const,
            id: payment.id,
            payment,
            date: payment.paidAtUtc,
            amount: payment.amount,
          })),
      );
    }

    if (detailTab === "all" || detailTab === "refund") {
      rows.push(
        ...(overview.refunds ?? [])
          .filter((refund) =>
            isInDateRange(refund.refundedAtUtc, fromDate, toDate),
          )
          .map((refund) => ({
            kind: "refund" as const,
            id: refund.id,
            refund,
            date: refund.refundedAtUtc,
            amount: refund.amount,
          })),
      );
    }

    if (detailTab === "all" || detailTab === "cancelled") {
      rows.push(
        ...overview.payments
          .filter(
            (payment) =>
              payment.status === "cancelled" &&
              Boolean(payment.cancelledAtUtc) &&
              isInDateRange(
                payment.cancelledAtUtc ?? payment.paidAtUtc,
                fromDate,
                toDate,
              ),
          )
          .map((payment) => ({
            kind: "cancelled" as const,
            id: payment.id,
            payment,
            date: payment.cancelledAtUtc ?? payment.paidAtUtc,
            amount: payment.amount,
          })),
      );
    }

    return rows;
  }, [detailTab, fromDate, overview, toDate]);

  const detailRows = useMemo<PaymentDetailRow[]>(() => {
    const filteredRows = baseDetailRows.filter((row) =>
      Object.entries(detailColumnFilters).every(([field, value]) => {
        if (!value || value === "all") return true;
        if (field === "candidate") {
          return rowCandidateName(row)
            .toLocaleLowerCase("tr-TR")
            .includes(value.toLocaleLowerCase("tr-TR"));
        }
        return rowFilterValue(row, field as DetailSortField) === value;
      }),
    );

    const factor = detailSort.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort(
      (a, b) =>
        compareValues(
          rowSortValue(a, detailSort.field),
          rowSortValue(b, detailSort.field),
        ) * factor,
    );
  }, [
    baseDetailRows,
    detailColumnFilters,
    detailSort.direction,
    detailSort.field,
  ]);

  const baseInvoiceRows = useMemo(() => {
    return (overview?.invoices ?? []).filter((invoice) =>
      isInDateRange(invoice.invoiceDate, fromDate, toDate),
    );
  }, [fromDate, overview, toDate]);

  const invoiceRows = useMemo(() => {
    const candidateQuery = detailColumnFilters.candidate
      ?.trim()
      .toLocaleLowerCase("tr-TR");
    const filteredRows = baseInvoiceRows
      .filter((invoice) => {
        if (!candidateQuery) return true;
        return invoiceCandidateName(invoice)
          .toLocaleLowerCase("tr-TR")
          .includes(candidateQuery);
      })
      .filter((invoice) =>
        Object.entries(invoiceColumnFilters).every(([field, value]) => {
          if (!value || value === "all") return true;
          return invoiceFilterValue(invoice, field as InvoiceSortField) === value;
        }),
      );

    const factor = invoiceSort.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort(
      (a, b) =>
        compareValues(
          invoiceSortValue(a, invoiceSort.field),
          invoiceSortValue(b, invoiceSort.field),
        ) * factor,
    );
  }, [
    baseInvoiceRows,
    detailColumnFilters.candidate,
    invoiceColumnFilters,
    invoiceSort.direction,
    invoiceSort.field,
  ]);

  const baseInstallmentRows = useMemo(() => {
    return (overview?.installments ?? []).filter(
      (installment) =>
        installment.status === "active" &&
        isInDateRange(installment.dueDate, fromDate, toDate),
    );
  }, [fromDate, overview, toDate]);

  const installmentRows = useMemo(() => {
    const candidateQuery = detailColumnFilters.candidate
      ?.trim()
      .toLocaleLowerCase("tr-TR");
    const filteredRows = baseInstallmentRows
      .filter((installment) => {
        if (!candidateQuery) return true;
        return installmentCandidateName(installment)
          .toLocaleLowerCase("tr-TR")
          .includes(candidateQuery);
      })
      .filter((installment) =>
        Object.entries(installmentColumnFilters).every(([field, value]) => {
          if (!value || value === "all") return true;
          return (
            installmentFilterValue(
              installment,
              field as InstallmentSortField,
              licenseClassLabelByCode,
            ) === value
          );
        }),
      );

    const factor = installmentSort.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort(
      (a, b) =>
        compareValues(
          installmentSortValue(a, installmentSort.field, licenseClassLabelByCode),
          installmentSortValue(b, installmentSort.field, licenseClassLabelByCode),
        ) * factor,
    );
  }, [
    baseInstallmentRows,
    detailColumnFilters.candidate,
    installmentColumnFilters,
    installmentSort.direction,
    installmentSort.field,
    licenseClassLabelByCode,
  ]);

  const baseDebtRows = useMemo<DebtRow[]>(() => {
    const rows = new Map<string, DebtRow>();

    baseInstallmentRows
      .filter((installment) => installment.remainingAmount > 0)
      .forEach((installment) => {
        const key = installment.candidate.id;
        const row =
          rows.get(key) ??
          {
            candidate: installment.candidate,
            kurs: 0,
            teorikSinav: 0,
            direksiyonSinav: 0,
            diger: 0,
            total: 0,
          };

        row[debtBucketForType(installment.type)] += installment.remainingAmount;
        row.total += installment.remainingAmount;
        rows.set(key, row);
      });

    return Array.from(rows.values());
  }, [baseInstallmentRows]);

  const debtRows = useMemo(() => {
    const candidateQuery = detailColumnFilters.candidate
      ?.trim()
      .toLocaleLowerCase("tr-TR");
    const filteredRows = baseDebtRows
      .filter((row) => {
        if (!candidateQuery) return true;
        return paymentCandidateName(row.candidate)
          .toLocaleLowerCase("tr-TR")
          .includes(candidateQuery);
      })
      .filter((row) =>
        Object.entries(debtColumnFilters).every(([field, value]) => {
          if (!value || value === "all") return true;
          return (
            debtFilterValue(row, field as DebtSortField, licenseClassLabelByCode) ===
            value
          );
        }),
      );

    const factor = debtSort.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort(
      (a, b) =>
        compareValues(
          debtSortValue(a, debtSort.field, licenseClassLabelByCode),
          debtSortValue(b, debtSort.field, licenseClassLabelByCode),
        ) * factor,
    );
  }, [
    baseDebtRows,
    debtColumnFilters,
    debtSort.direction,
    debtSort.field,
    detailColumnFilters.candidate,
    licenseClassLabelByCode,
  ]);

  const baseCashMovementRows = useMemo<CashMovementRow[]>(() => {
    if (!overview) return [];
    const rows: CashMovementRow[] = [];

    overview.payments
      .filter((payment) => payment.status === "active")
      .filter((payment) => isInDateRange(payment.paidAtUtc, fromDate, toDate))
      .forEach((payment) => {
        rows.push({
          id: `payment:${payment.id}`,
          type: "Giriş",
          cashRegister: cashRegisterLabel(payment),
          date: payment.paidAtUtc,
          description:
            payment.note?.trim() ||
            payment.installmentDescription ||
            paymentTypeLabel(payment.type),
          amount: payment.amount,
        });
      });

    (overview.refunds ?? [])
      .filter((refund) => isInDateRange(refund.refundedAtUtc, fromDate, toDate))
      .forEach((refund) => {
        rows.push({
          id: `refund:${refund.id}`,
          type: "Çıkış",
          cashRegister: refundCashRegisterLabel(refund),
          date: refund.refundedAtUtc,
          description: refund.note?.trim() || "İade",
          amount: refund.amount,
        });
      });

    return rows;
  }, [fromDate, overview, toDate]);

  const cashMovementRows = useMemo(() => {
    const filteredRows = baseCashMovementRows.filter((row) =>
      Object.entries(cashMovementColumnFilters).every(([field, value]) => {
        if (!value || value === "all") return true;
        return cashMovementFilterValue(row, field as CashMovementSortField) === value;
      }),
    );

    const factor = cashMovementSort.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort(
      (a, b) =>
        compareValues(
          cashMovementSortValue(a, cashMovementSort.field),
          cashMovementSortValue(b, cashMovementSort.field),
        ) * factor,
    );
  }, [
    baseCashMovementRows,
    cashMovementColumnFilters,
    cashMovementSort.direction,
    cashMovementSort.field,
  ]);

  const detailFilterOptions = useMemo(() => {
    const options = new Map<DetailSortField, TableHeaderFilterOption[]>();
    for (const column of DETAIL_COLUMNS) {
      if (!column.sortable) continue;
      const values = new Map<string, string>();
      for (const row of baseDetailRows) {
        const value = rowFilterValue(row, column.id as DetailSortField);
        values.set(value, rowFilterLabel(row, column.id as DetailSortField));
      }
      const sortedValues = Array.from(values.entries()).sort((a, b) => {
        if (column.id === "amount") return Number(a[0]) - Number(b[0]);
        if (column.id === "date") return b[0].localeCompare(a[0]);
        return a[1].localeCompare(b[1], "tr-TR", { numeric: true });
      });
      options.set(column.id as DetailSortField, [
        { value: "all", label: "Tümü" },
        ...sortedValues.map(([value, label]) => ({ value, label })),
      ]);
    }
    return options;
  }, [baseDetailRows]);

  const invoiceFilterOptions = useMemo(() => {
    const options = new Map<InvoiceSortField, TableHeaderFilterOption[]>();
    for (const column of INVOICE_COLUMNS) {
      if (!column.sortable) continue;
      const values = new Map<string, string>();
      for (const invoice of baseInvoiceRows) {
        const value = invoiceFilterValue(invoice, column.id as InvoiceSortField);
        values.set(value, invoiceFilterLabel(invoice, column.id as InvoiceSortField));
      }
      const sortedValues = Array.from(values.entries()).sort((a, b) => {
        if (
          column.id === "subtotal" ||
          column.id === "vatRate" ||
          column.id === "vatAmount" ||
          column.id === "total"
        ) {
          return Number(a[0]) - Number(b[0]);
        }
        if (column.id === "date") return b[0].localeCompare(a[0]);
        return a[1].localeCompare(b[1], "tr-TR", { numeric: true });
      });
      options.set(column.id as InvoiceSortField, [
        { value: "all", label: "Tümü" },
        ...sortedValues.map(([value, label]) => ({ value, label })),
      ]);
    }
    return options;
  }, [baseInvoiceRows]);

  const installmentFilterOptions = useMemo(() => {
    const options = new Map<InstallmentSortField, TableHeaderFilterOption[]>();
    for (const column of INSTALLMENT_COLUMNS) {
      if (!column.sortable) continue;
      const values = new Map<string, string>();
      for (const installment of baseInstallmentRows) {
        const value = installmentFilterValue(
          installment,
          column.id as InstallmentSortField,
          licenseClassLabelByCode,
        );
        values.set(
          value,
          installmentFilterLabel(
            installment,
            column.id as InstallmentSortField,
            licenseClassLabelByCode,
          ),
        );
      }
      const sortedValues = Array.from(values.entries()).sort((a, b) => {
        if (column.id === "amount") return Number(a[0]) - Number(b[0]);
        if (column.id === "dueDate") return a[0].localeCompare(b[0]);
        return a[1].localeCompare(b[1], "tr-TR", { numeric: true });
      });
      options.set(column.id as InstallmentSortField, [
        { value: "all", label: "Tümü" },
        ...sortedValues.map(([value, label]) => ({ value, label })),
      ]);
    }
    return options;
  }, [baseInstallmentRows, licenseClassLabelByCode]);

  const debtFilterOptions = useMemo(() => {
    const options = new Map<DebtSortField, TableHeaderFilterOption[]>();
    for (const column of DEBT_COLUMNS) {
      if (!column.sortable) continue;
      const values = new Map<string, string>();
      for (const row of baseDebtRows) {
        const value = debtFilterValue(
          row,
          column.id as DebtSortField,
          licenseClassLabelByCode,
        );
        values.set(
          value,
          debtFilterLabel(row, column.id as DebtSortField, licenseClassLabelByCode),
        );
      }
      const sortedValues = Array.from(values.entries()).sort((a, b) => {
        if (
          column.id === "kurs" ||
          column.id === "teorikSinav" ||
          column.id === "direksiyonSinav" ||
          column.id === "diger" ||
          column.id === "total"
        ) {
          return Number(a[0]) - Number(b[0]);
        }
        return a[1].localeCompare(b[1], "tr-TR", { numeric: true });
      });
      options.set(column.id as DebtSortField, [
        { value: "all", label: "Tümü" },
        ...sortedValues.map(([value, label]) => ({ value, label })),
      ]);
    }
    return options;
  }, [baseDebtRows, licenseClassLabelByCode]);

  const cashMovementFilterOptions = useMemo(() => {
    const options = new Map<CashMovementSortField, TableHeaderFilterOption[]>();
    for (const column of CASH_MOVEMENT_COLUMNS) {
      if (!column.sortable) continue;
      const values = new Map<string, string>();
      for (const row of baseCashMovementRows) {
        const value = cashMovementFilterValue(row, column.id);
        values.set(value, cashMovementFilterLabel(row, column.id));
      }
      const sortedValues = Array.from(values.entries()).sort((a, b) => {
        if (column.id === "amount") return Number(a[0]) - Number(b[0]);
        if (column.id === "date") return b[0].localeCompare(a[0]);
        return a[1].localeCompare(b[1], "tr-TR", { numeric: true });
      });
      options.set(column.id, [
        { value: "all", label: "Tümü" },
        ...sortedValues.map(([value, label]) => ({ value, label })),
      ]);
    }
    return options;
  }, [baseCashMovementRows]);

  const detailColumns = useMemo(
    () =>
      DETAIL_COLUMNS.filter((column) =>
        visibleDetailColumns.includes(column.id),
      ),
    [visibleDetailColumns],
  );
  const detailColumnOptions = useMemo<ColumnOption[]>(
    () =>
      DETAIL_COLUMNS.map((column) => ({
        id: column.id,
        label: column.label,
      })),
    [],
  );

  const cashRegisters = useMemo(() => {
    const values = new Map<
      string,
      { key: string; label: string; typeLabel: string }
    >();

    (overview?.cashRegisters ?? []).forEach((register) => {
      values.set(register.id, {
        key: register.id,
        label: register.name,
        typeLabel: cashRegisterTypeLabel(register.type),
      });
    });

    filteredPayments.forEach((payment) => {
      const key = cashRegisterKey(payment);
      if (values.has(key)) return;
      values.set(key, {
        key,
        label: cashRegisterLabel(payment),
        typeLabel: cashRegisterTypeLabel(payment.cashRegister?.type),
      });
    });

    filteredRefunds.forEach((refund) => {
      const key = refundCashRegisterKey(refund);
      if (values.has(key)) return;
      values.set(key, {
        key,
        label: refundCashRegisterLabel(refund),
        typeLabel: cashRegisterTypeLabel(refund.cashRegister?.type),
      });
    });

    return Array.from(values.values()).sort((a, b) => {
      if (a.key === NO_CASH_REGISTER_KEY) return 1;
      if (b.key === NO_CASH_REGISTER_KEY) return -1;
      return a.label.localeCompare(b.label, "tr-TR");
    });
  }, [filteredPayments, filteredRefunds, overview?.cashRegisters]);

  const baseCashSummaryRows = useMemo<CashSummaryRow[]>(() => {
    if (!overview) return [];
    const rows = new Map<string, CashSummaryRow>();
    const officialCashRegisterIds = new Set(
      (overview.cashRegisters ?? []).map((register) => register.id),
    );

    const ensureRow = (key: string, name: string) => {
      const existing = rows.get(key);
      if (existing) return existing;
      const row = {
        key,
        name,
        balance: 0,
        lastMovementDate: "",
        selectedInflow: 0,
        selectedOutflow: 0,
      };
      rows.set(key, row);
      return row;
    };

    const updateLastMovementDate = (row: { lastMovementDate: string }, date: string) => {
      if (!row.lastMovementDate || date > row.lastMovementDate) {
        row.lastMovementDate = date;
      }
    };

    (overview.cashRegisters ?? []).forEach((register) => {
      const row = ensureRow(register.id, register.name);
      row.balance = register.balance ?? 0;
      row.lastMovementDate = register.lastMovementDate ?? "";
    });

    overview.payments
      .filter((payment) => payment.status === "active")
      .forEach((payment) => {
        const key = cashRegisterKey(payment);
        const row = officialCashRegisterIds.has(key)
          ? ensureRow(key, cashRegisterLabel(payment))
          : key === NO_CASH_REGISTER_KEY
            ? ensureRow(key, cashRegisterLabel(payment))
            : null;
        if (!row) return;
        if (!officialCashRegisterIds.has(key)) {
          row.balance += payment.amount;
          updateLastMovementDate(row, payment.paidAtUtc);
        }
        if (isInDateRange(payment.paidAtUtc, fromDate, toDate)) {
          row.selectedInflow += payment.amount;
        }
      });

    (overview.refunds ?? []).forEach((refund) => {
      const key = refundCashRegisterKey(refund);
      const row = officialCashRegisterIds.has(key)
        ? ensureRow(key, refundCashRegisterLabel(refund))
        : key === NO_CASH_REGISTER_KEY
          ? ensureRow(key, refundCashRegisterLabel(refund))
          : null;
      if (!row) return;
      if (!officialCashRegisterIds.has(key)) {
        row.balance -= refund.amount;
        updateLastMovementDate(row, refund.refundedAtUtc);
      }
      if (isInDateRange(refund.refundedAtUtc, fromDate, toDate)) {
        row.selectedOutflow += refund.amount;
      }
    });

    return Array.from(rows.values()).sort((a, b) => {
      if (a.key === NO_CASH_REGISTER_KEY) return 1;
      if (b.key === NO_CASH_REGISTER_KEY) return -1;
      return a.name.localeCompare(b.name, "tr-TR", { numeric: true });
    });
  }, [fromDate, overview, toDate]);

  const cashSummaryFilterOptions = useMemo(() => {
    const options = new Map<CashSummarySortField, TableHeaderFilterOption[]>();
    for (const column of CASH_SUMMARY_COLUMNS) {
      if (!column.sortable) continue;
      const values = new Map<string, string>();
      for (const row of baseCashSummaryRows) {
        const value = cashSummaryFilterValue(row, column.id);
        values.set(value, cashSummaryFilterLabel(row, column.id));
      }
      const sortedValues = Array.from(values.entries()).sort((a, b) => {
        if (column.id !== "name" && column.id !== "lastMovementDate") {
          return Number(a[0]) - Number(b[0]);
        }
        if (column.id === "lastMovementDate") return b[0].localeCompare(a[0]);
        return a[1].localeCompare(b[1], "tr-TR", { numeric: true });
      });
      options.set(column.id, [
        { value: "all", label: "Tümü" },
        ...sortedValues.map(([value, label]) => ({ value, label })),
      ]);
    }
    return options;
  }, [baseCashSummaryRows]);

  const cashSummaryRows = useMemo(() => {
    const filteredRows = baseCashSummaryRows.filter((row) =>
      Object.entries(cashSummaryColumnFilters).every(([field, value]) => {
        if (!value || value === "all") return true;
        return cashSummaryFilterValue(row, field as CashSummarySortField) === value;
      }),
    );

    const factor = cashSummarySort.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      if (a.key === NO_CASH_REGISTER_KEY) return 1;
      if (b.key === NO_CASH_REGISTER_KEY) return -1;
      return (
        compareValues(
          cashSummarySortValue(a, cashSummarySort.field),
          cashSummarySortValue(b, cashSummarySort.field),
        ) * factor
      );
    });
  }, [
    baseCashSummaryRows,
    cashSummaryColumnFilters,
    cashSummarySort.direction,
    cashSummarySort.field,
  ]);

  const matrix = useMemo(() => {
    const cells = new Map<string, number>();
    const rowTotals: Record<CandidateAccountingType, number> = {
      kurs: 0,
      teorik_sinav: 0,
      direksiyon_sinav: 0,
      diger: 0,
    };
    const columnTotals = new Map<string, number>();
    let grandTotal = 0;

    filteredPayments.forEach((payment) => {
      const rowKey = payment.type;
      const columnKey = cashRegisterKey(payment);
      const cellKey = `${rowKey}:${columnKey}`;

      cells.set(cellKey, (cells.get(cellKey) ?? 0) + payment.amount);
      rowTotals[rowKey] += payment.amount;
      columnTotals.set(
        columnKey,
        (columnTotals.get(columnKey) ?? 0) + payment.amount,
      );
      grandTotal += payment.amount;
    });

    filteredRefunds.forEach((refund) => {
      const rowKey = refund.type;
      const columnKey = refundCashRegisterKey(refund);
      const cellKey = `${rowKey}:${columnKey}`;

      cells.set(cellKey, (cells.get(cellKey) ?? 0) - refund.amount);
      rowTotals[rowKey] -= refund.amount;
      columnTotals.set(
        columnKey,
        (columnTotals.get(columnKey) ?? 0) - refund.amount,
      );
      grandTotal -= refund.amount;
    });

    return { cells, rowTotals, columnTotals, grandTotal };
  }, [filteredPayments, filteredRefunds]);

  const basePeriodStats = useMemo(() => {
    const rows = new Map<string, PeriodStatsRow>();
    const candidatesById = new Map<string, PaymentCandidateSummaryResponse>();
    const countedCandidatesByLicense = new Map<string, Set<string>>();
    const monthKey = statsMonth.slice(0, 7);

    const isStatsMonth = (value: string) => dateKey(value).slice(0, 7) === monthKey;

    const ensureRow = (candidate: PaymentCandidateSummaryResponse) => {
      const licenseClass = licenseClassLabel(
        candidate.licenseClass,
        licenseClassLabelByCode,
      );
      const key = candidate.licenseClass.trim() || licenseClass;
      const existing = rows.get(key);
      if (existing) return existing;
      const next = {
        key,
        licenseClass,
        count: 0,
        revenue: 0,
        collected: 0,
      };
      rows.set(key, next);
      countedCandidatesByLicense.set(key, new Set());
      return next;
    };

    (overview?.installments ?? [])
      .filter((installment) => installment.status === "active")
      .filter((installment) => isStatsMonth(installment.dueDate))
      .forEach((installment) => {
        candidatesById.set(installment.candidate.id, installment.candidate);
        const row = ensureRow(installment.candidate);
        row.revenue += installment.amount;
        countedCandidatesByLicense.get(row.key)?.add(installment.candidate.id);
      });

    (overview?.payments ?? [])
      .filter((payment) => payment.status === "active")
      .filter((payment) => isStatsMonth(payment.paidAtUtc))
      .forEach((payment) => {
        candidatesById.set(payment.candidate.id, payment.candidate);
        const row = ensureRow(payment.candidate);
        row.collected += payment.amount;
      });

    (overview?.refunds ?? [])
      .filter((refund) => isStatsMonth(refund.refundedAtUtc))
      .forEach((refund) => {
        candidatesById.set(refund.candidate.id, refund.candidate);
        const row = ensureRow(refund.candidate);
        row.collected -= refund.amount;
      });

    for (const row of rows.values()) {
      row.count = countedCandidatesByLicense.get(row.key)?.size ?? 0;
    }

    const items = Array.from(rows.values());
    const total = items.reduce(
      (acc, row) => ({
        count: acc.count + row.count,
        revenue: acc.revenue + row.revenue,
        collected: acc.collected + row.collected,
      }),
      { count: 0, revenue: 0, collected: 0 },
    );

    return { items, total, candidateCount: candidatesById.size };
  }, [
    licenseClassLabelByCode,
    overview?.installments,
    overview?.payments,
    overview?.refunds,
    statsMonth,
  ]);

  const periodStatsFilterOptions = useMemo(() => {
    const options = new Map<PeriodStatsSortField, TableHeaderFilterOption[]>();
    for (const column of PERIOD_STATS_COLUMNS) {
      if (!column.sortable) continue;
      const values = new Map<string, string>();
      for (const row of basePeriodStats.items) {
        const value = periodStatsFilterValue(row, column.id);
        values.set(value, periodStatsFilterLabel(row, column.id));
      }
      const sortedValues = Array.from(values.entries()).sort((a, b) => {
        if (column.numeric) return Number(a[0]) - Number(b[0]);
        return a[1].localeCompare(b[1], "tr-TR", { numeric: true });
      });
      options.set(column.id, [
        { value: "all", label: "Tümü" },
        ...sortedValues.map(([value, label]) => ({ value, label })),
      ]);
    }
    return options;
  }, [basePeriodStats.items]);

  const periodStats = useMemo(() => {
    const filteredItems = basePeriodStats.items.filter((row) =>
      Object.entries(periodStatsColumnFilters).every(([field, value]) => {
        if (!value || value === "all") return true;
        return periodStatsFilterValue(row, field as PeriodStatsSortField) === value;
      }),
    );

    const factor = periodStatsSort.direction === "asc" ? 1 : -1;
    const items = [...filteredItems].sort(
      (a, b) =>
        compareValues(
          periodStatsSortValue(a, periodStatsSort.field),
          periodStatsSortValue(b, periodStatsSort.field),
        ) * factor,
    );
    const total = items.reduce(
      (acc, row) => ({
        count: acc.count + row.count,
        revenue: acc.revenue + row.revenue,
        collected: acc.collected + row.collected,
      }),
      { count: 0, revenue: 0, collected: 0 },
    );

    return { items, total, candidateCount: basePeriodStats.candidateCount };
  }, [
    basePeriodStats,
    periodStatsColumnFilters,
    periodStatsSort.direction,
    periodStatsSort.field,
  ]);

  const resetFilters = () => {
    setDatePreset("all");
    setFromDate("");
    setToDate("");
    setDetailColumnFilters({});
    setInvoiceColumnFilters({});
    setCashSummaryColumnFilters({});
    setCashMovementColumnFilters({});
    setInstallmentColumnFilters({});
    setDebtColumnFilters({});
    setPeriodStatsColumnFilters({});
  };

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const range = dateRangeForPreset(preset);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  };

  const toggleDetailSort = (field: DetailSortField) => {
    setDetailSort((current) =>
      current.field === field
        ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
        : {
            field,
            direction: field === "date" || field === "amount" ? "desc" : "asc",
          },
    );
  };

  const toggleInvoiceSort = (field: InvoiceSortField) => {
    setInvoiceSort((current) =>
      current.field === field
        ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
        : {
            field,
            direction:
              field === "date" ||
              field === "subtotal" ||
              field === "vatRate" ||
              field === "vatAmount" ||
              field === "total"
                ? "desc"
                : "asc",
          },
    );
  };

  const toggleCashSummarySort = (field: CashSummarySortField) => {
    setCashSummarySort((current) =>
      current.field === field
        ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
        : {
            field,
            direction: field === "name" ? "asc" : "desc",
          },
    );
  };

  const toggleCashMovementSort = (field: CashMovementSortField) => {
    setCashMovementSort((current) =>
      current.field === field
        ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
        : {
            field,
            direction: field === "date" || field === "amount" ? "desc" : "asc",
          },
    );
  };

  const toggleInstallmentSort = (field: InstallmentSortField) => {
    setInstallmentSort((current) =>
      current.field === field
        ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
        : {
            field,
            direction:
              field === "dueDate"
                ? "asc"
                : field === "amount"
                  ? "desc"
                  : "asc",
          },
    );
  };

  const toggleDebtSort = (field: DebtSortField) => {
    setDebtSort((current) =>
      current.field === field
        ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
        : {
            field,
            direction:
              field === "candidate" ||
              field === "group" ||
              field === "licenseClass"
                ? "asc"
                : "desc",
          },
    );
  };

  const togglePeriodStatsSort = (field: PeriodStatsSortField) => {
    setPeriodStatsSort((current) =>
      current.field === field
        ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
        : {
            field,
            direction: field === "licenseClass" ? "asc" : "desc",
          },
    );
  };

  const toggleDetailColumn = (columnId: DetailColumnId) => {
    setVisibleDetailColumns((current) => {
      if (current.includes(columnId)) {
        return current.length === 1
          ? current
          : current.filter((id) => id !== columnId);
      }
      return DETAIL_COLUMNS.map((column) => column.id).filter(
        (id) => current.includes(id) || id === columnId,
      );
    });
  };

  const isDetailColumnVisible = (columnId: string) =>
    visibleDetailColumns.includes(columnId as DetailColumnId);

  const resetDetailColumns = () => {
    setVisibleDetailColumns(DEFAULT_DETAIL_COLUMNS);
  };

  const setDetailColumnFilter = (field: DetailSortField, value: string) => {
    setDetailColumnFilters((current) => {
      const next = { ...current };
      if (value === "all") {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const setInvoiceColumnFilter = (field: InvoiceSortField, value: string) => {
    setInvoiceColumnFilters((current) => {
      const next = { ...current };
      if (value === "all") {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const setCashSummaryColumnFilter = (
    field: CashSummarySortField,
    value: string,
  ) => {
    setCashSummaryColumnFilters((current) => {
      const next = { ...current };
      if (value === "all") {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const setCashMovementColumnFilter = (
    field: CashMovementSortField,
    value: string,
  ) => {
    setCashMovementColumnFilters((current) => {
      const next = { ...current };
      if (value === "all") {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const setInstallmentColumnFilter = (
    field: InstallmentSortField,
    value: string,
  ) => {
    setInstallmentColumnFilters((current) => {
      const next = { ...current };
      if (value === "all") {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const setDebtColumnFilter = (field: DebtSortField, value: string) => {
    setDebtColumnFilters((current) => {
      const next = { ...current };
      if (value === "all") {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const setPeriodStatsColumnFilter = (
    field: PeriodStatsSortField,
    value: string,
  ) => {
    setPeriodStatsColumnFilters((current) => {
      const next = { ...current };
      if (value === "all") {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const renderDetailCell = (
    row: PaymentDetailRow,
    columnId: DetailColumnId,
  ) => {
    const candidate = rowCandidate(row);
    if (columnId === "photo") {
      return <CandidateAvatar candidate={candidate} size={32} />;
    }
    if (columnId === "candidate") {
      return (
        <Link
          className="job-type"
          to={`/candidates/${candidate.id}?tab=payments`}
        >
          {candidate.firstName} {candidate.lastName}
        </Link>
      );
    }
    if (columnId === "group") return rowGroupLabel(row);
    if (columnId === "type") return paymentTypeLabel(rowType(row));
    if (columnId === "date") return formatDateTR(row.date);
    if (columnId === "amount") {
      return row.kind === "payment"
        ? money(row.amount)
        : `-${money(row.amount)}`;
    }
    if (columnId === "method") return rowMethodLabel(row);
    if (columnId === "cashRegister") return rowCashRegisterLabel(row);
    return rowDescription(row);
  };

  const renderInvoiceCell = (
    invoice: PaymentInvoiceOverviewResponse,
    columnId: InvoiceColumnId,
  ) => {
    if (columnId === "photo") {
      return <CandidateAvatar candidate={invoice.candidate} size={32} />;
    }
    if (columnId === "candidate") {
      return (
        <Link
          className="job-type"
          to={`/candidates/${invoice.candidate.id}?tab=payments`}
        >
          {invoiceCandidateName(invoice)}
        </Link>
      );
    }
    if (columnId === "group") return invoiceGroupLabel(invoice);
    if (columnId === "invoiceNo") return invoice.invoiceNo;
    if (columnId === "invoiceType") return invoice.invoiceType;
    if (columnId === "date") return formatDateTR(invoice.invoiceDate);
    if (columnId === "subtotal") return money(invoice.subtotal);
    if (columnId === "vatRate") return `%${invoice.vatRate}`;
    if (columnId === "vatAmount") return money(invoice.vatAmount);
    if (columnId === "total") return money(invoice.totalAmount);
    return invoiceNotes(invoice);
  };

  const renderCashSummaryCell = (
    row: CashSummaryRow,
    columnId: CashSummaryColumnId,
  ) => {
    if (columnId === "name") return row.name;
    if (columnId === "balance") return money(row.balance);
    if (columnId === "lastMovementDate") {
      return row.lastMovementDate ? formatDateTR(row.lastMovementDate) : "-";
    }
    if (columnId === "selectedInflow") return money(row.selectedInflow);
    return money(row.selectedOutflow);
  };

  const renderCashMovementCell = (
    row: CashMovementRow,
    columnId: CashMovementColumnId,
  ) => {
    if (columnId === "date") return formatDateTR(row.date);
    if (columnId === "amount") return money(row.amount);
    return row[columnId];
  };

  const renderInstallmentCell = (
    installment: PaymentInstallmentOverviewResponse,
    columnId: InstallmentColumnId,
  ) => {
    if (columnId === "photo") {
      return <CandidateAvatar candidate={installment.candidate} size={32} />;
    }
    if (columnId === "candidate") {
      return (
        <Link
          className="job-type"
          to={`/candidates/${installment.candidate.id}?tab=payments`}
        >
          {installmentCandidateName(installment)}
        </Link>
      );
    }
    if (columnId === "group") return installmentGroupLabel(installment);
    if (columnId === "licenseClass") {
      return licenseClassLabel(
        installment.candidate.licenseClass,
        licenseClassLabelByCode,
      );
    }
    if (columnId === "type") return paymentTypeLabel(installment.type);
    if (columnId === "dueDate") return formatDateTR(installment.dueDate);
    if (columnId === "amount") return money(installment.amount);
    return installmentDescription(installment);
  };

  const renderDebtCell = (row: DebtRow, columnId: DebtColumnId) => {
    if (columnId === "photo") {
      return <CandidateAvatar candidate={row.candidate} size={32} />;
    }
    if (columnId === "candidate") {
      return (
        <Link
          className="job-type"
          to={`/candidates/${row.candidate.id}?tab=payments`}
        >
          {paymentCandidateName(row.candidate)}
        </Link>
      );
    }
    if (columnId === "group") return paymentCandidateGroupLabel(row.candidate);
    if (columnId === "licenseClass") {
      return licenseClassLabel(row.candidate.licenseClass, licenseClassLabelByCode);
    }
    return money(row[columnId]);
  };

  if (loadError) {
    return <PageLoadError onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return (
    <div className="page page-with-toolbar">
      <PageToolbar title="Finans" />

      {loading && !overview ? (
        <div className="page-loading">Yükleniyor...</div>
      ) : (
        <>
          <div className="payments-filters">
            <div className="payments-filter-field">
              <label className="form-label" htmlFor="payments-date-preset">
                Tarih
              </label>
              <CustomSelect
                className="form-select"
                id="payments-date-preset"
                onChange={(event) =>
                  applyDatePreset(event.target.value as DatePreset)
                }
                value={datePreset}
              >
                {DATE_PRESET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
            </div>
            <div className="payments-filter-field">
              <label className="form-label" htmlFor="payments-from-date">
                Başlangıç
              </label>
              <LocalizedDateInput
                ariaLabel="Başlangıç"
                className="form-input"
                name="payments-from-date"
                onChange={(value) => {
                  setDatePreset("custom");
                  setFromDate(value);
                }}
                placeholder="Başlangıç"
                value={fromDate}
              />
            </div>
            <div className="payments-filter-field">
              <label className="form-label" htmlFor="payments-to-date">
                Bitiş
              </label>
              <LocalizedDateInput
                ariaLabel="Bitiş"
                className="form-input"
                name="payments-to-date"
                onChange={(value) => {
                  setDatePreset("custom");
                  setToDate(value);
                }}
                placeholder="Bitiş"
                value={toDate}
              />
            </div>
            <button
              className="btn btn-secondary payments-filter-reset"
              onClick={resetFilters}
              type="button"
            >
              Temizle
            </button>
          </div>

          <section className="instructor-detail-card finance-matrix-card">
            <div className="finance-matrix-card-head">
              <div>
                <h3 className="candidate-detail-section-title">
                  Tahsilat Matrisi
                </h3>
                <div className="finance-matrix-card-subtitle">
                  Ödeme türleri kasalara göre gruplanır.
                </div>
              </div>
            </div>

            <div className="finance-matrix-scroll">
              <table className="data-table finance-matrix-table">
                <thead>
                  <tr>
                    <th>Ödeme Türü</th>
                    {cashRegisters.map((register) => (
                      <th key={register.key}>
                        <span className="finance-matrix-register">
                          {register.label}
                          <small>({register.typeLabel})</small>
                        </span>
                      </th>
                    ))}
                    <th className="finance-matrix-amount">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {PAYMENT_TYPE_ROWS.map((row) => (
                    <tr key={row.key}>
                      <th className="finance-matrix-type" scope="row">
                        {row.label}
                      </th>
                      {cashRegisters.map((register) => {
                        const value =
                          matrix.cells.get(`${row.key}:${register.key}`) ?? 0;
                        return (
                          <td
                            className="finance-matrix-amount"
                            key={register.key}
                          >
                            {value !== 0 ? money(value) : "-"}
                          </td>
                        );
                      })}
                      <td className="finance-matrix-amount finance-matrix-total">
                        {money(matrix.rowTotals[row.key])}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Toplam</th>
                    {cashRegisters.map((register) => (
                      <td
                        className="finance-matrix-amount finance-matrix-total"
                        key={register.key}
                      >
                        {money(matrix.columnTotals.get(register.key) ?? 0)}
                      </td>
                    ))}
                    <td className="finance-matrix-amount finance-matrix-grand-total">
                      {money(matrix.grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {filteredPayments.length === 0 && filteredRefunds.length === 0 ? (
              <div className="instructor-detail-empty">
                Seçili filtrelerle tahsilat bulunamadı.
              </div>
            ) : null}
          </section>

          <section className="instructor-detail-card finance-matrix-card">
            <div className="finance-matrix-card-head">
              <div>
                <h3 className="candidate-detail-section-title">
                  Finans Detayı
                </h3>
                <div className="finance-matrix-card-subtitle">
                  Seçili tarih aralığındaki hareketler ve faturalar.
                </div>
              </div>
            </div>

            <div className="finance-detail-controls">
              <div className="finance-detail-left-controls">
                <div
                  className="finance-detail-tabs"
                  role="tablist"
                  aria-label="Finans hareket türü"
                >
                  {DETAIL_TABS.map((tab) => (
                    <button
                      aria-selected={
                        detailGroup === "movements" && detailTab === tab.key
                      }
                      className={`finance-detail-tab${detailGroup === "movements" && detailTab === tab.key ? " active" : ""}`}
                      key={tab.key}
                      onClick={() => {
                        setDetailGroup("movements");
                        setDetailTab(tab.key);
                      }}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div
                  className="finance-detail-tabs"
                  role="tablist"
                  aria-label="Finans diğer detayları"
                >
                  <button
                    aria-selected={detailGroup === "invoices"}
                    className={`finance-detail-tab${detailGroup === "invoices" ? " active" : ""}`}
                    onClick={() => setDetailGroup("invoices")}
                    role="tab"
                    type="button"
                  >
                    Faturalar
                  </button>
                  <button
                    aria-selected={detailGroup === "cashSummary"}
                    className={`finance-detail-tab${detailGroup === "cashSummary" ? " active" : ""}`}
                    onClick={() => setDetailGroup("cashSummary")}
                    role="tab"
                    type="button"
                  >
                    Kasa Özeti
                  </button>
                  <button
                    aria-selected={detailGroup === "cashMovements"}
                    className={`finance-detail-tab${detailGroup === "cashMovements" ? " active" : ""}`}
                    onClick={() => setDetailGroup("cashMovements")}
                    role="tab"
                    type="button"
                  >
                    Kasa Hareketleri
                  </button>
                </div>
              </div>
              {detailGroup === "cashSummary" || detailGroup === "cashMovements" ? null : (
                <input
                  aria-label="Aday adı filtresi"
                  className="form-input finance-detail-search"
                  onChange={(event) =>
                    setDetailColumnFilter("candidate", event.target.value)
                  }
                  placeholder="Aday ara"
                  value={detailColumnFilters.candidate ?? ""}
                />
              )}
            </div>

            {detailGroup === "movements" ? (
              detailTab === "installment" ? (
                <div className="finance-matrix-scroll">
                  <table className="data-table finance-payments-table">
                    <thead>
                      <tr>
                        {INSTALLMENT_COLUMNS.map((column) => {
                          const isActive = installmentSort.field === column.id;
                          const indicator = isActive
                            ? installmentSort.direction === "asc"
                              ? "▲"
                              : "▼"
                            : "↕";
                          return (
                            <th
                              aria-sort={
                                isActive
                                  ? installmentSort.direction === "asc"
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                              }
                              className={[
                                column.sortable ? "sortable-th" : "",
                                isActive ? "active" : "",
                                column.numeric ? "finance-matrix-amount" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={column.id}
                            >
                              {column.sortable ? (
                                <div className="sortable-th-shell">
                                  <button
                                    className="sortable-th-btn"
                                    onClick={() =>
                                      toggleInstallmentSort(
                                        column.id as InstallmentSortField,
                                      )
                                    }
                                    type="button"
                                  >
                                    <span>{column.label}</span>
                                    <span
                                      className="sortable-th-indicator"
                                      aria-hidden="true"
                                    >
                                      {indicator}
                                    </span>
                                  </button>
                                  {column.filterable ? (
                                    <div className="sortable-th-filter">
                                      <TableHeaderFilter
                                        active={Boolean(
                                          installmentColumnFilters[
                                            column.id as InstallmentSortField
                                          ],
                                        )}
                                        onChange={(value) =>
                                          setInstallmentColumnFilter(
                                            column.id as InstallmentSortField,
                                            value,
                                          )
                                        }
                                        options={
                                          installmentFilterOptions.get(
                                            column.id as InstallmentSortField,
                                          ) ?? [{ value: "all", label: "Tümü" }]
                                        }
                                        title={`${column.label} filtresi`}
                                        value={
                                          installmentColumnFilters[
                                            column.id as InstallmentSortField
                                          ] ?? "all"
                                        }
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                column.label
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {installmentRows.length === 0 ? (
                        <tr>
                          <td
                            className="data-table-empty"
                            colSpan={INSTALLMENT_COLUMNS.length}
                          >
                            Seçili filtrelerle vade bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        installmentRows.map((installment) => (
                          <tr key={installment.id}>
                            {INSTALLMENT_COLUMNS.map((column) => (
                              <td
                                className={[
                                  column.numeric ? "finance-matrix-amount" : "",
                                  column.id === "description"
                                    ? "finance-detail-description-cell"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                key={column.id}
                              >
                                {renderInstallmentCell(installment, column.id)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : detailTab === "debt" ? (
                <div className="finance-matrix-scroll">
                  <table className="data-table finance-payments-table">
                    <thead>
                      <tr>
                        {DEBT_COLUMNS.map((column) => {
                          const isActive = debtSort.field === column.id;
                          const indicator = isActive
                            ? debtSort.direction === "asc"
                              ? "▲"
                              : "▼"
                            : "↕";
                          return (
                            <th
                              aria-sort={
                                isActive
                                  ? debtSort.direction === "asc"
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                              }
                              className={[
                                column.sortable ? "sortable-th" : "",
                                isActive ? "active" : "",
                                column.numeric ? "finance-matrix-amount" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={column.id}
                            >
                              {column.sortable ? (
                                <div className="sortable-th-shell">
                                  <button
                                    className="sortable-th-btn"
                                    onClick={() =>
                                      toggleDebtSort(
                                        column.id as DebtSortField,
                                      )
                                    }
                                    type="button"
                                  >
                                    <span>{column.label}</span>
                                    <span
                                      className="sortable-th-indicator"
                                      aria-hidden="true"
                                    >
                                      {indicator}
                                    </span>
                                  </button>
                                  {column.filterable ? (
                                    <div className="sortable-th-filter">
                                      <TableHeaderFilter
                                        active={Boolean(
                                          debtColumnFilters[
                                            column.id as DebtSortField
                                          ],
                                        )}
                                        onChange={(value) =>
                                          setDebtColumnFilter(
                                            column.id as DebtSortField,
                                            value,
                                          )
                                        }
                                        options={
                                          debtFilterOptions.get(
                                            column.id as DebtSortField,
                                          ) ?? [{ value: "all", label: "Tümü" }]
                                        }
                                        title={`${column.label} filtresi`}
                                        value={
                                          debtColumnFilters[
                                            column.id as DebtSortField
                                          ] ?? "all"
                                        }
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                column.label
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {debtRows.length === 0 ? (
                        <tr>
                          <td
                            className="data-table-empty"
                            colSpan={DEBT_COLUMNS.length}
                          >
                            Seçili filtrelerle borç bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        debtRows.map((row) => (
                          <tr key={row.candidate.id}>
                            {DEBT_COLUMNS.map((column) => (
                              <td
                                className={[
                                  column.numeric ? "finance-matrix-amount" : "",
                                  column.id === "total"
                                    ? "finance-matrix-total"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                key={column.id}
                              >
                                {renderDebtCell(row, column.id)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
              <div className="finance-matrix-scroll">
                <table className="data-table finance-payments-table">
                  <thead>
                    <tr>
                      {detailColumns.map((column) => {
                        const isActive = detailSort.field === column.id;
                        const indicator = isActive
                          ? detailSort.direction === "asc"
                            ? "▲"
                            : "▼"
                          : "↕";
                        return (
                          <th
                            aria-sort={
                              isActive
                                ? detailSort.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                            className={[
                              column.sortable ? "sortable-th" : "",
                              isActive ? "active" : "",
                              column.numeric ? "finance-matrix-amount" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={column.id}
                          >
                            {column.sortable ? (
                              <div className="sortable-th-shell">
                                <button
                                  className="sortable-th-btn"
                                  onClick={() =>
                                    toggleDetailSort(column.id as DetailSortField)
                                  }
                                  type="button"
                                >
                                  <span>{column.label}</span>
                                  <span
                                    className="sortable-th-indicator"
                                    aria-hidden="true"
                                  >
                                    {indicator}
                                  </span>
                                </button>
                                {column.filterable ? (
                                  <div className="sortable-th-filter">
                                    <TableHeaderFilter
                                      active={Boolean(
                                        detailColumnFilters[
                                          column.id as DetailSortField
                                        ],
                                      )}
                                      onChange={(value) =>
                                        setDetailColumnFilter(
                                          column.id as DetailSortField,
                                          value,
                                        )
                                      }
                                      options={
                                        detailFilterOptions.get(
                                          column.id as DetailSortField,
                                        ) ?? [{ value: "all", label: "Tümü" }]
                                      }
                                      title={`${column.label} filtresi`}
                                      value={
                                        detailColumnFilters[
                                          column.id as DetailSortField
                                        ] ?? "all"
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              column.label
                            )}
                          </th>
                        );
                      })}
                      <th className="col-picker-th">
                        <ColumnPicker
                          columns={detailColumnOptions}
                          isVisible={isDetailColumnVisible}
                          menuTitle="Finans kolonları"
                          onReset={resetDetailColumns}
                          onToggle={(columnId) =>
                            toggleDetailColumn(columnId as DetailColumnId)
                          }
                          resetLabel="Varsayılana dön"
                          triggerTitle="Kolonlar"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.length === 0 ? (
                      <tr>
                        <td
                          className="data-table-empty"
                          colSpan={detailColumns.length + 1}
                        >
                          Seçili filtrelerle hareket bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      detailRows.map((row) => {
                        return (
                          <tr
                            className={`finance-detail-row type-${row.kind}`}
                            key={`${row.kind}:${row.id}`}
                          >
                            {detailColumns.map((column) => (
                              <td
                                className={[
                                  column.numeric
                                    ? "finance-matrix-amount payment-credit"
                                    : "",
                                  column.id === "description"
                                    ? "finance-detail-description-cell"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                key={column.id}
                              >
                                {renderDetailCell(row, column.id)}
                              </td>
                            ))}
                            <td className="col-picker-td" />
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              )
            ) : detailGroup === "invoices" ? (
              <div className="finance-matrix-scroll">
                <table className="data-table finance-payments-table finance-invoices-table">
                  <thead>
                    <tr>
                      {INVOICE_COLUMNS.map((column) => {
                        const isActive = invoiceSort.field === column.id;
                        const indicator = isActive
                          ? invoiceSort.direction === "asc"
                            ? "▲"
                            : "▼"
                          : "↕";
                        return (
                          <th
                            aria-sort={
                              isActive
                                ? invoiceSort.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                            className={[
                              column.sortable ? "sortable-th" : "",
                              isActive ? "active" : "",
                              column.numeric ? "finance-matrix-amount" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={column.id}
                          >
                            {column.sortable ? (
                              <div className="sortable-th-shell">
                                <button
                                  className="sortable-th-btn"
                                  onClick={() =>
                                    toggleInvoiceSort(column.id as InvoiceSortField)
                                  }
                                  type="button"
                                >
                                  <span>{column.label}</span>
                                  <span
                                    className="sortable-th-indicator"
                                    aria-hidden="true"
                                  >
                                    {indicator}
                                  </span>
                                </button>
                                {column.filterable ? (
                                  <div className="sortable-th-filter">
                                    <TableHeaderFilter
                                      active={Boolean(
                                        invoiceColumnFilters[
                                          column.id as InvoiceSortField
                                        ],
                                      )}
                                      onChange={(value) =>
                                        setInvoiceColumnFilter(
                                          column.id as InvoiceSortField,
                                          value,
                                        )
                                      }
                                      options={
                                        invoiceFilterOptions.get(
                                          column.id as InvoiceSortField,
                                        ) ?? [{ value: "all", label: "Tümü" }]
                                      }
                                      title={`${column.label} filtresi`}
                                      value={
                                        invoiceColumnFilters[
                                          column.id as InvoiceSortField
                                        ] ?? "all"
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              column.label
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceRows.length === 0 ? (
                      <tr>
                        <td className="data-table-empty" colSpan={INVOICE_COLUMNS.length}>
                          Seçili filtrelerle fatura bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      invoiceRows.map((invoice) => (
                        <tr key={invoice.id}>
                          {INVOICE_COLUMNS.map((column) => (
                            <td
                              className={[
                                column.numeric
                                  ? "finance-matrix-amount payment-credit"
                                  : "",
                                column.id === "notes"
                                  ? "finance-detail-description-cell"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={column.id}
                            >
                              {renderInvoiceCell(invoice, column.id)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : detailGroup === "cashSummary" ? (
              <div className="finance-matrix-scroll">
                <table className="data-table finance-payments-table finance-cash-summary-table">
                  <thead>
                    <tr>
                      {CASH_SUMMARY_COLUMNS.map((column) => {
                        const isActive = cashSummarySort.field === column.id;
                        const indicator = isActive
                          ? cashSummarySort.direction === "asc"
                            ? "▲"
                            : "▼"
                          : "↕";
                        return (
                          <th
                            aria-sort={
                              isActive
                                ? cashSummarySort.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                            className={[
                              column.sortable ? "sortable-th" : "",
                              isActive ? "active" : "",
                              column.numeric ? "finance-matrix-amount" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={column.id}
                          >
                            <div className="sortable-th-shell">
                              <button
                                className="sortable-th-btn"
                                onClick={() => toggleCashSummarySort(column.id)}
                                type="button"
                              >
                                <span>{column.label}</span>
                                <span
                                  className="sortable-th-indicator"
                                  aria-hidden="true"
                                >
                                  {indicator}
                                </span>
                              </button>
                              {column.filterable ? (
                                <div className="sortable-th-filter">
                                  <TableHeaderFilter
                                    active={Boolean(
                                      cashSummaryColumnFilters[column.id],
                                    )}
                                    onChange={(value) =>
                                      setCashSummaryColumnFilter(
                                        column.id,
                                        value,
                                      )
                                    }
                                    options={
                                      cashSummaryFilterOptions.get(
                                        column.id,
                                      ) ?? [{ value: "all", label: "Tümü" }]
                                    }
                                    title={`${column.label} filtresi`}
                                    value={
                                      cashSummaryColumnFilters[column.id] ??
                                      "all"
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {cashSummaryRows.length === 0 ? (
                      <tr>
                        <td className="data-table-empty" colSpan={CASH_SUMMARY_COLUMNS.length}>
                          Kasa hareketi bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      cashSummaryRows.map((row) => (
                        <tr key={row.key}>
                          {CASH_SUMMARY_COLUMNS.map((column) => (
                            <td
                              className={[
                                column.id === "name" ? "job-type" : "",
                                column.numeric ? "finance-matrix-amount" : "",
                                column.id === "balance" ||
                                column.id === "selectedInflow"
                                  ? "payment-credit"
                                  : "",
                                column.id === "selectedOutflow"
                                  ? "payment-debit"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={column.id}
                            >
                              {renderCashSummaryCell(row, column.id)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="finance-matrix-scroll">
                <table className="data-table finance-payments-table finance-cash-movements-table">
                  <thead>
                    <tr>
                      {CASH_MOVEMENT_COLUMNS.map((column) => {
                        const isActive = cashMovementSort.field === column.id;
                        const indicator = isActive
                          ? cashMovementSort.direction === "asc"
                            ? "▲"
                            : "▼"
                          : "↕";
                        return (
                          <th
                            aria-sort={
                              isActive
                                ? cashMovementSort.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                            className={[
                              column.sortable ? "sortable-th" : "",
                              isActive ? "active" : "",
                              column.numeric ? "finance-matrix-amount" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={column.id}
                          >
                            <div className="sortable-th-shell">
                              <button
                                className="sortable-th-btn"
                                onClick={() => toggleCashMovementSort(column.id)}
                                type="button"
                              >
                                <span>{column.label}</span>
                                <span
                                  className="sortable-th-indicator"
                                  aria-hidden="true"
                                >
                                  {indicator}
                                </span>
                              </button>
                              {column.filterable ? (
                                <div className="sortable-th-filter">
                                  <TableHeaderFilter
                                    active={Boolean(
                                      cashMovementColumnFilters[column.id],
                                    )}
                                    onChange={(value) =>
                                      setCashMovementColumnFilter(
                                        column.id,
                                        value,
                                      )
                                    }
                                    options={
                                      cashMovementFilterOptions.get(
                                        column.id,
                                      ) ?? [{ value: "all", label: "Tümü" }]
                                    }
                                    title={`${column.label} filtresi`}
                                    value={
                                      cashMovementColumnFilters[column.id] ??
                                      "all"
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {cashMovementRows.length === 0 ? (
                      <tr>
                        <td className="data-table-empty" colSpan={CASH_MOVEMENT_COLUMNS.length}>
                          Kasa hareketi bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      cashMovementRows.map((row) => (
                        <tr className={`finance-detail-row type-${row.type === "Giriş" ? "payment" : "refund"}`} key={row.id}>
                          {CASH_MOVEMENT_COLUMNS.map((column) => (
                            <td
                              className={[
                                column.id === "description"
                                  ? "finance-detail-description-cell"
                                  : "",
                                column.numeric
                                  ? "finance-matrix-amount payment-credit"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={column.id}
                            >
                              {renderCashMovementCell(row, column.id)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="instructor-detail-card finance-matrix-card">
            <div className="finance-matrix-card-head">
              <div>
                <h3 className="candidate-detail-section-title">
                  Dönem İstatistik
                </h3>
                <div className="finance-matrix-card-subtitle">
                  {termLabel(statsMonth, null)} dönemindeki ciro ve tahsilat özeti.
                </div>
              </div>
              <div className="payments-filter-field finance-period-picker">
                <label className="form-label" htmlFor="payments-stats-month">
                  Dönem
                </label>
                <LocalizedDateInput
                  ariaLabel="Dönem"
                  className="form-input"
                  mode="month"
                  name="payments-stats-month"
                  onChange={(value) => setStatsMonth(value)}
                  placeholder="Dönem"
                  value={statsMonth}
                />
              </div>
            </div>

            <div className="finance-matrix-scroll">
              <table className="data-table finance-payments-table finance-period-stats-table">
                <thead>
                  <tr>
                    {PERIOD_STATS_COLUMNS.map((column) => {
                      const isActive = periodStatsSort.field === column.id;
                      const indicator = isActive
                        ? periodStatsSort.direction === "asc"
                          ? "▲"
                          : "▼"
                        : "↕";
                      return (
                        <th
                          aria-sort={
                            isActive
                              ? periodStatsSort.direction === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                          className={[
                            column.sortable ? "sortable-th" : "",
                            isActive ? "active" : "",
                            column.numeric ? "finance-matrix-amount" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={column.id}
                        >
                          <div className="sortable-th-shell">
                            <button
                              className="sortable-th-btn"
                              onClick={() => togglePeriodStatsSort(column.id)}
                              type="button"
                            >
                              <span>{column.label}</span>
                              <span
                                className="sortable-th-indicator"
                                aria-hidden="true"
                              >
                                {indicator}
                              </span>
                            </button>
                            {column.filterable ? (
                              <div className="sortable-th-filter">
                                <TableHeaderFilter
                                  active={Boolean(
                                    periodStatsColumnFilters[column.id],
                                  )}
                                  onChange={(value) =>
                                    setPeriodStatsColumnFilter(
                                      column.id,
                                      value,
                                    )
                                  }
                                  options={
                                    periodStatsFilterOptions.get(column.id) ?? [
                                      { value: "all", label: "Tümü" },
                                    ]
                                  }
                                  title={`${column.label} filtresi`}
                                  value={
                                    periodStatsColumnFilters[column.id] ?? "all"
                                  }
                                />
                              </div>
                            ) : null}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {periodStats.items.length === 0 ? (
                    <tr>
                      <td className="data-table-empty" colSpan={6}>
                        Seçili dönemde istatistik bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    periodStats.items.map((row) => (
                      <tr key={row.key}>
                        <th scope="row">{row.licenseClass}</th>
                        <td className="finance-matrix-amount">{row.count}</td>
                        <td className="finance-matrix-amount">{money(row.revenue)}</td>
                        <td className="finance-matrix-amount">
                          {row.count > 0 ? money(row.revenue / row.count) : "-"}
                        </td>
                        <td className="finance-matrix-amount payment-credit">
                          {money(row.collected)}
                        </td>
                        <td className="finance-matrix-amount finance-period-percent">
                          {row.revenue > 0
                            ? percent((row.collected / row.revenue) * 100)
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Toplam</th>
                    <td className="finance-matrix-amount finance-matrix-total">
                      {periodStats.total.count}
                    </td>
                    <td className="finance-matrix-amount finance-matrix-total">
                      {money(periodStats.total.revenue)}
                    </td>
                    <td className="finance-matrix-amount finance-matrix-total">
                      {periodStats.total.count > 0
                        ? money(periodStats.total.revenue / periodStats.total.count)
                        : "-"}
                    </td>
                    <td className="finance-matrix-amount finance-matrix-total payment-credit">
                      {money(periodStats.total.collected)}
                    </td>
                    <td className="finance-matrix-amount finance-matrix-total">
                      {periodStats.total.revenue > 0
                        ? percent(
                            (periodStats.total.collected /
                              periodStats.total.revenue) *
                              100,
                          )
                        : "-"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
