import { useMemo, useState } from "react";

import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { useT } from "../lib/i18n";
import { mockNotifications, type MockNotification } from "../mock/notifications";

type NotifTab = "all" | "unread" | "read";

export function NotificationsPage() {
  const t = useT();
  const [tab, setTab] = useState<NotifTab>("all");
  const [items, setItems] = useState<MockNotification[]>(mockNotifications);

  const tabs = [
    { key: "all" as const,    label: t("notifPage.tab.all") },
    { key: "unread" as const, label: t("notifPage.tab.unread") },
    { key: "read" as const,   label: t("notifPage.tab.read") },
  ];

  const filtered = useMemo(() => {
    if (tab === "unread") return items.filter((n) => n.unread);
    if (tab === "read")   return items.filter((n) => !n.unread);
    return items;
  }, [items, tab]);

  const unreadCount = items.filter((n) => n.unread).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const toggleRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n)));
  };

  const emptyKey: "notifPage.empty.all" | "notifPage.empty.unread" | "notifPage.empty.read" =
    tab === "unread"
      ? "notifPage.empty.unread"
      : tab === "read"
      ? "notifPage.empty.read"
      : "notifPage.empty.all";

  return (
    <>
      <PageToolbar
        actions={
          unreadCount > 0 ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={markAllRead}
              type="button"
            >
              {t("notifPage.markAllRead")}
            </button>
          ) : null
        }
        title={t("notifPage.title")}
      />

      <PageTabs active={tab} onChange={setTab} tabs={tabs} />

      <div className="notif-page">
        {filtered.length === 0 ? (
          <div className="data-table-empty" style={{ padding: "48px 0", textAlign: "center" }}>
            {t(emptyKey)}
          </div>
        ) : (
          <ul className="notif-page-list">
            {filtered.map((n) => (
              <li
                className={n.unread ? "notif-page-item unread" : "notif-page-item"}
                key={n.id}
                onClick={() => toggleRead(n.id)}
              >
                <span className={`notif-dot-tone tone-${n.tone}`} />
                <div className="notif-body">
                  <div className="notif-title">{t(n.titleKey)}</div>
                  <div className="notif-text">{t(n.bodyKey)}</div>
                </div>
                <div className="notif-page-meta">
                  <span className="notif-time">{t(n.timeKey)}</span>
                  {n.unread && <span className="notif-unread-dot" />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
