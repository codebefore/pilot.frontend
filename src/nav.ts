import type { ComponentType } from "react";

import {
  CandidatesIcon,
  DashboardIcon,
  DocumentsIcon,
  ExamsIcon,
  GroupsIcon,
  MebIcon,
  PaymentsIcon,
  SettingsIcon,
  TrainingIcon,
} from "./components/icons";
import type { TranslationKey } from "./lib/i18n";
import type { NavKey } from "./types";

export type NavItem = {
  key: NavKey;
  path: string;
  labelKey: TranslationKey;
  Icon: ComponentType;
  permissionAreas: readonly string[];
  children?: NavChildItem[];
};

type NavChildItem = {
  key: NavKey;
  path: string;
  labelKey: TranslationKey;
  permissionAreas?: readonly string[];
};

type NavSection = {
  headingKey: TranslationKey;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    headingKey: "nav.main",
    items: [
      {
        key: "dashboard",
        path: "/",
        labelKey: "nav.dashboard",
        Icon: DashboardIcon,
        permissionAreas: ["dashboard"],
      },
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
        permissionAreas: ["candidates"],
      },
      {
        key: "documents",
        path: "/documents",
        labelKey: "nav.documents",
        Icon: DocumentsIcon,
        permissionAreas: ["documents"],
      },
      {
        key: "groups",
        path: "/groups",
        labelKey: "nav.groups",
        Icon: GroupsIcon,
        permissionAreas: ["groups"],
      },
      {
        key: "exams",
        path: "/exams",
        labelKey: "nav.exams",
        Icon: ExamsIcon,
        permissionAreas: ["groups"],
        children: [
          { key: "examESinav", path: "/exams/e-sinav", labelKey: "nav.examESinav" },
          { key: "examUygulama", path: "/exams/uygulama", labelKey: "nav.examUygulama" },
        ],
      },
      {
        key: "training",
        path: "/training",
        labelKey: "nav.training",
        Icon: TrainingIcon,
        permissionAreas: ["training"],
        children: [
          { key: "trainingTeorik", path: "/training/teorik", labelKey: "nav.trainingTeorik" },
          { key: "trainingUygulama", path: "/training/uygulama", labelKey: "nav.trainingUygulama" },
        ],
      },
      {
        key: "payments",
        path: "/payments",
        labelKey: "nav.payments",
        Icon: PaymentsIcon,
        permissionAreas: ["payments"],
        children: [
          {
            key: "paymentsCollections",
            path: "/payments/collections",
            labelKey: "nav.paymentsCollections",
          },
          {
            key: "paymentsBalances",
            path: "/payments/balances",
            labelKey: "nav.paymentsBalances",
          },
          {
            key: "paymentsCash",
            path: "/payments/cash",
            labelKey: "nav.paymentsCash",
          },
          {
            key: "paymentsInvoices",
            path: "/payments/invoices",
            labelKey: "nav.paymentsInvoices",
          },
          {
            key: "paymentsStatistics",
            path: "/payments/statistics",
            labelKey: "nav.paymentsStatistics",
          },
        ],
      },
    ],
  },
  {
    headingKey: "nav.administration",
    items: [
      {
        key: "settings",
        path: "/settings",
        labelKey: "nav.settings",
        Icon: SettingsIcon,
        permissionAreas: [
          "settings",
          "candidates",
          "users",
          "permissions",
          "training",
          "payments",
          "documents",
          "documentTypes",
          "mebjobs",
        ],
      },
      {
        key: "mebjobs",
        path: "/meb-jobs",
        labelKey: "nav.mebJobs",
        Icon: MebIcon,
        permissionAreas: ["mebjobs"],
      },
    ],
  },
  {
    headingKey: "nav.superAdmin",
    items: [
      {
        key: "institutions",
        path: "/institutions",
        labelKey: "institutionSelector.menuLabel",
        Icon: SettingsIcon,
        permissionAreas: ["__superadmin"],
      },
      {
        key: "outbox",
        path: "/outbox",
        labelKey: "nav.outbox",
        Icon: MebIcon,
        permissionAreas: ["__superadmin"],
      },
    ],
  },
];
