import { useState } from "react";

import { PlusIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { NewPaymentModal } from "../components/modals/NewPaymentModal";
import { PaymentCard } from "../components/ui/PaymentCard";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import {
  formatPaymentAmount,
  mockPayments,
  paymentSummary,
} from "../mock/payments";

export function PaymentsPage() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSubmit = () => {
    setModalOpen(false);
    showToast("Tahsilat kaydedildi, makbuz oluşturuldu");
  };

  return (
    <>
      <PageToolbar
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => showToast("Rapor oluşturuluyor")}
              type="button"
            >
              Rapor Oluştur
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setModalOpen(true)}
              type="button"
            >
              <PlusIcon size={14} />
              Tahsilat Girişi
            </button>
          </>
        }
        title="Tahsilat"
      />

      <div className="payment-cards">
        {paymentSummary.map((s) => (
          <PaymentCard key={s.label} label={s.label} tone={s.tone} value={s.value} />
        ))}
      </div>

      <div className="table-wrap">
        <Panel title="Son Tahsilatlar">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Aday</th>
                <th>Tutar</th>
                <th>Ödeme Tipi</th>
                <th>Makbuz</th>
              </tr>
            </thead>
            <tbody>
              {mockPayments.map((p) => (
                <tr key={p.id}>
                  <td><span className="job-time">{p.date}</span></td>
                  <td><span className="job-type">{p.candidate}</span></td>
                  <td><span className="payment-credit">{formatPaymentAmount(p.amount)}</span></td>
                  <td>{p.method}</td>
                  <td><StatusPill label={p.receiptLabel} status={p.receiptStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <NewPaymentModal
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        open={modalOpen}
      />
    </>
  );
}
