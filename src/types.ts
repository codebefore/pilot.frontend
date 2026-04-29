export type NavKey =
  | "dashboard"
  | "candidates"
  | "groups"
  | "documents"
  | "payments"
  | "training"
  | "trainingTeorik"
  | "trainingUygulama"
  | "exams"
  | "examESinav"
  | "examUygulama"
  | "mebjobs"
  | "settings"
  | "login";

export type JobStatus =
  | "success"
  | "running"
  | "queued"
  | "failed"
  | "warning"
  | "manual";

export type TaskStatus =
  | "bekliyor"
  | "devam"
  | "tamamlandi"
  | "hata"
  | "manuel";

export type TaskPriority = "high" | "medium" | "low";
