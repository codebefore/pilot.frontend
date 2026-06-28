import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { DashboardNotesPanel } from "../components/dashboard/DashboardNotesPanel";
import { CandidatesIcon, ExamsIcon, GridIcon } from "../components/icons";
import { ActivityAvatar } from "../components/ui/ActivityAvatar";
import { Panel } from "../components/ui/Panel";
import { PanelListSkeleton } from "../components/ui/Skeleton";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { getCandidates, type CandidateExamTabValue } from "../lib/candidates-api";
import { getDashboardOverview } from "../lib/stats-api";
import {
  mergeLicenseClassOptionsWithValues,
  useLicenseClassOptions,
} from "../lib/use-license-class-options";
import type {
  CandidateResponse,
  DashboardOverviewResponse,
  PagedResponse,
} from "../lib/types";

type DashboardPageProps = {
  userName?: string | null;
};

const DASHBOARD_ACTIVE_MEB_JOB_REFRESH_MS = 5000;
const DASHBOARD_CLOCK_REFRESH_MS = 1_000;

type DashboardSummaryCard = {
  key: string;
  label: string;
  value: ReactNode;
  valueVariant?: "single" | "stats";
  countLabel: string;
  icon: ReactNode;
  tone: "brand" | "orange" | "blue" | "purple";
};

const DASHBOARD_CANDIDATE_SUMMARY_PAGE_SIZE = 100;

type DashboardCandidateSummaryKey = "preRegistered" | "active" | "eSinav" | "driving";
type DashboardExamSummaryKey = "eSinav" | "driving";
type DashboardExamTabCounts = Record<CandidateExamTabValue, number>;
type DashboardCandidateSummaryData = {
  preRegistered?: PagedResponse<CandidateResponse>;
  active?: PagedResponse<CandidateResponse>;
  eSinav?: DashboardExamTabCounts;
  driving?: DashboardExamTabCounts;
};

const DASHBOARD_CANDIDATE_SUMMARY_CONFIG: {
  key: DashboardCandidateSummaryKey;
  labelKey:
    | "dashboard.candidateSummary.preRegistered"
    | "dashboard.candidateSummary.active"
    | "dashboard.candidateSummary.eSinav"
    | "dashboard.candidateSummary.driving";
}[] = [
  {
    key: "preRegistered",
    labelKey: "dashboard.candidateSummary.preRegistered",
  },
  {
    key: "active",
    labelKey: "dashboard.candidateSummary.active",
  },
  {
    key: "eSinav",
    labelKey: "dashboard.candidateSummary.eSinav",
  },
  {
    key: "driving",
    labelKey: "dashboard.candidateSummary.driving",
  },
];

const DASHBOARD_EXAM_TABS: CandidateExamTabValue[] = ["havuz", "basarisiz", "randevulu"];

function buildLicenseClassSummary(
  response: PagedResponse<CandidateResponse> | undefined,
  licenseClassLabelByCode: Map<string, string>,
  emptyLabel: string
): ReactNode {
  const licenseCounts = new Map<string, number>();

  for (const candidate of response?.items ?? []) {
    const licenseLabel =
      licenseClassLabelByCode.get(candidate.licenseClass) ?? candidate.licenseClass;
    const displayLabel = formatDashboardLicenseClassLabel(licenseLabel);
    licenseCounts.set(displayLabel, (licenseCounts.get(displayLabel) ?? 0) + 1);
  }

  const items = Array.from(licenseCounts, ([label, count]) => ({ label, count }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "tr"));

  if (items.length === 0) return emptyLabel;
  return (
    <>
      {items.map((item) => (
        <span className="stat-card-value-stat" key={item.label}>
          <strong>{item.count}</strong>
          <span>{item.label}</span>
        </span>
      ))}
    </>
  );
}

function formatDashboardLicenseClassLabel(label: string): string {
  const parts = label
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return label;
  return [parts[0], ...parts.slice(1).map((part) => part.charAt(0))]
    .filter(Boolean)
    .join("-");
}

function buildExamStatusSummary(counts: DashboardExamTabCounts | undefined): ReactNode {
  if (!counts) return "—";
  return (
    <>
      <span className="stat-card-value-stat">
        <strong>{counts.havuz ?? 0}</strong>
        <span>Havuz</span>
      </span>
      <span className="stat-card-value-stat">
        <strong>{counts.basarisiz ?? 0}</strong>
        <span>Başarısız</span>
      </span>
      <span className="stat-card-value-stat">
        <strong>{counts.randevulu ?? 0}</strong>
        <span>Randevulu</span>
      </span>
    </>
  );
}

