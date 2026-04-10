import type { JobsSummaryTone } from "../../mock/mebJobs";

type JobsSummaryCardProps = {
  count: number;
  label: string;
  tone: JobsSummaryTone;
};

export function JobsSummaryCard({ count, label, tone }: JobsSummaryCardProps) {
  return (
    <div className="jobs-summary-card">
      <div>
        <div className={`sum-num tone-${tone}`}>{count}</div>
        <div className="sum-label">{label}</div>
      </div>
    </div>
  );
}
