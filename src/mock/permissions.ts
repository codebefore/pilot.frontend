import type { UserRole } from "./users";

export type PermissionLevel = "none" | "view" | "full";

export type PermissionArea =
  | "candidates"
  | "groups"
  | "documents"
  | "payments"
  | "training"
  | "mebjobs"
  | "users"
  | "settings";

export const PERMISSION_AREAS: { key: PermissionArea; label: string }[] = [
  { key: "candidates", label: "Adaylar" },
  { key: "groups",     label: "Gruplar" },
  { key: "documents",  label: "Evrak" },
  { key: "payments",   label: "Muhasebe" },
  { key: "training",   label: "Eğitim Planı" },
  { key: "mebjobs",    label: "MEB İşleri" },
  { key: "users",      label: "Kullanıcılar" },
  { key: "settings",   label: "Kurum Ayarları" },
];

export const PERMISSION_ROLES: UserRole[] = [
  "Patron",
  "Muhasebe",
  "Operasyon",
  "Eğitmen",
];

export const LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: "Yok",
  view: "Görüntüle",
  full: "Tam Yetki",
};

export type PermissionMatrix = Record<UserRole, Record<PermissionArea, PermissionLevel>>;

export const initialPermissionMatrix: PermissionMatrix = {
  Patron: {
    candidates: "full",
    groups:     "full",
    documents:  "full",
    payments:   "full",
    training:   "full",
    mebjobs:    "full",
    users:      "full",
    settings:   "full",
  },
  Muhasebe: {
    candidates: "view",
    groups:     "view",
    documents:  "view",
    payments:   "full",
    training:   "none",
    mebjobs:    "view",
    users:      "none",
    settings:   "none",
  },
  Operasyon: {
    candidates: "full",
    groups:     "full",
    documents:  "full",
    payments:   "view",
    training:   "full",
    mebjobs:    "full",
    users:      "none",
    settings:   "none",
  },
  "Eğitmen": {
    candidates: "view",
    groups:     "view",
    documents:  "none",
    payments:   "none",
    training:   "view",
    mebjobs:    "none",
    users:      "none",
    settings:   "none",
  },
};
