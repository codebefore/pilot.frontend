import type { ReactNode } from "react";

export type StatCardTone = "brand" | "orange" | "blue" | "purple";

type StatCardProps = {
  label: string;
  value: ReactNode;
  tone: StatCardTone;
  icon: ReactNode;
  sub?: ReactNode;
};

export function StatCard({ label, value, tone, icon, sub }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className={`stat-card-icon tone-${tone}`}>{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}