function dashboardExamTotal(counts: DashboardExamTabCounts | undefined): number {
  if (!counts) return 0;
  return counts.havuz + counts.randevulu + counts.basarisiz;
}

function buildDashboardCandidateSummaryCards({
  data,
  loading,
  licenseClassLabelByCode,
  t,
}: {
  data: DashboardCandidateSummaryData;
  loading: boolean;
  licenseClassLabelByCode: Map<string, string>;
  t: ReturnType<typeof useT>;
}): DashboardSummaryCard[] {
  return DASHBOARD_CANDIDATE_SUMMARY_CONFIG.map((config) => {
    const response = config.key === "preRegistered" || config.key === "active"
      ? data[config.key]
      : undefined;
    const examCounts = config.key === "eSinav" || config.key === "driving"
      ? data[config.key]
      : undefined;
    const isExamSummary = config.key === "eSinav" || config.key === "driving";
    const count = isExamSummary
      ? dashboardExamTotal(examCounts)
      : response?.totalCount ?? response?.items.length ?? 0;
    return {
      key: config.key,
      label: t(config.labelKey),
      icon: config.key === "eSinav"
        ? <ExamsIcon />
        : config.key === "driving"
          ? <GridIcon />
          : <CandidatesIcon />,
      tone: config.key === "preRegistered"
        ? "orange"
        : config.key === "active"
          ? "brand"
          : config.key === "eSinav"
            ? "blue"
            : "purple",
      value: loading
        ? "..."
        : isExamSummary
          ? buildExamStatusSummary(examCounts)
          : buildLicenseClassSummary(
              response,
              licenseClassLabelByCode,
              t("dashboard.candidateSummary.empty")
            ),
      valueVariant: "stats",
      countLabel: loading ? "..." : String(count),
    };
  });
}

async function getDashboardExamTabCounts(
  key: DashboardExamSummaryKey,
  signal?: AbortSignal
): Promise<DashboardExamTabCounts> {
  const entries = await Promise.all(
    DASHBOARD_EXAM_TABS.map(async (tab) => {
      const response = await getCandidates(
        {
          page: 1,
          pageSize: 1,
          ...(key === "eSinav" ? { eSinavTab: tab } : { drivingExamTab: tab }),
        },
        signal
      );
      return [tab, response.totalCount ?? response.items.length] as const;
    })
  );
  return Object.fromEntries(entries) as DashboardExamTabCounts;
}

