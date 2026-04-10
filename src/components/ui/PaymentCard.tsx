import type { PaymentSummaryTone } from "../../mock/payments";

type PaymentCardProps = {
  label: string;
  value: string;
  tone: PaymentSummaryTone;
};

export function PaymentCard({ label, value, tone }: PaymentCardProps) {
  return (
    <div className="payment-card">
      <h4>{label}</h4>
      <div className={`amount tone-${tone}`}>{value}</div>
    </div>
  );
}
