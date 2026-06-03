import { getPlatformApiBaseUrl } from "./api";
import { httpGet } from "./http";

type NotificationSeverity = "expired" | "warning" | "info";

export interface NotificationResponse {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  linkPath: string | null;
  createdAtUtc: string;
}

interface NotificationListResponse {
  items: NotificationResponse[];
  unreadCount: number;
}

export function getNotifications(
  signal?: AbortSignal
): Promise<NotificationListResponse> {
  return httpGet<NotificationListResponse>("/api/notifications", undefined, {
    baseUrl: getPlatformApiBaseUrl(),
    signal,
  });
}

export function notificationTone(severity: NotificationSeverity): "danger" | "warn" | "info" {
  switch (severity) {
    case "expired":
      return "danger";
    case "warning":
      return "warn";
    case "info":
      return "info";
  }
}
