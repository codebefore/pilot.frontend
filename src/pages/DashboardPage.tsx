import type { AriaAttributes, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { useT } from "../lib/i18n";
import { useSidebarStats } from "../lib/sidebar-stats";
import { getDashboardOverview } from "../lib/stats-api";
import type { DashboardMebJobResponse, DashboardOverviewResponse, Institution } from "../lib/types";

type StatCardConfig = {
  key: string;
  label: string;
  value: number;
  sub: string;
  tone: StatCardTone;
  icon: React.ReactNode;
};

type DashboardPageProps = {
  activeInstitution?: Institution | null;
  userName?: string | null;
};

type MebSyncSortKey = "jobType" | "target" | "status" | "time";
type MebSyncSortState = { field: MebSyncSortKey; direction: "asc" | "desc" };

export function DashboardPage({ activeInstitution, userName }: DashboardPageProps) {
  const navigate = useNavigate();
  const t = useT();
  const { showToast } = useToast();
  const { stats, loading: statsLoading } = useSidebarStats();
  const [dashboard, setDashboard] = useState<DashboardOverviewResponse>({
    pendingTasks: [],
    recentMebJobs: [],
    recentActivity: [],
  });
  const [dashboardLoading, setDashboardLoading] = useState(true);
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

  const mebAttention = stats.mebJobs.failed + stats.mebJobs.manualReview;
  const displayName = userName?.trim() || "Pilot";
  const institutionName = activeInstitution?.name ?? "Kurum ayarı yok";
  const periodLabel = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setDashboardLoading(true);
    getDashboardOverview(controller.signal)
      .then((payload) => {
        if (mounted) setDashboard(payload);
      })
      .catch((error: unknown) => {
        if (mounted && (error as { name?: string }).name !== "AbortError") {
          setDashboard({
            pendingTasks: [],
            recentMebJobs: [],
            recentActivity: [],
          });
        }
      })
      .finally(() => {
        if (mounted) setDashboardLoading(false);
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

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
      jobType: buildDashboardFilterOptions(dashboard.recentMebJobs.map((job) => job.jobType)),
      target: buildDashboardFilterOptions(dashboard.recentMebJobs.map((job) => job.target)),
      status: buildDashboardFilterOptions(
        dashboard.recentMebJobs.map((job) => job.status),
        formatMebSyncStatusLabel
      ),
      time: buildDashboardFilterOptions(dashboard.recentMebJobs.map((job) => job.time)),
    }),
    [dashboard.recentMebJobs]
  );
  const visibleMebSyncJobs = useMemo(
    () => sortDashboardMebJobs(filterDashboardMebJobs(dashboard.recentMebJobs, mebSyncFilters), mebSyncSort),
    [dashboard.recentMebJobs, mebSyncFilters, mebSyncSort]
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
        <h1>
          Hoş geldin, <span>{displayName}</span>
        </h1>
        <p>{institutionName} — {periodLabel} operasyon özeti</p>
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
            action={<button className="panel-action" type="button">Tümünü gör</button>}
            icon={<span className="icon-orange"><AlertIcon /></span>}
            title="Bekleyen Görevler"
          >
            {dashboardLoading ? (
              <div className="panel-empty">Yükleniyor...</div>
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
              <div className="panel-empty">Bekleyen görev yok</div>
            )}
          </Panel>

          <DashboardNotesPanel />

          <Panel title="Son Hareketler">
            {dashboardLoading ? (
              <div className="panel-empty">Yükleniyor...</div>
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
              <div className="panel-empty">Son hareket yok</div>
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
            title="Meb Sync"
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
                        title="İş Tipi"
                        value={mebSyncFilters.jobType}
                      />
                    }
                    label="İş Tipi"
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
                        title="Aday / Grup"
                        value={mebSyncFilters.target}
                      />
                    }
                    label="Aday / Grup"
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
                        title="Durum"
                        value={mebSyncFilters.status}
                      />
                    }
                    label="Durum"
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
                        title="Zaman"
                        value={mebSyncFilters.time}
                      />
                    }
                    label="Zaman"
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
                      {dashboard.recentMebJobs.length === 0 ? "MEB işi yok" : "Bu filtreye uyan iş yok"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Panel>

          <Panel title="Hızlı İşlemler">
            <div className="quick-actions">
              <button
                className="btn btn-primary btn-block"
                onClick={() => setNewCandidateOpen(true)}
                type="button"
              >
                <PlusIcon size={14} />
                Yeni Aday Kaydı
              </button>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => setNewPaymentOpen(true)}
                type="button"
              >
                <PaymentsIcon />
                Tahsilat Girişi
              </button>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => navigate("/meb-jobs")}
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
        onClose={() => setNewCandidateOpen(false)}
        onSubmit={() => {
          setNewCandidateOpen(false);
          showToast("Aday başarıyla kaydedildi");
        }}
        open={newCandidateOpen}
      />

      <NewPaymentModal
        onClose={() => setNewPaymentOpen(false)}
        onSubmit={() => {
          setNewPaymentOpen(false);
          showToast("Tahsilat kaydedildi, makbuz oluşturuldu");
        }}
        open={newPaymentOpen}
      />
    </>
  );
}

function buildDashboardFilterOptions(
  values: string[],
  formatLabel: (value: string) => string = (value) => value
): TableHeaderFilterOption[] {
  const distinct = Array.from(new Set(values))
    .filter((value) => value && value.trim().length > 0)
    .sort((a, b) => formatLabel(a).localeCompare(formatLabel(b), "tr", { sensitivity: "base" }));
  return [
    { value: "all", label: "Tümü" },
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
  sort: MebSyncSortState
): DashboardMebJobResponse[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  const valueOf = (job: DashboardMebJobResponse) => {
    switch (sort.field) {
      case "jobType":
        return job.jobType;
      case "target":
        return job.target;
      case "status":
        return formatMebSyncStatusLabel(job.status);
      case "time":
        return job.time;
    }
  };

  return [...jobs].sort((a, b) =>
    valueOf(a).localeCompare(valueOf(b), "tr", { sensitivity: "base", numeric: true }) * factor
  );
}

function formatMebSyncStatusLabel(status: string): string {
  switch (status) {
    case "success":
      return "Başarılı";
    case "running":
      return "Çalışıyor";
    case "queued":
      return "Bekliyor";
    case "failed":
      return "Hata";
    case "manual":
      return "Manuel";
    case "warning":
      return "Uyarı";
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
