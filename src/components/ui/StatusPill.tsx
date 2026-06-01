import type { JobStatus } from "../../types";
import { useT, type TranslationKey } from "../../lib/i18n";

const LABEL_KEY: Record<JobStatus, TranslationKey> = {
  success: "jobStatus.success",
  running: "jobStatus.running",
  queued: "jobStatus.queued",
  failed: "jobStatus.failed",
  warning: "jobStatus.warning",
  manual: "jobStatus.manual",
};

type StatusPillProps = {
  status: JobStatus;
  label?: string;
};

export function StatusPill({ status, label }: StatusPillProps) {
  const t = useT();
  return (
    <span className={`job-status-pill pill-${status}`}>
      <span className="dot" />
      {label ?? t(LABEL_KEY[status])}
    </span>
  );
}
