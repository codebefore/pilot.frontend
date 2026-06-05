import type { AriaAttributes, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { DashboardNotesPanel } from "../components/dashboard/DashboardNotesPanel";
import { NewCandidateModal } from "../components/modals/NewCandidateModal";
import { NewPaymentModal } from "../components/modals/NewPaymentModal";
import {
  AlertIcon,
  CandidatesIcon,
  DocumentsIcon,
  GroupsIcon,
  MebIcon,
  PaymentsIcon,
  PlusIcon,
} from "../components/icons";
import { Panel } from "../components/ui/Panel";
import { StatCard, type StatCardTone } from "../components/ui/StatCard";
import { StatusPill } from "../components/ui/StatusPill";
import { TableHeaderFilter, type TableHeaderFilterOption } from "../components/ui/TableHeaderFilter";
import { TaskItem } from "../components/ui/TaskItem";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import type { AuthInstitution } from "../lib/auth-storage";
import { useT, type TranslationKey } from "../lib/i18n";
import { canManageArea, canViewArea } from "../lib/permissions";
import { useSidebarStats } from "../lib/sidebar-stats";
import { getDashboardOverview } from "../lib/stats-api";
import type { DashboardMebJobResponse, DashboardOverviewResponse } from "../lib/types";

type StatCardConfig = {
  key: string;
  label: string;
  value: number;
  sub: string;
  tone: StatCardTone;
  icon: React.ReactNode;
};

type DashboardPageProps = {
  activeInstitution?: AuthInstitution | null;
  userName?: string | null;
};

type MebSyncSortKey = "jobType" | "target" | "status" | "time";
type MebSyncSortState = { field: MebSyncSortKey; direction: "asc" | "desc" };

export function DashboardPage({ activeInstitution, userName }: DashboardPageProps) {
  const navigate = useNavigate();
  const t = useT();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const { stats, loading: statsLoading } = useSidebarStats();
  const {
    data: dashboard = { pendingTasks: [], recentMebJobs: [], recentActivity: [] },
    isLoading: dashboardLoading,
  } = useQuery<DashboardOverviewResponse>({
    queryKey: ["dashboard", "overview"],
    queryFn: () => getDashboardOverview(),
  });
  const [mebSyncSort, setMebSyncSort] = useState<MebSyncSortState>({
    field: "time",
    direction: "desc",
  });
  const [mebSyncFilters, setMebSyncFilters] = useState<Record<MebSyncSortKey, string>>({
    jobType: "all",
    target: "all",
    status: "all",
    time: "all",
  });
  const [newCandidateOpen, setNewCandidateOpen] = useState(false);
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const canManageCandidates = canManageArea(user, permissions, "candidates");
  const canManagePayments = canManageArea(user, permissions, "payments");
  const canViewMebJobs = canViewArea(user, permissions, "mebjobs");
  const noPermissionTitle = t("common.noPermission");

  const mebAttention = stats.mebJobs.failed + stats.mebJobs.manualReview;
  const displayName = userName?.trim() || "Pilot";
  const institutionName = activeInstitution?.name ?? t("dashboard.noInstitutionSetting");
  const periodLabel = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const statCards: StatCardConfig[] = [
    {
      key: "candidates",
      label: t("stats.activeCandidates"),
      value: stats.candidates.active,
      sub: t("stats.candidatesSub", { count: stats.candidates.total }),
      tone: "brand",
      icon: <CandidatesIcon />,
    },
    {
      key: "documents",
      label: t("stats.missingDocuments"),
      value: stats.documents.missingCount,
      sub: t("stats.documentsSub"),
      tone: "orange",
      icon: <DocumentsIcon />,
    },
    {
      key: "groups",
      label: t("stats.totalGroups"),
      value: stats.groups.total,
      sub: t("stats.groupsSub"),
      tone: "blue",
      icon: <GroupsIcon />,
    },
    {
      key: "mebJobs",
      label: t("stats.mebJobs"),
      value: mebAttention,
      sub: t("stats.mebJobsSub", {
        failed: stats.mebJobs.failed,
        manual: stats.mebJobs.manualReview,
      }),
      tone: "purple",
      icon: <MebIcon />,
    },
  ];
  const mebSyncFilterOptions = useMemo(
    () => ({
      jobType: buildDashboardFilterOptions(dashboard.recentMebJobs.map((job) => job.jobType), t),
      target: buildDashboardFilterOptions(dashboard.recentMebJobs.map((job) => job.target), t),
      status: buildDashboardFilterOptions(
        dashboard.recentMebJobs.map((job) => job.status),
        t,
        (s) => formatMebSyncStatusLabel(s, t)
      ),
      time: buildDashboardFilterOptions(dashboard.recentMebJobs.map((job) => job.time), t),
    }),
    [dashboard.recentMebJobs, t]
  );
  const visibleMebSyncJobs = useMemo(
    () => sortDashboardMebJobs(filterDashboardMebJobs(dashboard.recentMebJobs, mebSyncFilters), mebSyncSort, t),
    [dashboard.recentMebJobs, mebSyncFilters, mebSyncSort, t]
  );

  const setMebSyncFilter = (field: MebSyncSortKey, value: string) => {
    setMebSyncFilters((current) => ({ ...current, [field]: value }));
  };

  const toggleMebSyncSort = (field: MebSyncSortKey) => {
    setMebSyncSort((current) => {
      if (current.field === field) {
        return { field, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { field, direction: field === "time" ? "desc" : "asc" };
    });
  };

  return (
    <>
      <div className="dash-header">
        <h1>{t("dashboard.greeting", { name: displayName })}</h1>
        <p>{t("dashboard.summary", { institution: institutionName, period: periodLabel })}</p>
      </div>

      <div className="dash-stats">
        {statCards.map((card) => (
          <StatCard
            icon={card.icon}
            key={card.key}
            label={card.label}
            sub={card.sub}
            tone={card.tone}
            value={statsLoading ? "—" : card.value}
          />
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
              <div className="panel-empty">{t("common.loading")}</div>
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
              <div className="panel-empty">{t("common.loading")}</div>
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

        <div className="dash-secondary-grid">
          <Panel
            action={
              <button className="panel-action" onClick={() => navigate("/meb-jobs")} type="button">
                Tüm işler
              </button>
            }
            icon={<span className="icon-brand"><MebIcon /></span>}
            title={t("dashboard.panel.mebSync")}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <DashboardMebSyncTh
                    field="jobType"
                    filterControl={
                      <TableHeaderFilter
                        active={mebSyncFilters.jobType !== "all"}
                        onChange={(value) => setMebSyncFilter("jobType", value)}
                        options={mebSyncFilterOptions.jobType}
                        title={t("dashboard.col.jobType")}
                        value={mebSyncFilters.jobType}
                      />
                    }
                    label={t("dashboard.col.jobType")}
                    onToggle={toggleMebSyncSort}
                    sort={mebSyncSort}
                  />
                  <DashboardMebSyncTh
                    field="target"
                    filterControl={
                      <TableHeaderFilter
                        active={mebSyncFilters.target !== "all"}
                        onChange={(value) => setMebSyncFilter("target", value)}
                        options={mebSyncFilterOptions.target}
                        title={t("dashboard.col.candidateGroup")}
                        value={mebSyncFilters.target}
                      />
                    }
                    label={t("dashboard.col.candidateGroup")}
                    onToggle={toggleMebSyncSort}
                    sort={mebSyncSort}
                  />
                  <DashboardMebSyncTh
                    field="status"
                    filterControl={
                      <TableHeaderFilter
                        active={mebSyncFilters.status !== "all"}
                        onChange={(value) => setMebSyncFilter("status", value)}
                        options={mebSyncFilterOptions.status}
                        title={t("dashboard.col.status")}
                        value={mebSyncFilters.status}
                      />
                    }
                    label={t("dashboard.col.status")}
                    onToggle={toggleMebSyncSort}
                    sort={mebSyncSort}
                  />
                  <DashboardMebSyncTh
                    field="time"
                    filterControl={
                      <TableHeaderFilter
                        active={mebSyncFilters.time !== "all"}
                        onChange={(value) => setMebSyncFilter("time", value)}
                        options={mebSyncFilterOptions.time}
                        title={t("dashboard.col.time")}
                        value={mebSyncFilters.time}
                      />
                    }
                    label={t("dashboard.col.time")}
                    onToggle={toggleMebSyncSort}
                    sort={mebSyncSort}
                  />
                </tr>
              </thead>
              <tbody>
                {visibleMebSyncJobs.map((job) => (
                  <tr key={job.id}>
                    <td><span className="job-type">{job.jobType}</span></td>
                    <td><span className="job-candidate">{job.target}</span></td>
                    <td><StatusPill status={job.status} /></td>
                    <td><span className="job-time">{job.time}</span></td>
                  </tr>
                ))}
                {!dashboardLoading && visibleMebSyncJobs.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      {dashboard.recentMebJobs.length === 0 ? t("dashboard.emptyJobs") : t("dashboard.emptyJobsFiltered")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Panel>

          <Panel title={t("dashboard.panel.quickActions")}>
            <div className="quick-actions">
              <button
                className="btn btn-primary btn-block"
                disabled={!canManageCandidates}
                onClick={() => {
                  if (!canManageCandidates) return;
                  setNewCandidateOpen(true);
                }}
                title={!canManageCandidates ? noPermissionTitle : undefined}
                type="button"
              >
                <PlusIcon size={14} />
                Yeni Aday Kaydı
              </button>
              <button
                className="btn btn-secondary btn-block"
                disabled={!canManagePayments}
                onClick={() => {
                  if (!canManagePayments) return;
                  setNewPaymentOpen(true);
                }}
                title={!canManagePayments ? noPermissionTitle : undefined}
                type="button"
              >
                <PaymentsIcon />
                Tahsilat Girişi
              </button>
              <button
                className="btn btn-secondary btn-block"
                disabled={!canViewMebJobs}
                onClick={() => {
                  if (!canViewMebJobs) return;
                  navigate("/meb-jobs");
                }}
                title={!canViewMebJobs ? noPermissionTitle : undefined}
                type="button"
              >
                <MebIcon />
                MEB İşi Başlat
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <NewCandidateModal
        canManage={canManageCandidates}
        onClose={() => setNewCandidateOpen(false)}
        onSubmit={() => {
          setNewCandidateOpen(false);
          showToast(t("dashboard.toast.candidateCreated"));
        }}
        open={newCandidateOpen}
      />

      <NewPaymentModal
        canManage={canManagePayments}
        onClose={() => setNewPaymentOpen(false)}
        onSubmit={() => {
          setNewPaymentOpen(false);
          showToast(t("dashboard.toast.paymentCreated"));
        }}
        open={newPaymentOpen}
      />
    </>
  );
}

function buildDashboardFilterOptions(
  values: string[],
  t: (key: TranslationKey) => string,
  formatLabel: (value: string) => string = (value) => value
): TableHeaderFilterOption[] {
  const distinct = Array.from(new Set(values))
    .filter((value) => value && value.trim().length > 0)
    .sort((a, b) => formatLabel(a).localeCompare(formatLabel(b), "tr", { sensitivity: "base" }));
  return [
    { value: "all", label: t("common.field.all") },
    ...distinct.map((value) => ({ value, label: formatLabel(value) })),
  ];
}

function filterDashboardMebJobs(
  jobs: DashboardMebJobResponse[],
  filters: Record<MebSyncSortKey, string>
): DashboardMebJobResponse[] {
  return jobs.filter((job) => {
    if (filters.jobType !== "all" && job.jobType !== filters.jobType) return false;
    if (filters.target !== "all" && job.target !== filters.target) return false;
    if (filters.status !== "all" && job.status !== filters.status) return false;
    if (filters.time !== "all" && job.time !== filters.time) return false;
    return true;
  });
}

function sortDashboardMebJobs(
  jobs: DashboardMebJobResponse[],
  sort: MebSyncSortState,
  t: (key: TranslationKey) => string
): DashboardMebJobResponse[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  const valueOf = (job: DashboardMebJobResponse) => {
    switch (sort.field) {
      case "jobType":
        return job.jobType;
      case "target":
        return job.target;
      case "status":
        return formatMebSyncStatusLabel(job.status, t);
      case "time":
        return job.time;
    }
  };

  return [...jobs].sort((a, b) =>
    valueOf(a).localeCompare(valueOf(b), "tr", { sensitivity: "base", numeric: true }) * factor
  );
}

function formatMebSyncStatusLabel(
  status: string,
  t: (key: TranslationKey) => string
): string {
  switch (status) {
    case "success":
      return t("jobStatus.success");
    case "running":
      return t("jobStatus.running");
    case "queued":
      return t("jobStatus.queued");
    case "failed":
      return t("jobStatus.failed");
    case "manual":
      return t("jobStatus.manual");
    case "warning":
      return t("jobStatus.warning");
    default:
      return status;
  }
}

type DashboardMebSyncThProps = {
  field: MebSyncSortKey;
  filterControl: ReactNode;
  label: string;
  onToggle: (field: MebSyncSortKey) => void;
  sort: MebSyncSortState;
};

function DashboardMebSyncTh({
  field,
  filterControl,
  label,
  onToggle,
  sort,
}: DashboardMebSyncThProps) {
  const isActive = sort.field === field;
  const direction = isActive ? sort.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort: AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort} className={isActive ? "sortable-th active" : "sortable-th"}>
      <div className="sortable-th-shell">
        <button className="sortable-th-btn" onClick={() => onToggle(field)} type="button">
          <span>{label}</span>
          <span aria-hidden="true" className="sortable-th-indicator">
            {indicator}
          </span>
        </button>
        <div className="sortable-th-filter">{filterControl}</div>
      </div>
    </th>
  );
}
