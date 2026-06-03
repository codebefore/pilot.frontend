import type { JobStatus } from "../types";
import type { TranslationKey } from "./i18n";

export type MebJob = {
  id: string;
  jobNo: string;
  jobType: string;
  /** Aday adı (varsa). Yoksa null — TC kimlik no gösterilir. */
  candidateName: string | null;
  /** TC kimlik no veya entity id, üst satırın altında ikincil bilgi olarak kullanılır. */
  targetSecondary: string;
  step: string;
  status: JobStatus;
  /** Başlangıç tarihi (ISO) — formatlama UI'da yapılır. */
  startedAtIso: string;
  /** Bitiş tarihi (ISO) — `succeeded`/`failed`/`cancelled` için doludur. */
  completedAtIso: string | null;
  errorMessage?: string | null;
  queuePublishedAtIso?: string | null;
  queuePublishLastAttemptAtIso?: string | null;
  queuePublishAttemptCount?: number;
  queuePublishError?: string | null;
};

export type JobsSummaryTone = "brand" | "blue" | "gray" | "orange" | "purple" | "red";

type JobsSummary = {
  status: JobStatus;
  labelKey: TranslationKey;
  tone: JobsSummaryTone;
};

type JobsSummaryRow = JobsSummary & { count: number };

const SUMMARY_DEFS: JobsSummary[] = [
  { status: "success", labelKey: "jobStatus.success", tone: "brand" },
  { status: "running", labelKey: "jobStatus.running", tone: "blue" },
  { status: "queued", labelKey: "jobStatus.queued", tone: "gray" },
  { status: "manual", labelKey: "jobStatus.manual", tone: "purple" },
  { status: "failed", labelKey: "jobStatus.failed", tone: "red" },
];

export function buildJobsSummary(jobs: MebJob[]): JobsSummaryRow[] {
  return SUMMARY_DEFS.map((def) => ({
    ...def,
    count: jobs.filter((j) => j.status === def.status).length,
  }));
}
