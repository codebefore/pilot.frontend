import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { PageToolbar } from "../components/layout/PageToolbar";
import { ActivityAvatar } from "../components/ui/ActivityAvatar";
import { Pagination } from "../components/ui/Pagination";
import { NotificationListSkeleton } from "../components/ui/Skeleton";
import { currentLocale, useT } from "../lib/i18n";
import { getDashboardActivity } from "../lib/stats-api";
import type { DashboardActivityResponse } from "../lib/types";

const ACTIVITY_PAGE_SIZE = 100;

export function ActivityPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePositiveInteger(searchParams.get("page"));

  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity", { page, pageSize: ACTIVITY_PAGE_SIZE }],
    queryFn: ({ signal }) => getDashboardActivity({ page, pageSize: ACTIVITY_PAGE_SIZE }, signal),
  });

  const items = activityQuery.data?.items ?? [];
  const totalPages = activityQuery.data?.totalPages ?? 0;
  const activityGroups = useMemo(() => groupActivitiesByDay(items), [items]);

  const changePage = (nextPage: number) => {
    setSearchParams(nextPage <= 1 ? {} : { page: String(nextPage) });
  };

  const openActivityLink = (activity: DashboardActivityResponse) => {
    if (!activity.linkPath) return;
    navigate(activity.linkPath, activity.linkPath.startsWith("/candidates/")
      ? {
          state: {
            returnLabel: t("activity.returnLabel"),
            returnTo: `${location.pathname}${location.search}`,
          },
        }
      : undefined);
  };

  return (
    <>
      <PageToolbar title={t("activity.title")} />

      <div className="activity-page">
        <div className="page-content-leading">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/")} type="button">
            {t("common.backToDashboard")}
          </button>
        </div>
        {activityQuery.isLoading ? (
          <NotificationListSkeleton rows={8} />
        ) : items.length === 0 ? (
          <div className="data-table-empty" style={{ padding: "48px 0", textAlign: "center" }}>
            {t("activity.empty")}
          </div>
        ) : (
          <div className="activity-day-groups">
            {activityGroups.map((group) => (
              <section className="activity-day-group" key={group.key}>
                <div className="activity-day-heading">
                  <strong>{group.label}</strong>
                  <span>{group.activities.length}</span>
                </div>
                <ul className="activity-page-list">
                  {group.activities.map((activity) => (
                    <li
                      className={`activity-page-item${activity.linkPath ? " is-clickable" : ""}`}
                      key={activity.id}
                      onClick={() => openActivityLink(activity)}
                      role={activity.linkPath ? "button" : undefined}
                      style={activity.linkPath ? { cursor: "pointer" } : undefined}
                      tabIndex={activity.linkPath ? 0 : undefined}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                          keyboardEvent.preventDefault();
                          openActivityLink(activity);
                        }
                      }}
                    >
                      <ActivityAvatar activity={activity} />
                      <div className="activity-page-body">
                        <div className="activity-text">
                          <strong>{activity.actor}</strong> {activity.description}
                        </div>
                        {activity.actorDisplayName ? (
                          <div className="activity-person">{activity.actorDisplayName}</div>
                        ) : null}
                        <div className="activity-time">{formatActivityTime(activity.createdAtUtc)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <Pagination
        disabled={activityQuery.isFetching}
        onChange={changePage}
        page={page}
        totalPages={Math.max(totalPages, 1)}
      />
    </>
  );
}

type ActivityDayGroup = {
  key: string;
  label: string;
  activities: DashboardActivityResponse[];
};

function groupActivitiesByDay(items: DashboardActivityResponse[]): ActivityDayGroup[] {
  const groups = new Map<string, ActivityDayGroup>();

  for (const activity of items) {
    const date = new Date(activity.createdAtUtc);
    const key = Number.isNaN(date.getTime()) ? activity.createdAtUtc : toLocalDateKey(date);
    const label = Number.isNaN(date.getTime()) ? activity.createdAtUtc : formatActivityDayLabel(key);
    const group = groups.get(key) ?? { key, label, activities: [] };
    group.activities.push(activity);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function formatActivityDayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

function formatActivityTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString(currentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parsePositiveInteger(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
