import type { JobStatus } from "../types";

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
};

export type JobsSummaryTone = "brand" | "blue" | "gray" | "orange" | "purple" | "red";

export type JobsSummary = {
  status: JobStatus;
  label: string;
  tone: JobsSummaryTone;
};

const SUMMARY_DEFS: JobsSummary[] = [
  { status: "success", label: "Başarılı",     tone: "brand" },
  { status: "running", label: "Çalışıyor",    tone: "blue" },
  { status: "queued",  label: "Kuyrukta",     tone: "gray" },
  { status: "manual",  label: "Manuel",       tone: "purple" },
  { status: "failed",  label: "Hata",         tone: "red" },
];

export type JobsSummaryRow = JobsSummary & { count: number };

export function buildJobsSummary(jobs: MebJob[]): JobsSummaryRow[] {
  return SUMMARY_DEFS.map((def) => ({
    ...def,
    count: jobs.filter((j) => j.status === def.status).length,
  }));
}
