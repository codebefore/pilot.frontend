import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { PaymentCard } from "../components/ui/PaymentCard";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { getPaymentsOverview } from "../lib/payments-api";
import { formatDateTR } from "../lib/status-maps";
import type {
  CandidateBillingStatus,
  CandidatePaymentInstallmentPaymentStatus,
  CandidatePaymentMethod,
  PaymentsOverviewResponse,
} from "../lib/types";

type TabKey = "payments" | "installments" | "charges" | "cancelled";
type StatusFilter = "all" | "active" | "cancelled";
type InstallmentScopeFilter = "all" | "overdue" | "today" | "upcoming";

const TABS: { key: TabKey; label: string }[] = [
  { key: "payments", label: "Tahsilatlar" },
  { key: "installments", label: "Vadeler" },
  { key: "charges", label: "Borçlar" },
  { key: "cancelled", label: "İptaller" },
];

function money(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function candidateName(candidate: { firstName: string; lastName: string }): string {
  return `${candidate.firstName} ${candidate.lastName}`.trim();
}

function paymentMethodLabel(method: CandidatePaymentMethod): string {
  if (method === "cash") return "Nakit";
  if (method === "card") return "Kart";
  if (method === "bank_transfer") return "Havale/EFT";
  return "Diğer";
}

function installmentStatusLabel(status: CandidatePaymentInstallmentPaymentStatus): string {
  if (status === "paid") return "Ödendi";
  if (status === "partial") return "Kısmi";
  if (status === "overdue") return "Gecikti";
  if (status === "cancelled") return "İptal";
  return "Bekliyor";
}

function statusTone(status: CandidateBillingStatus | CandidatePaymentInstallmentPaymentStatus) {
  if (status === "active" || status === "paid") return "success";
  if (status === "overdue" || status === "cancelled") return "failed";
  if (status === "partial") return "queued";
  return "manual";
}

function dateKey(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? "";
}

function isInDateRange(value: string, fromDate: string, toDate: string): boolean {
  const day = dateKey(value);
  if (!day) return true;
  if (fromDate && day < fromDate) return false;
  if (toDate && day > toDate) return false;
  return true;
}

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function candidateDetailPath(candidateId: string, params?: Record<string, string>): string {
  const search = new URLSearchParams(params ?? {});
  const suffix = search.toString();
  return `/candidates/${candidateId}${suffix ? `?${suffix}` : ""}`;
}

function candidatePaymentsPath(candidateId: string, params?: Record<string, string>): string {
  return candidateDetailPath(candidateId, { tab: "payments", ...(params ?? {}) });
}

function installmentPriority(
  installment: {
    dueDate: string;
    paymentStatus: CandidatePaymentInstallmentPaymentStatus;
    remainingAmount: number;
    status: string;
  },
  today: string
): number {
  if (installment.paymentStatus === "overdue") return 0;
  if (installment.dueDate === today && installment.remainingAmount > 0) return 1;
  if (installment.dueDate > today && installment.status === "active" && installment.remainingAmount > 0) return 2;
  if (installment.paymentStatus === "partial") return 3;
  if (installment.paymentStatus === "pending") return 4;
  if (installment.paymentStatus === "paid") return 5;
  return 6;
}

export function PaymentsPage() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<PaymentsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("payments");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<"all" | CandidatePaymentMethod>("all");
  const [licenseClassFilter, setLicenseClassFilter] = useState("all");
  const [installmentScopeFilter, setInstallmentScopeFilter] = useState<InstallmentScopeFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getPaymentsOverview(controller.signal)
      .then(setOverview)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast("Tahsilat verileri yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [showToast]);

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const filterCandidate = (candidate: { firstName: string; lastName: string; nationalId: string }) => {
    if (!normalizedQuery) return true;
    return `${candidate.firstName} ${candidate.lastName} ${candidate.nationalId}`
      .toLocaleLowerCase("tr-TR")
      .includes(normalizedQuery);
  };

  const licenseClasses = useMemo(() => {
    if (!overview) return [];
    const values = [
      ...overview.payments.map((item) => item.candidate.licenseClass),
      ...overview.installments.map((item) => item.candidate.licenseClass),
      ...overview.charges.map((item) => item.candidate.licenseClass),
    ];
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [overview]);

  const cancelledItems = useMemo(() => {
    if (!overview) return [];
    return [
      ...overview.payments
        .filter((item) => item.status === "cancelled")
        .map((item) => ({
          id: item.id,
          candidate: item.candidate,
          type: "Tahsilat",
          amount: item.amount,
          date: item.cancelledAtUtc ?? item.paidAtUtc,
          reason: item.cancellationReason,
        })),
      ...overview.charges
        .filter((item) => item.status === "cancelled")
        .map((item) => ({
          id: item.id,
          candidate: item.candidate,
          type: "Borç",
          amount: item.amount,
          date: item.cancelledAtUtc ?? item.chargedAtUtc,
          reason: item.cancellationReason,
        })),
      ...overview.installments
        .filter((item) => item.status === "cancelled")
        .map((item) => ({
          id: item.id,
          candidate: item.candidate,
          type: "Vade",
          amount: item.amount,
          date: item.cancelledAtUtc ?? item.dueDate,
          reason: item.cancellationReason,
        })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [overview]);

  const filteredPayments = useMemo(() => {
    if (!overview) return [];
    return overview.payments.filter((item) => {
      if (!filterCandidate(item.candidate)) return false;
      if (licenseClassFilter !== "all" && item.candidate.licenseClass !== licenseClassFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (paymentMethodFilter !== "all" && item.paymentMethod !== paymentMethodFilter) return false;
      return isInDateRange(item.paidAtUtc, fromDate, toDate);
    });
  }, [fromDate, licenseClassFilter, normalizedQuery, overview, paymentMethodFilter, statusFilter, toDate]);

  const filteredInstallments = useMemo(() => {
    if (!overview) return [];
    const today = todayKey();
    return overview.installments
      .filter((item) => {
        if (!filterCandidate(item.candidate)) return false;
        if (licenseClassFilter !== "all" && item.candidate.licenseClass !== licenseClassFilter) return false;
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (!isInDateRange(item.dueDate, fromDate, toDate)) return false;
        if (installmentScopeFilter === "overdue") return item.paymentStatus === "overdue";
        if (installmentScopeFilter === "today") return item.dueDate === today && item.remainingAmount > 0;
        if (installmentScopeFilter === "upcoming") {
          return item.dueDate > today && item.status === "active" && item.remainingAmount > 0;
        }
        return true;
      })
      .sort((a, b) => {
        const priority = installmentPriority(a, today) - installmentPriority(b, today);
        if (priority !== 0) return priority;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [fromDate, installmentScopeFilter, licenseClassFilter, normalizedQuery, overview, statusFilter, toDate]);

  const filteredCharges = useMemo(() => {
    if (!overview) return [];
    return overview.charges.filter((item) => {
      if (!filterCandidate(item.candidate)) return false;
      if (licenseClassFilter !== "all" && item.candidate.licenseClass !== licenseClassFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return isInDateRange(item.chargedAtUtc, fromDate, toDate);
    });
  }, [fromDate, licenseClassFilter, normalizedQuery, overview, statusFilter, toDate]);

  const filteredCancelledItems = useMemo(() => {
    return cancelledItems.filter((item) => {
      if (!filterCandidate(item.candidate)) return false;
      if (licenseClassFilter !== "all" && item.candidate.licenseClass !== licenseClassFilter) return false;
      return isInDateRange(item.date, fromDate, toDate);
    });
  }, [cancelledItems, fromDate, licenseClassFilter, normalizedQuery, toDate]);

  const resetFilters = () => {
    setQuery("");
    setFromDate("");
    setToDate("");
    setStatusFilter("active");
    setPaymentMethodFilter("all");
    setLicenseClassFilter("all");
    setInstallmentScopeFilter("all");
  };

  const summary = overview?.summary;
  const activeFilterCount = [
    query.trim() !== "",
    fromDate !== "",
    toDate !== "",
    statusFilter !== "active",
    paymentMethodFilter !== "all",
    licenseClassFilter !== "all",
    installmentScopeFilter !== "all",
  ].filter(Boolean).length;
  const tabCounts: Record<TabKey, number> = {
    payments: filteredPayments.length,
    installments: filteredInstallments.length,
    charges: filteredCharges.length,
    cancelled: filteredCancelledItems.length,
  };

  return (
    <>
      <PageToolbar
        actions={
          <button
            aria-expanded={filtersOpen}
            className={`btn btn-secondary btn-sm payments-filter-toggle${activeFilterCount > 0 ? " has-filters" : ""}`}
            onClick={() => setFiltersOpen((current) => !current)}
            type="button"
          >
            Filtre
            {activeFilterCount > 0 ? (
              <span className="payments-filter-count">{activeFilterCount}</span>
            ) : null}
          </button>
        }
        title="Tahsilatlar"
      />

      <div className="payment-cards">
        <PaymentCard label="Bugünkü Tahsilat" tone="brand" value={money(summary?.todayCollected ?? 0)} />
        <PaymentCard label="Bu Ay Tahsilat" tone="blue" value={money(summary?.monthCollected ?? 0)} />
        <PaymentCard label="Aktif Bakiye" tone="red" value={money(summary?.activeBalance ?? 0)} />
        <PaymentCard label="Geciken Vadeler" tone="red" value={money(summary?.overdueInstallmentTotal ?? 0)} />
        <PaymentCard label="İptal Tahsilat" tone="blue" value={money(summary?.cancelledPaymentTotal ?? 0)} />
      </div>

      {filtersOpen ? (
        <div className="payments-filters">
          <div className="payments-filter-field payments-filter-search">
            <label className="form-label" htmlFor="payments-query">Aday / TC</label>
            <input
              className="form-input"
              id="payments-query"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Aday veya TC ara"
              value={query}
            />
          </div>
          <div className="payments-filter-field">
            <label className="form-label" htmlFor="payments-from-date">Başlangıç</label>
            <input
              className="form-input"
              id="payments-from-date"
              onChange={(event) => setFromDate(event.target.value)}
              type="date"
              value={fromDate}
            />
          </div>
          <div className="payments-filter-field">
            <label className="form-label" htmlFor="payments-to-date">Bitiş</label>
            <input
              className="form-input"
              id="payments-to-date"
              onChange={(event) => setToDate(event.target.value)}
              type="date"
              value={toDate}
            />
          </div>
          <div className="payments-filter-field">
            <label className="form-label" htmlFor="payments-status">Durum</label>
            <select
              className="form-select"
              id="payments-status"
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              value={statusFilter}
            >
              <option value="active">Aktif</option>
              <option value="all">Tümü</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          <div className="payments-filter-field">
            <label className="form-label" htmlFor="payments-method">Ödeme</label>
            <select
              className="form-select"
              id="payments-method"
              onChange={(event) => setPaymentMethodFilter(event.target.value as "all" | CandidatePaymentMethod)}
              value={paymentMethodFilter}
            >
              <option value="all">Tümü</option>
              <option value="cash">Nakit</option>
              <option value="card">Kart</option>
              <option value="bank_transfer">Havale/EFT</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div className="payments-filter-field">
            <label className="form-label" htmlFor="payments-license">Ehliyet</label>
            <select
              className="form-select"
              id="payments-license"
              onChange={(event) => setLicenseClassFilter(event.target.value)}
              value={licenseClassFilter}
            >
              <option value="all">Tümü</option>
              {licenseClasses.map((licenseClass) => (
                <option key={licenseClass} value={licenseClass}>{licenseClass}</option>
              ))}
            </select>
          </div>
          <div className="payments-filter-field">
            <label className="form-label" htmlFor="payments-installment-scope">Vade</label>
            <select
              className="form-select"
              id="payments-installment-scope"
              onChange={(event) => setInstallmentScopeFilter(event.target.value as InstallmentScopeFilter)}
              value={installmentScopeFilter}
            >
              <option value="all">Tümü</option>
              <option value="overdue">Geciken</option>
              <option value="today">Bugün</option>
              <option value="upcoming">Yaklaşan</option>
            </select>
          </div>
          <button className="btn btn-secondary payments-filter-reset" onClick={resetFilters} type="button">
            Temizle
          </button>
        </div>
      ) : null}

      <div className="payments-tabs">
        {TABS.map((tab) => (
          <button
            className={`payments-tab ${activeTab === tab.key ? "active" : ""}`}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            <span>{tab.label}</span>
            <span className="payments-tab-count">{tabCounts[tab.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading">Yükleniyor...</div>
      ) : !overview ? (
        <Panel title="Finans">Veri bulunamadı.</Panel>
      ) : (
        <div className="table-wrap">
          {activeTab === "payments" ? (
            <Panel title="Tüm Tahsilatlar">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Aday</th>
                    <th>Tutar</th>
                    <th>Yöntem</th>
                    <th>Taksit</th>
                    <th>Durum</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td className="data-table-empty" colSpan={7}>Tahsilat bulunamadı.</td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDateTR(payment.paidAtUtc)}</td>
                        <td>
                          <Link className="job-type" to={candidatePaymentsPath(payment.candidate.id)}>
                            {candidateName(payment.candidate)}
                          </Link>
                          <div className="payments-subtext">{payment.candidate.nationalId}</div>
                        </td>
                        <td className="payment-credit">{money(payment.amount)}</td>
                        <td>{paymentMethodLabel(payment.paymentMethod)}</td>
                        <td>{payment.installmentDescription ?? "—"}</td>
                        <td>
                          <StatusPill
                            label={payment.status === "active" ? "Aktif" : "İptal"}
                            status={statusTone(payment.status)}
                          />
                        </td>
                        <td>
                          <div className="payments-row-actions">
                            <Link
                              className="btn btn-secondary btn-xs"
                              to={candidatePaymentsPath(payment.candidate.id, { paymentId: payment.id })}
                            >
                              Makbuz
                            </Link>
                            <Link
                              className="btn btn-secondary btn-xs"
                              to={candidatePaymentsPath(payment.candidate.id)}
                            >
                              Adaya git
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          ) : null}

          {activeTab === "installments" ? (
            <Panel title="Vadeler">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vade</th>
                    <th>Aday</th>
                    <th>Taksit</th>
                    <th>Kalan</th>
                    <th>Durum</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstallments.length === 0 ? (
                    <tr>
                      <td className="data-table-empty" colSpan={6}>Vade bulunamadı.</td>
                    </tr>
                  ) : (
                    filteredInstallments.map((installment) => (
                      <tr key={installment.id}>
                        <td>{formatDateTR(installment.dueDate)}</td>
                        <td>
                          <Link className="job-type" to={candidatePaymentsPath(installment.candidate.id)}>
                            {candidateName(installment.candidate)}
                          </Link>
                          <div className="payments-subtext">{installment.candidate.licenseClass}</div>
                        </td>
                        <td>{installment.description}</td>
                        <td>{money(installment.remainingAmount)}</td>
                        <td>
                          <StatusPill
                            label={installmentStatusLabel(installment.paymentStatus)}
                            status={statusTone(installment.paymentStatus)}
                          />
                        </td>
                        <td>
                          <div className="payments-row-actions">
                            <Link
                              className="btn btn-primary btn-xs"
                              to={candidatePaymentsPath(installment.candidate.id, {
                                action: "payment",
                                installmentId: installment.id,
                              })}
                            >
                              Öde
                            </Link>
                            <Link
                              className="btn btn-secondary btn-xs"
                              to={candidatePaymentsPath(installment.candidate.id)}
                            >
                              Plan
                            </Link>
                            <Link
                              className="btn btn-secondary btn-xs"
                              to={candidatePaymentsPath(installment.candidate.id)}
                            >
                              Adaya git
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          ) : null}

          {activeTab === "charges" ? (
            <Panel title="Aktif Borçlar">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Aday</th>
                    <th>Açıklama</th>
                    <th>Tutar</th>
                    <th>Kaynak</th>
                    <th>Durum</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCharges.length === 0 ? (
                    <tr>
                      <td className="data-table-empty" colSpan={7}>Borç bulunamadı.</td>
                    </tr>
                  ) : (
                    filteredCharges.map((charge) => (
                      <tr key={charge.id}>
                        <td>{formatDateTR(charge.chargedAtUtc)}</td>
                        <td>
                          <Link className="job-type" to={candidatePaymentsPath(charge.candidate.id)}>
                            {candidateName(charge.candidate)}
                          </Link>
                        </td>
                        <td>{charge.description}</td>
                        <td>{money(charge.amount)}</td>
                        <td>{charge.sourceType === "matrix" ? "Matrix" : "Manuel"}</td>
                        <td>
                          <StatusPill
                            label={charge.status === "active" ? "Aktif" : "İptal"}
                            status={statusTone(charge.status)}
                          />
                        </td>
                        <td>
                          <div className="payments-row-actions">
                            <Link
                              className="btn btn-secondary btn-xs"
                              to={candidatePaymentsPath(charge.candidate.id, { chargeId: charge.id })}
                            >
                              Borç detayı
                            </Link>
                            <Link
                              className="btn btn-secondary btn-xs"
                              to={candidatePaymentsPath(charge.candidate.id)}
                            >
                              Adaya git
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          ) : null}

          {activeTab === "cancelled" ? (
            <Panel title="İptaller">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Aday</th>
                    <th>Tür</th>
                    <th>Tutar</th>
                    <th>Sebep</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCancelledItems.length === 0 ? (
                    <tr>
                      <td className="data-table-empty" colSpan={6}>İptal kaydı bulunamadı.</td>
                    </tr>
                  ) : (
                    filteredCancelledItems.map((item) => (
                      <tr key={`${item.type}-${item.id}`}>
                        <td>{formatDateTR(item.date)}</td>
                        <td>
                          <Link className="job-type" to={candidatePaymentsPath(item.candidate.id)}>
                            {candidateName(item.candidate)}
                          </Link>
                        </td>
                        <td>{item.type}</td>
                        <td>{money(item.amount)}</td>
                        <td>{item.reason ?? "—"}</td>
                        <td>
                          <div className="payments-row-actions">
                            <Link className="btn btn-secondary btn-xs" to={candidatePaymentsPath(item.candidate.id)}>
                              Detay
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          ) : null}
        </div>
      )}
    </>
  );
}
