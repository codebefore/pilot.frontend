import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { DashboardNotesPanel } from "../components/dashboard/DashboardNotesPanel";
import { AlertIcon, CandidatesIcon, ExamsIcon, GridIcon } from "../components/icons";
import { Panel } from "../components/ui/Panel";
import { PanelListSkeleton } from "../components/ui/Skeleton";
import { TaskItem } from "../components/ui/TaskItem";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { getCandidates, type GetCandidatesParams } from "../lib/candidates-api";
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

type DashboardSummaryCard = {
  key: string;
  label: string;
  value: string;
  meta: string;
  icon: ReactNode;
  tone: "brand" | "orange" | "blue" | "purple";
};

const DASHBOARD_CANDIDATE_SUMMARY_PAGE_SIZE = 1000;

type DashboardCandidateSummaryKey = "preRegistered" | "active" | "eSinav" | "driving";

const DASHBOARD_CANDIDATE_SUMMARY_CONFIG: {
  key: DashboardCandidateSummaryKey;
  labelKey:
    | "dashboard.candidateSummary.preRegistered"
    | "dashboard.candidateSummary.active"
    | "dashboard.candidateSummary.eSinav"
    | "dashboard.candidateSummary.driving";
  params: GetCandidatesParams;
}[] = [
  {
    key: "preRegistered",
    labelKey: "dashboard.candidateSummary.preRegistered",
    params: { status: "pre_registered" },
  },
  {
    key: "active",
    labelKey: "dashboard.candidateSummary.active",
    params: { status: "active" },
  },
  {
    key: "eSinav",
    labelKey: "dashboard.candidateSummary.eSinav",
    params: { eSinavTab: "havuz" },
  },
  {
    key: "driving",
    labelKey: "dashboard.candidateSummary.driving",
    params: { drivingExamTab: "havuz" },
  },
];

function formatCountSummary(
  items: { label: string; count: number }[],
  emptyLabel: string
): string {
  if (items.length === 0) return emptyLabel;
  return items.map((item) => `${item.count} ${item.label}`).join(" · ");
}

function buildLicenseClassSummary(
  response: PagedResponse<CandidateResponse> | undefined,
  licenseClassLabelByCode: Map<string, string>,
  emptyLabel: string
): string {
  const licenseCounts = new Map<string, number>();
  const licenseClassCounts = response?.licenseClassCounts ?? [];

  if (licenseClassCounts.length > 0) {
    for (const item of licenseClassCounts) {
      const licenseLabel =
        licenseClassLabelByCode.get(item.licenseClass) ?? item.licenseClass;
      licenseCounts.set(licenseLabel, (licenseCounts.get(licenseLabel) ?? 0) + item.count);
    }
  } else {
    for (const candidate of response?.items ?? []) {
      const licenseLabel =
        licenseClassLabelByCode.get(candidate.licenseClass) ?? candidate.licenseClass;
      licenseCounts.set(licenseLabel, (licenseCounts.get(licenseLabel) ?? 0) + 1);
    }
  }

  const items = Array.from(licenseCounts, ([label, count]) => ({ label, count }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "tr"));

  return formatCountSummary(items, emptyLabel);
}

function buildDashboardCandidateSummaryCards({
  responses,
  loading,
  licenseClassLabelByCode,
  t,
}: {
  responses: Partial<Record<DashboardCandidateSummaryKey, PagedResponse<CandidateResponse>>>;
  loading: boolean;
  licenseClassLabelByCode: Map<string, string>;
  t: ReturnType<typeof useT>;
}): DashboardSummaryCard[] {
  return DASHBOARD_CANDIDATE_SUMMARY_CONFIG.map((config) => {
    const response = responses[config.key];
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
        : buildLicenseClassSummary(
            response,
            licenseClassLabelByCode,
            t("dashboard.candidateSummary.empty")
          ),
      meta: loading
        ? t("dashboard.candidateSummary.loading")
        : t("dashboard.candidateSummary.recordCount", {
            count: response?.totalCount ?? response?.items.length ?? 0,
          }),
    };
  });
}