export function DashboardPage({ userName }: DashboardPageProps) {
  const t = useT();
  const { activeInstitution } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(() => new Date());
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const activeInstitutionId = activeInstitution?.id ?? "";
  const {
    data: dashboard = { pendingTasks: [], recentMebJobs: [], recentActivity: [] },
    isLoading: dashboardLoading,
  } = useQuery<DashboardOverviewResponse>({
    queryKey: ["dashboard", "overview", activeInstitutionId],
    queryFn: ({ signal }) => getDashboardOverview(signal),
    refetchInterval: (query) => {
      const hasActiveMebJob = query.state.data?.recentMebJobs.some((job) =>
        job.status === "running" || job.status === "queued"
      );
      return hasActiveMebJob ? DASHBOARD_ACTIVE_MEB_JOB_REFRESH_MS : false;
    },
  });
  const candidateSummaryQuery = useQuery({
    queryKey: ["dashboard", "candidateSummary", "statusCounts", activeInstitutionId],
    queryFn: async ({ signal }) => {
      const [preRegistered, active, eSinav, driving] = await Promise.all([
        getCandidates(
          {
            page: 1,
            pageSize: DASHBOARD_CANDIDATE_SUMMARY_PAGE_SIZE,
            status: "pre_registered",
          },
          signal
        ),
        getCandidates(
          {
            page: 1,
            pageSize: DASHBOARD_CANDIDATE_SUMMARY_PAGE_SIZE,
            status: "active",
          },
          signal
        ),
        getDashboardExamTabCounts("eSinav", signal),
        getDashboardExamTabCounts("driving", signal),
      ]);
      return { preRegistered, active, eSinav, driving } satisfies DashboardCandidateSummaryData;
    },
  });
  const candidateSummaryData: DashboardCandidateSummaryData = candidateSummaryQuery.data ?? {};
  const licenseClassLabelByCode = useMemo(() => {
    const responses = [candidateSummaryData.preRegistered, candidateSummaryData.active]
      .filter((response): response is PagedResponse<CandidateResponse> => response !== undefined);
    const mergedOptions = mergeLicenseClassOptionsWithValues(
      licenseClassOptions,
      responses.flatMap((response) => response.items.map((candidate) => candidate.licenseClass))
    );
    return new Map(mergedOptions.map((option) => [option.value, option.label]));
  }, [candidateSummaryData.active, candidateSummaryData.preRegistered, licenseClassOptions]);
  const candidateSummaryCards = useMemo(
    () =>
      buildDashboardCandidateSummaryCards({
        data: candidateSummaryData,
        loading: candidateSummaryQuery.isLoading,
        licenseClassLabelByCode,
        t,
      }),
    [
      candidateSummaryQuery.isLoading,
      candidateSummaryData,
      licenseClassLabelByCode,
      t,
    ]
  );
  const openActivityLink = (linkPath: string | null) => {
    if (!linkPath) return;
    navigate(linkPath, linkPath.startsWith("/candidates/")
      ? {
          state: {
            returnLabel: t("activity.returnLabel"),
            returnTo: `${location.pathname}${location.search}`,
          },
        }
      : undefined);
  };

  const displayName = userName?.trim() || "Pilot";
  const currentTimeMain = useMemo(
    () =>
      now.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [now]
  );
  const currentSecond = useMemo(
    () => now.getSeconds().toString().padStart(2, "0"),
    [now]
  );
  const currentTime = `${currentTimeMain}:${currentSecond}`;
  const currentDate = useMemo(
    () => {
      const weekday = now.toLocaleDateString("tr-TR", {
        weekday: "long",
      });
      const date = now.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      return `${weekday}, ${date}`;
    },
    [now]
  );

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), DASHBOARD_CLOCK_REFRESH_MS);
    return () => window.clearInterval(timerId);
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dash-header">
        <div className="dash-header-content">
          <div className="dash-header-greeting">
            <span>Hoş geldin,</span>
            <strong>{displayName}</strong>
          </div>
          <div className="dash-header-clock" aria-label={`${currentTime}, ${currentDate}`}>
            <strong>
              {currentTimeMain}
              <span className="dash-header-clock-second" key={currentSecond}>
                :{currentSecond}
              </span>
            </strong>
            <span>{currentDate}</span>
          </div>
        </div>
      </div>

      <div className="dash-stats" aria-label={t("dashboard.candidateSummary.aria")}>
        {candidateSummaryCards.map((card) => (
          <div className="stat-card" key={card.key}>
            <div className="stat-card-header">
              <span className="stat-card-label">
                <span>{card.label}</span>
                <span className="stat-card-count-badge">{card.countLabel}</span>
              </span>
              <div className={`stat-card-icon tone-${card.tone}`}>
                {card.icon}
              </div>
            </div>
            <div
              className={[
                "stat-card-value",
                card.valueVariant === "stats" ? "is-stat-list" : "",
              ].filter(Boolean).join(" ")}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="dash-content">
        <div className="dash-primary-grid">
          <DashboardNotesPanel />

          <Panel
            action={
              <button className="panel-action" onClick={() => navigate("/activity")} type="button">
                {t("dashboard.viewAll")}
              </button>
            }
            title={t("dashboard.panel.recentActivity")}
          >
            {dashboardLoading ? (
              <PanelListSkeleton rows={4} />
            ) : dashboard.recentActivity.length > 0 ? (
              dashboard.recentActivity.map((event) => (
                <div
                  className={`activity-item${event.linkPath ? " is-clickable" : ""}`}
                  key={event.id}
                  onClick={() => openActivityLink(event.linkPath)}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                      keyboardEvent.preventDefault();
                      openActivityLink(event.linkPath);
                    }
                  }}
                  role={event.linkPath ? "button" : undefined}
                  tabIndex={event.linkPath ? 0 : undefined}
                >
                  <ActivityAvatar activity={event} />
                  <div>
                    <div className="activity-text">
                      <strong>{event.actor}</strong> {event.description}
                    </div>
                    {event.actorDisplayName ? (
                      <div className="activity-person">{event.actorDisplayName}</div>
                    ) : null}
                    <div className="activity-time">{event.time}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="panel-empty">{t("dashboard.emptyRecentActivity")}</div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
