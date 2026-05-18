import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useT } from "../../lib/i18n";
import {
  getNotifications,
  type NotificationResponse,
} from "../../lib/notifications-api";
import { BellIcon } from "../icons";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function NotificationsMenu() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const load = () => {
      getNotifications(controller.signal)
        .then((response) => {
          if (!cancelled) setItems(response.items);
        })
        .catch(() => {
          /* keep last known list silently — bell isn't critical */
        });
    };
    load();
    const id = window.setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, []);

  const unreadCount = items.length;
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