export function DashboardPage({ userName }: DashboardPageProps) {
  const t = useT();
  const { activeInstitution } = useAuth();
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
    queryKey: ["dashboard", "candidateSummary", "licenseClasses", activeInstitutionId],
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(
        DASHBOARD_CANDIDATE_SUMMARY_CONFIG.map(async (config) => {
          const response = await getCandidates(
            {
              page: 1,
              pageSize: DASHBOARD_CANDIDATE_SUMMARY_PAGE_SIZE,
              ...config.params,
            },
            signal
          );
          return [config.key, response] as const;
        })
      );
      return Object.fromEntries(entries) as Record<
        DashboardCandidateSummaryKey,
        PagedResponse<CandidateResponse>
      >;
    },
  });
  const candidateSummaryResponses: Partial<
    Record<DashboardCandidateSummaryKey, PagedResponse<CandidateResponse>>
  > = candidateSummaryQuery.data ?? {};
  const licenseClassLabelByCode = useMemo(() => {
    const responses: PagedResponse<CandidateResponse>[] = Object.values(
      candidateSummaryResponses
    );
    const mergedOptions = mergeLicenseClassOptionsWithValues(
      licenseClassOptions,
      responses.flatMap((response) => [
        ...response.items.map((candidate) => candidate.licenseClass),
        ...(response.licenseClassCounts ?? []).map((item) => item.licenseClass),
      ])
    );
    return new Map(mergedOptions.map((option) => [option.value, option.label]));
  }, [candidateSummaryResponses, licenseClassOptions]);
  const candidateSummaryCards = useMemo(
    () =>
      buildDashboardCandidateSummaryCards({
        responses: candidateSummaryResponses,
        loading: candidateSummaryQuery.isLoading,
        licenseClassLabelByCode,
        t,
      }),
    [
      candidateSummaryQuery.isLoading,
      candidateSummaryResponses,
      licenseClassLabelByCode,
      t,
    ]
  );

  const displayName = userName?.trim() || "Pilot";

  return (
    <>
      <div className="dash-header">
        <h1>{t("dashboard.greeting", { name: displayName })}</h1>
      </div>

      <div className="dash-stats" aria-label={t("dashboard.candidateSummary.aria")}>
        {candidateSummaryCards.map((card) => (
          <div className="stat-card" key={card.key}>
            <div className="stat-card-header">
              <span className="stat-card-label">{card.label}</span>
              <div className={`stat-card-icon tone-${card.tone}`}>
                {card.icon}
              </div>
            </div>
            <div className="stat-card-value">{card.value}</div>
            <div className="stat-card-sub">{card.meta}</div>
          </div>
        ))}
      </div>

      <div className="dash-content">
        <div className="dash-primary-grid">
          <Panel
            action={<button className="panel-action" type="button">{t("dashboard.viewAll")}</button>}
            icon={<span className="icon-orange"><AlertIcon /></span>}
            title={t("dashboard.panel.pendingTasks")}
          >
            {dashboardLoading ? (
              <PanelListSkeleton rows={3} />
            ) : dashboard.pendingTasks.length > 0 ? (
              dashboard.pendingTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  priority={task.priority}
                  source={task.source}
                  status={task.status}
                  time={task.time}
                  title={task.title}
                />
              ))
            ) : (
              <div className="panel-empty">{t("dashboard.emptyPendingTasks")}</div>
            )}
          </Panel>

          <DashboardNotesPanel />

          <Panel title={t("dashboard.panel.recentActivity")}>
            {dashboardLoading ? (
              <PanelListSkeleton rows={4} />
            ) : dashboard.recentActivity.length > 0 ? (
              dashboard.recentActivity.map((event) => (
                <div className="activity-item" key={event.id}>
                  <div className={`activity-avatar tone-${event.avatarTone}`}>
                    {event.avatar}
                  </div>
                  <div>
                    <div className="activity-text">
                      <strong>{event.actor}</strong> {event.description}
                    </div>
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
    </>
  );
}
