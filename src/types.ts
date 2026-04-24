export type NavKey =
  | "dashboard"
  | "candidates"
  | "groups"
  | "documents"
  | "documentTypes"
  | "payments"
  | "training"
  | "exams"
  | "examESinav"
  | "examUygulama"
  | "mebjobs"
  | "settings"
  | "users"
  | "permissions"
  | "login";

export type JobStatus =
  | "success"
  | "running"
  | "queued"
  | "failed"
  | "retry"
  | "manual";

export type TaskStatus =
  | "bekliyor"
  | "devam"
  | "tamamlandi"
  | "hata"
  | "manuel";

export type TaskPriority = "high" | "medium" | "low";
