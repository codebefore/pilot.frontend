import type { ComponentType } from "react";

import {
  CandidatesIcon,
  DashboardIcon,
  DocumentsIcon,
  ExamsIcon,
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
  children?: NavChildItem[];
};

export type NavChildItem = {
  key: NavKey;
  path: string;
  labelKey: TranslationKey;
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
      { key: "candidates", path: "/candidates", labelKey: "nav.candidates", Icon: CandidatesIcon },
      { key: "groups",     path: "/groups",     labelKey: "nav.groups",     Icon: GroupsIcon },
      { key: "documents",  path: "/documents",  labelKey: "nav.documents",  Icon: DocumentsIcon },
      { key: "payments",   path: "/payments",   labelKey: "nav.payments",   Icon: PaymentsIcon },
      { key: "training",   path: "/training",   labelKey: "nav.training",   Icon: TrainingIcon },
      {
        key: "exams",
        path: "/exams",
        labelKey: "nav.exams",
        Icon: ExamsIcon,
        children: [
          { key: "examESinav", path: "/exams/e-sinav", labelKey: "nav.examESinav" },
          { key: "examUygulama", path: "/exams/uygulama", labelKey: "nav.examUygulama" },
        ],
      },
    ],
  },
  {
    headingKey: "nav.mebIntegration",
    items: [
      { key: "mebjobs", path: "/meb-jobs", labelKey: "nav.mebJobs", Icon: MebIcon },
    ],
  },
  {
    headingKey: "nav.administration",
    items: [
      { key: "settings",      path: "/settings",      labelKey: "nav.settings",      Icon: SettingsIcon },
      { key: "documentTypes", path: "/document-types", labelKey: "nav.documentTypes", Icon: DocumentsIcon },
      { key: "users",         path: "/users",         labelKey: "nav.users",         Icon: UsersIcon },
      { key: "permissions",   path: "/permissions",   labelKey: "nav.permissions",   Icon: KeyIcon },
      { key: "login",         path: "/login",         labelKey: "nav.login",         Icon: LoginIcon },
    ],
  },
];
