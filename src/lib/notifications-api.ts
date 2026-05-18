import { httpGet } from "./http";

export type NotificationSeverity = "expired" | "warning" | "info";

export interface NotificationResponse {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  linkPath: string | null;
  createdAtUtc: string;
}

export interface NotificationListResponse {
  items: NotificationResponse[];
  unreadCount: number;
}

export function getNotifications(
  signal?: AbortSignal
): Promise<NotificationListResponse> {
  return httpGet<NotificationListResponse>("/api/notifications", undefined, { signal });
}
