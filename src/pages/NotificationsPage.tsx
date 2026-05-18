import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { useT } from "../lib/i18n";
import {
  getNotifications,
  type NotificationResponse,
} from "../lib/notifications-api";

export function NotificationsPage() {
  const t = useT();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getNotifications(controller.signal)
      .then((response) => setItems(response.items))
      .catch(() => {
        /* surface nothing; the page is informational */
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <PageToolbar title={t("notifPage.title")} />

      <div className="notif-page">
        {loading ? (
          <div className="data-table-empty" style={{ padding: "48px 0", textAlign: "center" }}>
            {t("common.loading")}
          </div>
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
                onClick={() => n.linkPath && navigate(n.linkPath)}
                style={n.linkPath ? { cursor: "pointer" } : undefined}
              >
                <span
                  className={`notif-dot-tone tone-${n.severity === "expired" ? "danger" : "warn"}`}
                />
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
