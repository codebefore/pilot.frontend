import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { useT } from "../../lib/i18n";
import {
  getNotifications,
  notificationTone,
  type NotificationResponse,
} from "../../lib/notifications-api";
import { BellIcon } from "../icons";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function NotificationsMenu() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notificationsQuery = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: ({ signal }) => getNotifications(signal),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const refetchNotifications = notificationsQuery.refetch;

  useEffect(() => {
    if (!open) return;
    void refetchNotifications();
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, refetchNotifications]);

  const items: NotificationResponse[] = notificationsQuery.data?.items ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? items.length;
  const visibleItems = items.slice(0, 5);

  return (
    <div className="notif-menu-wrap" ref={ref}>
      <button
        aria-label={t("header.notifications")}
        className="header-notif"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notif-dot" />}
      </button>

      {open && (
        <div className="notif-menu">
          <div className="notif-menu-header">
            <span className="notif-menu-title">{t("notif.title")}</span>
            {unreadCount > 0 ? (
              <span className="notif-menu-action">{unreadCount}</span>
            ) : null}
          </div>

          {visibleItems.length === 0 ? (
            <div className="notif-menu-empty">{t("notif.empty")}</div>
          ) : (
            <ul className="notif-list">
              {visibleItems.map((n) => (
                <li
                  className="notif-item unread"
                  key={n.id}
                  onClick={() => {
                    if (!n.linkPath) return;
                    setOpen(false);
                    navigate(n.linkPath);
                  }}
                  role={n.linkPath ? "button" : undefined}
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

          {items.length > visibleItems.length ? (
            <div className="notif-menu-footer">
              <button
                className="notif-menu-action"
                onClick={() => {
                  setOpen(false);
                  navigate("/notifications");
                }}
                type="button"
              >
                {t("notif.viewAll")}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
