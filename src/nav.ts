import type { ComponentType } from "react";

import {
  CandidatesIcon,
  DashboardIcon,
  DocumentsIcon,
  GroupsIcon,
  KeyIcon,
  LoginIcon,
  MebIcon,
  PaymentsIcon,
  SettingsIcon,
  TrainingIcon,
  UsersIcon,
} from "./components/icons";
import type { TranslationKey } from "./lib/i18n";
import type { NavKey } from "./types";

export type NavItem = {
  key: NavKey;
  path: string;
  labelKey: TranslationKey;
  Icon: ComponentType;
  badge?: { value: string | number; tone?: "info" | "warn" | "danger" };
};

export type NavSection = {
  headingKey: TranslationKey;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    headingKey: "nav.main",
    items: [
      { key: "dashboard", path: "/", labelKey: "nav.dashboard", Icon: DashboardIcon },
    ],
  },
  {
    headingKey: "nav.operations",
    items: [
      {
        key: "candidates",
        path: "/candidates",
        labelKey: "nav.candidates",
        Icon: CandidatesIcon,
        badge: { value: 142, tone: "info" },
      },
      { key: "groups",    path: "/groups",    labelKey: "nav.groups", Icon: GroupsIcon },
      {
        key: "documents",
        path: "/documents",
        labelKey: "nav.documents",
        Icon: DocumentsIcon,
        badge: { value: 7, tone: "warn" },
      },
      { key: "payments",  path: "/payments",  labelKey: "nav.payments", Icon: PaymentsIcon },
      { key: "training",  path: "/training",  labelKey: "nav.training", Icon: TrainingIcon },
    ],
  },
  {
    headingKey: "nav.mebIntegration",
    items: [
      {
        key: "mebjobs",
        path: "/meb-jobs",
        labelKey: "nav.mebJobs",
        Icon: MebIcon,
        badge: { value: 3, tone: "danger" },
      },
    ],
  },
  {
    headingKey: "nav.administration",
    items: [
      { key: "settings",    path: "/settings",    labelKey: "nav.settings",    Icon: SettingsIcon },
      { key: "users",       path: "/users",       labelKey: "nav.users",       Icon: UsersIcon },
      { key: "permissions", path: "/permissions", labelKey: "nav.permissions", Icon: KeyIcon },
      { key: "login",       path: "/login",       labelKey: "nav.login",       Icon: LoginIcon },
    ],
  },
];
