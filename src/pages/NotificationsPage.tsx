import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { PageToolbar } from "../components/layout/PageToolbar";
import { NotificationListSkeleton } from "../components/ui/Skeleton";
import { useT } from "../lib/i18n";
import { getNotifications, notificationTone } from "../lib/notifications-api";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function NotificationsPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: ({ signal }) => getNotifications(signal),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const items = notificationsQuery.data?.items ?? [];
  const loading = notificationsQuery.isLoading;
  const openNotificationLink = (linkPath: string | null) => {
    if (!linkPath) return;
    navigate(linkPath, linkPath.startsWith("/candidates/")
      ? {
          state: {
            returnLabel: "← Bildirimlere dön",
            returnTo: `${location.pathname}${location.search}`,
          },
        }
      : undefined);
  };

  return (
    <>
      <PageToolbar title={t("notifPage.title")} />

      <div className="notif-page">
        {loading ? (
          <NotificationListSkeleton />
        ) : items.length === 0 ? (
          <div className="data-table-empty" style={{ padding: "48px 0", textAlign: "center" }}>
            {t("notifPage.empty.all")}
          </div>
        ) : (
          <ul className="notif-page-list">
            {items.map((n) => (
              <li
                className="notif-page-item unread"
                key={n.id}
                onClick={() => openNotificationLink(n.linkPath)}
                style={n.linkPath ? { cursor: "pointer" } : undefined}
              >
                <span className={`notif-dot-tone tone-${notificationTone(n.severity)}`} />
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-text">{n.body}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
