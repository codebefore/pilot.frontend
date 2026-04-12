import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useT } from "../../lib/i18n";
import { mockNotifications, recentMockNotifications } from "../../mock/notifications";
import { BellIcon } from "../icons";

export function NotificationsMenu() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unreadCount = mockNotifications.filter((n) => n.unread).length;

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
            {unreadCount > 0 && (
              <button className="notif-menu-action" type="button">
                {t("notif.markAllRead")}
              </button>
            )}
          </div>

          {recentMockNotifications.length === 0 ? (
            <div className="notif-menu-empty">{t("notif.empty")}</div>
          ) : (
            <ul className="notif-list">
              {recentMockNotifications.map((n) => (
                <li className={n.unread ? "notif-item unread" : "notif-item"} key={n.id}>
                  <span className={`notif-dot-tone tone-${n.tone}`} />
                  <div className="notif-body">
                    <div className="notif-title">{t(n.titleKey)}</div>
                    <div className="notif-text">{t(n.bodyKey)}</div>
                    <div className="notif-time">{t(n.timeKey)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

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
        </div>
      )}
    </div>
  );
}
