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
        {activityQuery.isLoading ? (
          <NotificationListSkeleton rows={8} />
        ) : items.length === 0 ? (
          <div className="data-table-empty" style={{ padding: "48px 0", textAlign: "center" }}>
            {t("activity.empty")}
          </div>
        ) : (
          <ul className="activity-page-list">
            {items.map((activity) => (
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
                  <div className="activity-time">{formatActivityDateTime(activity.createdAtUtc)}</div>
                </div>
              </li>
            ))}
          </ul>
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

function formatActivityDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(currentLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parsePositiveInteger(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
