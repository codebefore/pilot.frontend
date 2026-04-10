import type { JobStatus } from "../../types";

const LABELS: Record<JobStatus, string> = {
  success: "Başarılı",
  running: "Çalışıyor",
  queued:  "Bekliyor",
  failed:  "Hata",
  retry:   "Tekrar",
  manual:  "Manuel",
};

type StatusPillProps = {
  status: JobStatus;
  label?: string;
};

export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <span className={`job-status-pill pill-${status}`}>
      <span className="dot" />
      {label ?? LABELS[status]}
    </span>
  );
}
