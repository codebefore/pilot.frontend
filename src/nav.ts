import type { ComponentType } from "react";

import {
  CandidatesIcon,
  DashboardIcon,
  DocumentsIcon,
  GroupsIcon,
  KeyIcon,
  MebIcon,
  PaymentsIcon,
  SettingsIcon,
  TrainingIcon,
  UsersIcon,
} from "./components/icons";
import type { NavKey } from "./types";

export type NavItem = {
  key: NavKey;
  path: string;
  label: string;
  Icon: ComponentType;
  badge?: { value: string | number; tone?: "info" | "warn" | "danger" };
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    heading: "Ana",
    items: [
      { key: "dashboard", path: "/", label: "Kontrol Paneli", Icon: DashboardIcon },
    ],
  },
  {
    heading: "Operasyon",
    items: [
      {
        key: "candidates",
        path: "/candidates",
        label: "Adaylar",
        Icon: CandidatesIcon,
        badge: { value: 142, tone: "info" },
      },
      { key: "groups",    path: "/groups",    label: "Gruplar / Dönemler", Icon: GroupsIcon },
      {
        key: "documents",
        path: "/documents",
        label: "Evrak",
        Icon: DocumentsIcon,
        badge: { value: 7, tone: "warn" },
      },
      { key: "payments",  path: "/payments",  label: "Tahsilat",     Icon: PaymentsIcon },
      { key: "training",  path: "/training",  label: "Eğitim Planı", Icon: TrainingIcon },
    ],
  },
  {
    heading: "MEB Entegrasyonu",
    items: [
      {
        key: "mebjobs",
        path: "/meb-jobs",
        label: "MEB İşleri",
        Icon: MebIcon,
        badge: { value: 3, tone: "danger" },
      },
    ],
  },
  {
    heading: "Yönetim",
    items: [
      { key: "settings",    path: "/settings",    label: "Kurum Ayarları",  Icon: SettingsIcon },
      { key: "users",       path: "/users",       label: "Kullanıcılar",    Icon: UsersIcon },
      { key: "permissions", path: "/permissions", label: "Yetki Yönetimi",  Icon: KeyIcon },
    ],
  },
];
