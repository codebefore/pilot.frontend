import { useEffect, useMemo, useState, type FormEvent } from "react";
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
const ACTIVITY_CATEGORIES = ["finance", "groups", "documents", "notes"] as const;
type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number] | "";

export function ActivityPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePositiveInteger(searchParams.get("page"));
  const search = searchParams.get("search")?.trim() ?? "";
  const category = parseActivityCategory(searchParams.get("category"));
  const dateFrom = parseDateInput(searchParams.get("dateFrom"));
  const dateTo = parseDateInput(searchParams.get("dateTo"));
  const [searchDraft, setSearchDraft] = useState(search);
  const [categoryDraft, setCategoryDraft] = useState<ActivityCategory>(category);
  const [dateFromDraft, setDateFromDraft] = useState(dateFrom);
  const [dateToDraft, setDateToDraft] = useState(dateTo);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setCategoryDraft(category), [category]);
  useEffect(() => setDateFromDraft(dateFrom), [dateFrom]);
  useEffect(() => setDateToDraft(dateTo), [dateTo]);

  const activityRequest = useMemo(
    () => ({
      page,
      pageSize: ACTIVITY_PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
      ...(dateFrom ? { fromUtc: toUtcBoundary(dateFrom, false) } : {}),
      ...(dateTo ? { toUtc: toUtcBoundary(dateTo, true) } : {}),
    }),
    [category, dateFrom, dateTo, page, search]
  );

  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity", activityRequest],
    queryFn: ({ signal }) => getDashboardActivity(activityRequest, signal),
  });

  const items = activityQuery.data?.items ?? [];
  const totalPages = activityQuery.data?.totalPages ?? 0;
  const activityGroups = useMemo(() => groupActivitiesByDay(items), [items]);

  const changePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setSearchParams(next);
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams();
    setOptionalParam(next, "search", searchDraft.trim());
    setOptionalParam(next, "category", categoryDraft);
    setOptionalParam(next, "dateFrom", dateFromDraft);
    setOptionalParam(next, "dateTo", dateToDraft);
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setCategoryDraft("");
    setDateFromDraft("");
    setDateToDraft("");
    setSearchParams({});
  };

  const hasFilters = Boolean(search || category || dateFrom || dateTo);

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
        <form className="activity-filter-bar" onSubmit={applyFilters}>
          <input
            aria-label={t("activity.filter.search")}
            className="activity-filter-search"
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={t("activity.filter.searchPlaceholder")}
            maxLength={200}
            type="search"
            value={searchDraft}
          />
          <select
            aria-label={t("activity.filter.category")}
            className="activity-filter-select"
            onChange={(event) => setCategoryDraft(event.target.value as ActivityCategory)}
            value={categoryDraft}
          >
            <option value="">{t("activity.filter.allCategories")}</option>
            <option value="finance">{t("activity.filter.finance")}</option>
            <option value="groups">{t("activity.filter.groups")}</option>
            <option value="documents">{t("activity.filter.documents")}</option>
            <option value="notes">{t("activity.filter.notes")}</option>
          </select>
          <label className="activity-filter-date">
            <span>{t("activity.filter.from")}</span>
            <input
              max={dateToDraft || undefined}
              onChange={(event) => setDateFromDraft(event.target.value)}
              type="date"
              value={dateFromDraft}
            />
          </label>
          <label className="activity-filter-date">
            <span>{t("activity.filter.to")}</span>
            <input
              min={dateFromDraft || undefined}
              onChange={(event) => setDateToDraft(event.target.value)}
              type="date"
              value={dateToDraft}
            />
          </label>
          <button className="btn btn-primary btn-sm" type="submit">
            {t("activity.filter.apply")}
          </button>
          {hasFilters ? (
            <button className="btn btn-secondary btn-sm" onClick={clearFilters} type="button">
              {t("common.clear")}
            </button>
          ) : null}
        </form>
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

function parseActivityCategory(value: string | null): ActivityCategory {
  return ACTIVITY_CATEGORIES.includes(value as (typeof ACTIVITY_CATEGORIES)[number])
    ? (value as ActivityCategory)
    : "";
}

function parseDateInput(value: string | null): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return "";

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : "";
}

function toUtcBoundary(value: string, endExclusive: boolean): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + (endExclusive ? 1 : 0));
  return date.toISOString();
}

function setOptionalParam(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
}
