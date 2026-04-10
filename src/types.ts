export type NavKey =
  | "dashboard"
  | "candidates"
  | "groups"
  | "documents"
  | "payments"
  | "training"
  | "mebjobs"
  | "settings"
  | "users"
  | "permissions";

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
