import type { JobStatus } from "../types";

export type MebJob = {
  id: string;
  jobNo: string;
  jobType: string;
  target: string;
  step: string;
  status: JobStatus;
  startedAt: string;
};

export const mockMebJobs: MebJob[] = [
  {
    id: "j1024",
    jobNo: "#1024",
    jobType: "Aday Kaydı",
    target: "Ahmet Yılmaz",
    step: "3/5 — Belge Yükleme",
    status: "failed",
    startedAt: "14:28",
  },
  {
    id: "j1023",
    jobNo: "#1023",
    jobType: "Belge Gönderimi",
    target: "Fatma Demir",
    step: "2/4 — Fotoğraf Yükleme",
    status: "running",
    startedAt: "14:25",
  },
  {
    id: "j1022",
    jobNo: "#1022",
    jobType: "Dönem Kapanışı",
    target: "Grup 2026-03",
    step: "4/6 — MEB Onay Sayfası",
    status: "manual",
    startedAt: "13:12",
  },
  {
    id: "j1021",
    jobNo: "#1021",
    jobType: "Aday Kaydı",
    target: "Emre Şahin",
    step: "1/5 — Giriş",
    status: "queued",
    startedAt: "14:30",
  },
  {
    id: "j1020",
    jobNo: "#1020",
    jobType: "Grup Oluşturma",
    target: "B Sınıfı — Nisan 2026",
    step: "5/5",
    status: "success",
    startedAt: "11:38",
  },
  {
    id: "j1019",
    jobNo: "#1019",
    jobType: "Aday Kaydı",
    target: "Zeynep Kara",
    step: "5/5",
    status: "success",
    startedAt: "11:15",
  },
  {
    id: "j1018",
    jobNo: "#1018",
    jobType: "Fatura Kaydı",
    target: "Toplu — 12 aday",
    step: "3/3",
    status: "success",
    startedAt: "10:02",
  },
];

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
  { status: "retry",   label: "Yeniden Dene", tone: "orange" },
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
