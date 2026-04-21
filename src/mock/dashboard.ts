import type { JobStatus, TaskPriority, TaskStatus } from "../types";

export type PendingTask = {
  id: string;
  priority: TaskPriority;
  title: string;
  source: string;
  time: string;
  status: TaskStatus;
};

export const pendingTasks: PendingTask[] = [
  {
    id: "t1",
    priority: "high",
    title: "MEB Aday Kaydı — Ahmet Yılmaz başarısız",
    source: "MEBBIS Aday Kaydı",
    time: "12 dk önce",
    status: "hata",
  },
  {
    id: "t2",
    priority: "high",
    title: "3 adayın evrak süresi yarın doluyor",
    source: "Evrak Takibi",
    time: "Otomatik uyarı",
    status: "bekliyor",
  },
  {
    id: "t3",
    priority: "medium",
    title: "MEB Dönem Kapanışı — Grup 2026-03 manuel onay gerekli",
    source: "MEBBIS Dönem",
    time: "1 saat önce",
    status: "manuel",
  },
  {
    id: "t4",
    priority: "low",
    title: "B sınıfı Nisan grubu için 8 aday eğitim planına bağlı değil",
    source: "Eğitim Planı",
    time: "Bugün",
    status: "devam",
  },
  {
    id: "t5",
    priority: "low",
    title: "5 adaydan tahsilat bakiyesi kaldı",
    source: "Muhasebe",
    time: "Bu hafta",
    status: "bekliyor",
  },
];

export type MebJob = {
  id: string;
  jobType: string;
  target: string;
  status: JobStatus;
  time: string;
};

export const recentMebJobs: MebJob[] = [
  { id: "j1", jobType: "Aday Kaydı",      target: "Ahmet Yılmaz",          status: "failed",  time: "14:32" },
  { id: "j2", jobType: "Belge Gönderimi", target: "Fatma Demir (3 belge)", status: "running", time: "14:28" },
  { id: "j3", jobType: "Dönem Kapanışı",  target: "Grup 2026-03",          status: "manual",  time: "13:15" },
  { id: "j4", jobType: "Grup Oluşturma",  target: "B Sınıfı — NİSAN 2026", status: "success", time: "11:42" },
  { id: "j5", jobType: "Aday Kaydı",      target: "Zeynep Kara",           status: "success", time: "11:20" },
  { id: "j6", jobType: "Fatura Kaydı",    target: "12 aday — toplu",       status: "success", time: "10:05" },
];

export type ActivityEvent = {
  id: string;
  avatar: string;
  avatarTone: "brand" | "blue" | "purple" | "amber";
  actor: string;
  description: string;
  time: string;
};

export const recentActivity: ActivityEvent[] = [
  {
    id: "a1",
    avatar: "MS",
    avatarTone: "brand",
    actor: "Mehmet Sezer",
    description: "yeni aday Emre Şahin kaydetti",
    time: "5 dk önce",
  },
  {
    id: "a2",
    avatar: "SY",
    avatarTone: "blue",
    actor: "Selin Yıldız",
    description: "3 aday için tahsilat girdi",
    time: "22 dk önce",
  },
  {
    id: "a3",
    avatar: "SİS",
    avatarTone: "purple",
    actor: "Sistem",
    description: "MEB belge gönderimi başlatıldı — Fatma Demir",
    time: "32 dk önce",
  },
  {
    id: "a4",
    avatar: "MS",
    avatarTone: "brand",
    actor: "Mehmet Sezer",
    description: "Nisan B sınıfı grubunu oluşturdu",
    time: "1 saat önce",
  },
  {
    id: "a5",
    avatar: "AK",
    avatarTone: "amber",
    actor: "Ayşe Korkmaz",
    description: "4 adayın evrağını yükledi",
    time: "2 saat önce",
  },
];
