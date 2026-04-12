import type { TranslationKey } from "../lib/i18n";

export type NotificationTone = "info" | "warn" | "danger" | "success";

export type MockNotification = {
  id: string;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  timeKey: TranslationKey;
  tone: NotificationTone;
  unread: boolean;
};

export const mockNotifications: MockNotification[] = [
  {
    id: "n1",
    titleKey: "notif.mebFailed.title",
    bodyKey: "notif.mebFailed.body",
    timeKey: "notif.time.5m",
    tone: "danger",
    unread: true,
  },
  {
    id: "n2",
    titleKey: "notif.paymentReceived.title",
    bodyKey: "notif.paymentReceived.body",
    timeKey: "notif.time.1h",
    tone: "success",
    unread: true,
  },
  {
    id: "n3",
    titleKey: "notif.newCandidate.title",
    bodyKey: "notif.newCandidate.body",
    timeKey: "notif.time.3h",
    tone: "info",
    unread: false,
  },
  {
    id: "n4",
    titleKey: "notif.documentUploaded.title",
    bodyKey: "notif.documentUploaded.body",
    timeKey: "notif.time.yesterday",
    tone: "info",
    unread: false,
  },
  {
    id: "n5",
    titleKey: "notif.groupClosing.title",
    bodyKey: "notif.groupClosing.body",
    timeKey: "notif.time.yesterday",
    tone: "warn",
    unread: false,
  },
  {
    id: "n6",
    titleKey: "notif.paymentOverdue.title",
    bodyKey: "notif.paymentOverdue.body",
    timeKey: "notif.time.2d",
    tone: "danger",
    unread: false,
  },
  {
    id: "n7",
    titleKey: "notif.mebApproved.title",
    bodyKey: "notif.mebApproved.body",
    timeKey: "notif.time.3d",
    tone: "success",
    unread: false,
  },
  {
    id: "n8",
    titleKey: "notif.trainingAssigned.title",
    bodyKey: "notif.trainingAssigned.body",
    timeKey: "notif.time.5d",
    tone: "info",
    unread: false,
  },
];

/** First N items for the header dropdown preview. */
export const recentMockNotifications = mockNotifications.slice(0, 3);
