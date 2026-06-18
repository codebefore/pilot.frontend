import type { AriaAttributes, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { JobDrawer } from "../components/drawers/JobDrawer";
import { PlusIcon, RefreshIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { NewMebJobModal } from "../components/modals/NewMebJobModal";
import { FilterChip } from "../components/ui/FilterChip";
import { JobsSummaryCard } from "../components/ui/JobsSummaryCard";
import { PageLoadError } from "../components/ui/PageLoadError";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { TableHeaderFilter, type TableHeaderFilterOption } from "../components/ui/TableHeaderFilter";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import {
  cancelMebbisJob,
  createCandidateLookupJob,
  getMebbisJobQueueStatus,
  listMebbisJobs,
  mapMebbisStatusToJobStatus,
  mebbisJobTypeLabel,
  pairMebbisExtensionClient,
  parseJobPayload,
  retryMebbisJob,
  retryMebbisJobs,
  retryMebbisJobQueuePublishes,
  type MebbisExtensionPairResponse,
  type MebbisJobResponse,
} from "../lib/mebbis-jobs-api";
import { buildJobsSummary, type MebJob } from "../lib/mebbis-jobs";
import { canManageArea } from "../lib/permissions";
import { candidateKeys } from "../lib/queries/use-candidates";
import { groupKeys } from "../lib/queries/use-groups";
import type { JobStatus } from "../types";
import { useT, currentLocale, type TranslationKey } from "../lib/i18n";
import { formatLocalDateOnly } from "../lib/date-only";

type StatusFilter = "all" | "running" | "queued" | "manual" | "failed" | "success";

type SortKey =
  | "jobType"
  | "candidate"
  | "step"
  | "status"
  | "queue"
  | "startedAt"
  | "duration";

type SortDir = "asc" | "desc";

type SortState = { field: SortKey; direction: SortDir };

const STATUS_ORDER: Record<JobStatus, number> = {
  running: 0,
  queued: 1,
  warning: 2,
  manual: 2,
  failed: 3,
  success: 4,
};

function sortJobs(jobs: MebJob[], sort: SortState): MebJob[] {
  const { field: key, direction: dir } = sort;
  const factor = dir === "asc" ? 1 : -1;
  const now = Date.now();
  const compareNumber = (a: number, b: number) => (a - b) * factor;
  const compareString = (a: string, b: string) =>
    a.localeCompare(b, "tr", { sensitivity: "base" }) * factor;

  const durationOf = (job: MebJob): number => {
    const start = new Date(job.startedAtIso).getTime();
    if (Number.isNaN(start)) return 0;
    const end = job.completedAtIso ? new Date(job.completedAtIso).getTime() : now;
    if (Number.isNaN(end)) return 0;
    return Math.max(0, end - start);
  };

  return [...jobs].sort((a, b) => {
    switch (key) {
      case "jobType":
        return compareString(a.jobType, b.jobType);
      case "candidate":
        return compareString(a.candidateName ?? a.targetSecondary, b.candidateName ?? b.targetSecondary);
      case "step":
        return compareString(a.step, b.step);
      case "status":
        return compareNumber(STATUS_ORDER[a.status], STATUS_ORDER[b.status]);
      case "queue":
        return compareNumber(queueStateOrder(a), queueStateOrder(b));
      case "startedAt":
        return compareNumber(
          new Date(a.startedAtIso).getTime() || 0,
          new Date(b.startedAtIso).getTime() || 0
        );
      case "duration":
        return compareNumber(durationOf(a), durationOf(b));
    }
  });
}

function queueStateOrder(job: MebJob): number {
  if (job.queuePublishError) return 0;
  if (job.queuePublishedAtIso) return 2;
  return 1;
}

const FILTERS: { key: StatusFilter; labelKey: TranslationKey }[] = [
  { key: "all",     labelKey: "common.all" },
  { key: "running", labelKey: "jobStatus.running" },
  { key: "queued",  labelKey: "jobStatus.queued" },
  { key: "manual",  labelKey: "jobStatus.manual" },
  { key: "failed",  labelKey: "jobStatus.failed" },
  { key: "success", labelKey: "jobStatus.success" },
];

const ACTIVE_STATUSES: JobStatus[] = ["running", "queued"];
const POLL_INTERVAL_MS = 5000;
const RECENT_DOMAIN_REFRESH_WINDOW_MS = 2 * 60 * 1000;

function isDomainApplyMebbisJob(jobType: string): boolean {
  return ["candidate_sync", "theory_schedule_sync", "theory_schedule_import"].includes(jobType);
}

function isRecentlyCompletedDomainJob(job: MebbisJobResponse): boolean {
  if (!isDomainApplyMebbisJob(job.jobType) || job.status !== "succeeded" || !job.completedAtUtc) {
    return false;
  }
  const completedAt = new Date(job.completedAtUtc).getTime();
  return Number.isFinite(completedAt) && Date.now() - completedAt <= RECENT_DOMAIN_REFRESH_WINDOW_MS;
}

function buildFilterOptions(
  values: string[],
  allLabel: string,
  formatLabel: (value: string) => string = (value) => value
): TableHeaderFilterOption[] {
  const distinct = Array.from(new Set(values))
    .filter((value) => value && value.trim().length > 0)
    .sort((a, b) => formatLabel(a).localeCompare(formatLabel(b), "tr", { sensitivity: "base" }));
  return [
    { value: "all", label: allLabel },
    ...distinct.map((value) => ({ value, label: formatLabel(value) })),
  ];
}

function getCandidateFilterValue(job: MebJob): string {
  return job.candidateName ?? job.targetSecondary;
}

function getStartedAtFilterValue(job: MebJob): string {
  const date = new Date(job.startedAtIso);
  if (Number.isNaN(date.getTime())) return "-";
  return formatLocalDateOnly(date);
}

function formatDateFilterLabel(value: string): string {
  if (value === "-") return value;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDurationFilterValue(job: MebJob): string {
  const start = new Date(job.startedAtIso).getTime();
  if (Number.isNaN(start)) return "-";
  const end = job.completedAtIso ? new Date(job.completedAtIso).getTime() : Date.now();
  if (Number.isNaN(end)) return "-";
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  if (minutes < 1) return "1 dakikadan az";
  if (minutes < 10) return "1-10 dakika";
  if (minutes < 60) return "10-60 dakika";
  return "1 saatten fazla";
}

function applyFilter(
  jobs: MebJob[],
  statusFilter: StatusFilter,
  jobTypeFilter: string,
  candidateFilter: string,
  stepFilter: string,
  startedAtFilter: string,
  durationFilter: string
): MebJob[] {
  return jobs.filter((j) => {
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (jobTypeFilter !== "all" && j.jobType !== jobTypeFilter) return false;
    if (candidateFilter !== "all" && getCandidateFilterValue(j) !== candidateFilter) return false;
    if (stepFilter !== "all" && j.step !== stepFilter) return false;
    if (startedAtFilter !== "all" && getStartedAtFilterValue(j) !== startedAtFilter) return false;
    if (durationFilter !== "all" && getDurationFilterValue(j) !== durationFilter) return false;
    return true;
  });
}

export function MebJobsPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const [candidateFilter, setCandidateFilter] = useState<string>("all");
  const [stepFilter, setStepFilter] = useState<string>("all");
  const [startedAtFilter, setStartedAtFilter] = useState<string>("all");
  const [durationFilter, setDurationFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortState>({ field: "startedAt", direction: "desc" });
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [queueRetrying, setQueueRetrying] = useState(false);
  const [manualRetrying, setManualRetrying] = useState(false);
  const [extensionDisplayName, setExtensionDisplayName] = useState("Office Chrome");
  const [extensionPairing, setExtensionPairing] = useState(false);
  const [extensionPairResult, setExtensionPairResult] = useState<MebbisExtensionPairResponse | null>(null);
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageMebJobs = canManageArea(user, permissions, "mebjobs");
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("selected");
  const queryClient = useQueryClient();

  const jobsQuery = useQuery<MebbisJobResponse[]>({
    queryKey: ["mebbisJobs", "list"],
    queryFn: ({ signal }) => listMebbisJobs(100, signal),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.some((j) => ACTIVE_STATUSES.includes(mapMebbisStatusToJobStatus(j.status)));
      return hasActive ? POLL_INTERVAL_MS : false;
    },
  });

  const queueStatusQuery = useQuery({
    queryKey: ["mebbisJobs", "queue", "status"],
    queryFn: ({ signal }) => getMebbisJobQueueStatus(signal),
    refetchInterval: 30_000,
  });

  const jobs = useMemo<MebJob[]>(
    () =>
      (jobsQuery.data ?? []).map((item) =>
        mapBackendJob(item, t)
      ),
    [jobsQuery.data, t]
  );
  const loading = jobsQuery.isPending;
  const loadError = jobsQuery.isError;
  const lastSyncedAt = jobsQuery.dataUpdatedAt > 0 ? jobsQuery.dataUpdatedAt : null;
  const pollFailing = jobsQuery.isError && !jobsQuery.isPending;

  // nowTick: "X dk önce güncellendi" metnini canlı tutmak için tick.
  useEffect(() => {
    if (!pollFailing) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [pollFailing]);

  const summary = useMemo(() => buildJobsSummary(jobs), [jobs]);
  const filtered = useMemo(
    () =>
      sortJobs(
        applyFilter(
          jobs,
          filter,
          jobTypeFilter,
          candidateFilter,
          stepFilter,
          startedAtFilter,
          durationFilter
        ),
        sort
      ),
    [candidateFilter, durationFilter, filter, jobTypeFilter, jobs, sort, startedAtFilter, stepFilter]
  );

  const jobTypeOptions = useMemo<TableHeaderFilterOption[]>(() => {
    const distinct = Array.from(new Set(jobs.map((j) => j.jobType)))
      .filter((value) => value && value.trim().length > 0)
      .sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));
    return [
      { value: "all", label: t("common.all") },
      ...distinct.map((value) => ({ value, label: value })),
    ];
  }, [jobs, t]);

  const statusFilterOptions = useMemo<TableHeaderFilterOption[]>(
    () => FILTERS.map((f) => ({ value: f.key, label: t(f.labelKey) })),
    [t]
  );
  const allLabel = t("common.all");
  const candidateFilterOptions = useMemo(
    () => buildFilterOptions(jobs.map(getCandidateFilterValue), allLabel),
    [jobs, allLabel]
  );
  const stepFilterOptions = useMemo(
    () => buildFilterOptions(jobs.map((job) => job.step), allLabel),
    [jobs, allLabel]
  );
  const startedAtFilterOptions = useMemo(
    () => buildFilterOptions(jobs.map(getStartedAtFilterValue), allLabel, formatDateFilterLabel),
    [jobs, allLabel]
  );
  const durationFilterOptions = useMemo(
    () => buildFilterOptions(jobs.map(getDurationFilterValue), allLabel),
    [jobs, allLabel]
  );

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (current.field === key) {
        return { field: key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      const direction: SortDir = key === "startedAt" || key === "duration" ? "desc" : "asc";
      return { field: key, direction };
    });
  };

  const selected = selectedId ? jobs.find((j) => j.id === selectedId) ?? null : null;
  const previousJobStatusesRef = useRef<Map<string, JobStatus>>(new Map());
  const scheduledDomainRefreshJobIdsRef = useRef<Set<string>>(new Set());

  const openDrawer = (id: string) => setSearchParams({ selected: id });
  const closeDrawer = () => setSearchParams({});
  const invalidateMebbisJobData = useCallback((includeDomainData = false) => {
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    if (!includeDomainData) return;
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
    void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: groupKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["training", "groups"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
  }, [queryClient]);

  const scheduleDomainRefreshAfterMebbisCompletion = useCallback(() => {
    for (const delay of [0, 1500, 4000, 8000]) {
      window.setTimeout(() => invalidateMebbisJobData(true), delay);
    }
  }, [invalidateMebbisJobData]);

  useEffect(() => {
    if (!jobsQuery.data) return;
    let completedWhileOpen = false;
    const nextStatuses = new Map<string, JobStatus>();
    for (const job of jobsQuery.data) {
      const status = mapMebbisStatusToJobStatus(job.status);
      const previousStatus = previousJobStatusesRef.current.get(job.id);
      nextStatuses.set(job.id, status);
      const transitionedFromActive =
        previousStatus &&
        ACTIVE_STATUSES.includes(previousStatus) &&
        !ACTIVE_STATUSES.includes(status);
      const shouldRefreshDomainData =
        isDomainApplyMebbisJob(job.jobType) &&
        (transitionedFromActive || (!previousStatus && isRecentlyCompletedDomainJob(job)));
      if (shouldRefreshDomainData && !scheduledDomainRefreshJobIdsRef.current.has(job.id)) {
        scheduledDomainRefreshJobIdsRef.current.add(job.id);
        completedWhileOpen = true;
      }
    }
    previousJobStatusesRef.current = nextStatuses;
    if (completedWhileOpen) {
      scheduleDomainRefreshAfterMebbisCompletion();
    }
  }, [jobsQuery.data, scheduleDomainRefreshAfterMebbisCompletion]);

  const handleCancel = async (job: MebJob) => {
    if (!canManageMebJobs) return;
    setActionPendingId(job.id);
    try {
      await cancelMebbisJob(job.id);
      showToast(t("mebJobs.toast.cancelled"));
      invalidateMebbisJobData();
    } catch {
      showToast(t("mebJobs.toast.cancelFailed"), "error");
    } finally {
      setActionPendingId(null);
    }
  };

  const handleRetryJob = async (job: MebJob) => {
    if (!canManageMebJobs) return;
    setActionPendingId(job.id);
    try {
      await retryMebbisJob(job.id);
      showToast("MEB işi tekrar kuyruğa alındı");
      invalidateMebbisJobData();
    } catch {
      showToast("MEB işi tekrar başlatılamadı", "error");
    } finally {
      setActionPendingId(null);
    }
  };

  const handleRetryManualJobs = async () => {
    if (!canManageMebJobs) return;
    setManualRetrying(true);
    try {
      const result = await retryMebbisJobs({
        statuses: ["needs_manual_action"],
        jobType: jobTypeFilter !== "all" ? jobTypeFilter : undefined,
        limit: 100,
      });
      showToast(`${result.createdCount} manuel MEB işi tekrar kuyruğa alındı`);
      invalidateMebbisJobData();
    } catch {
      showToast("Manuel kalan MEB işleri tekrar başlatılamadı", "error");
    } finally {
      setManualRetrying(false);
    }
  };

  const handleQueueRetry = async () => {
    if (!canManageMebJobs) return;
    setQueueRetrying(true);
    try {
      const result = await retryMebbisJobQueuePublishes(100);
      showToast(`${result.retriedCount} kuyruk işi yeniden denendi`);
      invalidateMebbisJobData();
      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "queue", "status"] });
    } catch {
      showToast(t("mebJobs.toast.retryFailed"), "error");
    } finally {
      setQueueRetrying(false);
    }
  };

  const handleExtensionPair = async () => {
    if (!canManageMebJobs) return;
    setExtensionPairing(true);
    try {
      const result = await pairMebbisExtensionClient(extensionDisplayName.trim() || "Office Chrome");
      setExtensionPairResult(result);
      showToast("Extension token uretildi");
      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "queue", "status"] });
    } catch {
      showToast("Extension token uretilemedi", "error");
    } finally {
      setExtensionPairing(false);
    }
  };

  const handleCopyExtensionToken = async () => {
    if (!extensionPairResult?.apiToken) return;
    await navigator.clipboard.writeText(extensionPairResult.apiToken);
    showToast("Token kopyalandi");
  };

  return (
    <>
      <PageToolbar
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              disabled={loading}
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] })}
              type="button"
            >
              <RefreshIcon size={14} />
              Yenile
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!canManageMebJobs || manualRetrying}
              onClick={() => void handleRetryManualJobs()}
              title={!canManageMebJobs ? noPermissionTitle : undefined}
              type="button"
            >
              {manualRetrying ? "Başlatılıyor..." : "Manuel Kalanları Tekrar Başlat"}
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!canManageMebJobs}
              onClick={() => setModalOpen(true)}
              title={!canManageMebJobs ? noPermissionTitle : undefined}
              type="button"
            >
              <PlusIcon size={14} />
              Yeni MEB İşi
            </button>
          </>
        }
        title="Meb Sync"
      />

      <div className="jobs-summary">
        {summary.map((s) => (
          <JobsSummaryCard
            count={s.count}
            key={s.status}
            label={t(s.labelKey)}
            tone={s.tone}
          />
        ))}
      </div>

      <QueueHealthBand
        canRetry={canManageMebJobs}
        loading={queueStatusQuery.isPending}
        noPermissionTitle={noPermissionTitle}
        onRetry={handleQueueRetry}
        retrying={queueRetrying}
        status={queueStatusQuery.data}
      />

      <ExtensionPairPanel
        canManage={canManageMebJobs}
        displayName={extensionDisplayName}
        noPermissionTitle={noPermissionTitle}
        onCopyToken={() => void handleCopyExtensionToken()}
        onDisplayNameChange={setExtensionDisplayName}
        onPair={() => void handleExtensionPair()}
        pairing={extensionPairing}
        pairResult={extensionPairResult}
      />

      <div className="jobs-toolbar">
        {FILTERS.map((f) => (
          <FilterChip
            active={f.key === filter}
            key={f.key}
            onClick={() => setFilter(f.key)}
          >
            {t(f.labelKey)}
          </FilterChip>
        ))}
      </div>

      {pollFailing && (
        <div className="meb-jobs-stale-banner" role="status">
          <span>
            {t("mebJobs.stale.banner", { since: formatStaleSince(lastSyncedAt, nowTick, t) })}
          </span>
          <button
            className="btn btn-link btn-sm"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] })}
            type="button"
          >
            Yenile
          </button>
        </div>
      )}

      <div className="table-wrap">
        {loadError ? (
          <PageLoadError
            title={t("mebJobs.error.loadTitle")}
            description={t("mebJobs.error.loadDescription")}
            onRetry={() => void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] })}
          />
        ) : (
        <Panel>
          <table className="data-table data-table-clickable">
            <thead>
              <tr>
                <SortableTh
                  field="jobType"
                  filterControl={
                    <TableHeaderFilter
                      active={jobTypeFilter !== "all"}
                      onChange={setJobTypeFilter}
                      options={jobTypeOptions}
                      title={t("mebJobs.filter.jobType")}
                      value={jobTypeFilter}
                    />
                  }
                  label={t("mebJobs.filter.jobType")}
                  onToggle={toggleSort}
                  sort={sort}
                />
                <SortableTh
                  field="candidate"
                  filterControl={
                    <TableHeaderFilter
                      active={candidateFilter !== "all"}
                      onChange={setCandidateFilter}
                      options={candidateFilterOptions}
                      title="Aday"
                      value={candidateFilter}
                    />
                  }
                  label="Aday"
                  onToggle={toggleSort}
                  sort={sort}
                />
                <SortableTh
                  field="step"
                  filterControl={
                    <TableHeaderFilter
                      active={stepFilter !== "all"}
                      onChange={setStepFilter}
                      options={stepFilterOptions}
                      title={t("mebJobs.filter.step")}
                      value={stepFilter}
                    />
                  }
                  label={t("mebJobs.filter.step")}
                  onToggle={toggleSort}
                  sort={sort}
                />
                <SortableTh
                  field="status"
                  filterControl={
                    <TableHeaderFilter
                      active={filter !== "all"}
                      onChange={(next) => setFilter(next as StatusFilter)}
                      options={statusFilterOptions}
                      title="Durum"
                      value={filter}
                    />
                  }
                  label="Durum"
                  onToggle={toggleSort}
                  sort={sort}
                />
                <SortableTh
                  field="queue"
                  label="Kuyruk"
                  onToggle={toggleSort}
                  sort={sort}
                />
                <SortableTh
                  field="startedAt"
                  filterControl={
                    <TableHeaderFilter
                      active={startedAtFilter !== "all"}
                      onChange={setStartedAtFilter}
                      options={startedAtFilterOptions}
                      title={t("mebJobs.filter.startTime")}
                      value={startedAtFilter}
                    />
                  }
                  label={t("mebJobs.filter.startTime")}
                  onToggle={toggleSort}
                  sort={sort}
                />
                <SortableTh
                  field="duration"
                  filterControl={
                    <TableHeaderFilter
                      active={durationFilter !== "all"}
                      onChange={setDurationFilter}
                      options={durationFilterOptions}
                      title={t("mebJobs.filter.duration")}
                      value={durationFilter}
                    />
                  }
                  label={t("mebJobs.filter.duration")}
                  onToggle={toggleSort}
                  sort={sort}
                />
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} onClick={() => openDrawer(job.id)}>
                  <td>
                    <span className="job-type">{job.jobType}</span>
                  </td>
                  <td>
                    <div className="job-candidate-cell">
                      <span className="job-candidate-name">
                        {job.candidateName ?? job.targetSecondary}
                      </span>
                      {job.candidateName && (
                        <span className="job-candidate-secondary">{job.targetSecondary}</span>
                      )}
                    </div>
                  </td>
                  <td>{job.step}</td>
                  <td>
                    <StatusPill status={job.status} />
                  </td>
                  <td>
                    <QueuePublishStatus job={job} />
                  </td>
                  <td>
                    <span className="job-time">{formatJobTime(job.startedAtIso)}</span>
                  </td>
                  <td>
                    <span className="job-duration">
                      {formatDuration(job.startedAtIso, job.completedAtIso)}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="job-row-actions">
                      {ACTIVE_STATUSES.includes(job.status) && (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={actionPendingId === job.id || !canManageMebJobs}
                          onClick={() => void handleCancel(job)}
                          title={!canManageMebJobs ? noPermissionTitle : undefined}
                          type="button"
                        >
                          İptal
                        </button>
                      )}
                      {!ACTIVE_STATUSES.includes(job.status) && job.status !== "success" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={actionPendingId === job.id || !canManageMebJobs}
                          onClick={() => void handleRetryJob(job)}
                          title={!canManageMebJobs ? noPermissionTitle : undefined}
                          type="button"
                        >
                          Tekrar Başlat
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td className="data-table-empty" colSpan={8}>
                    Bu filtreye uyan iş yok.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="data-table-empty" colSpan={8}>
                    MEB işleri yükleniyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
        )}
      </div>

      <JobDrawer
        job={selected}
        canCancel={canManageMebJobs}
        onCancel={() => selected && void handleCancel(selected)}
        onClose={closeDrawer}
      />

      <NewMebJobModal
        canManage={canManageMebJobs}
        onClose={() => setModalOpen(false)}
        onSubmit={async (values) => {
          if (!canManageMebJobs) return;
          await createCandidateLookupJob(values.candidateId);
          setModalOpen(false);
          showToast(t("mebJobs.toast.queued"));
          invalidateMebbisJobData();
        }}
        open={modalOpen}
      />
    </>
  );
}

type SortableThProps = {
  field: SortKey;
  filterControl?: ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: SortKey) => void;
};

function SortableTh({ field, filterControl, label, sort, onToggle }: SortableThProps) {
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
        {filterControl ? <div className="sortable-th-filter">{filterControl}</div> : null}
      </div>
    </th>
  );
}

function mapBackendJob(
  job: MebbisJobResponse,
  t: ReturnType<typeof useT>,
): MebJob {
  const payload = parseJobPayload(job);
  const nationalId = typeof payload.nationalId === "string" ? payload.nationalId : null;
  const candidateName =
    typeof payload.candidateName === "string" && payload.candidateName.trim().length > 0
      ? payload.candidateName.trim()
      : null;
  const targetSecondary = nationalId ?? job.entityId ?? "-";

  return {
    id: job.id,
    jobNo: `#${job.id.slice(0, 8)}`,
    jobType: mebbisJobTypeLabel(job.jobType, t),
    candidateName,
    targetSecondary,
    step: buildStepText(job, t),
    status: mapMebbisStatusToJobStatus(job.status),
    startedAtIso: job.startedAtUtc ?? job.createdAtUtc,
    completedAtIso: job.completedAtUtc,
    errorMessage: job.errorMessage,
    queuePublishedAtIso: job.queuePublishedAtUtc ?? null,
    queuePublishLastAttemptAtIso: job.queuePublishLastAttemptAtUtc ?? null,
    queuePublishAttemptCount: job.queuePublishAttemptCount ?? 0,
    queuePublishError: job.queuePublishError ?? null,
  };
}

function QueuePublishStatus({ job }: { job: MebJob }) {
  const t = useT();
  const label = getQueuePublishLabel(job, t);
  const tone = job.queuePublishError
    ? "danger"
    : job.queuePublishedAtIso
      ? "success"
      : "muted";
  return (
    <span className={`queue-publish-status ${tone}`} title={getQueuePublishTitle(job, t)}>
      {label}
    </span>
  );
}

function QueueHealthBand({
  canRetry,
  loading,
  noPermissionTitle,
  onRetry,
  retrying,
  status,
}: {
  canRetry: boolean;
  loading: boolean;
  noPermissionTitle: string;
  onRetry: () => void;
  retrying: boolean;
  status?: Awaited<ReturnType<typeof getMebbisJobQueueStatus>>;
}) {
  const t = useT();
  const hasUnpublished = (status?.unpublishedPendingCount ?? 0) > 0;
  const tone =
    status?.healthStatus === "danger"
      ? "danger"
      : status?.healthStatus === "warning"
        ? "warning"
        : "success";
  const disabled = loading || retrying || !canRetry || !hasUnpublished;

  return (
    <div className={`queue-health-band ${tone}`}>
      <div className="queue-health-main">
        <span className="queue-health-title">Kuyruk</span>
        <span className="queue-health-meta">
          {loading
            ? t("mebJobs.statusUnknown")
            : `${status?.streamsEnabled ? "Redis Stream" : "DB fallback"} · ${status?.streamName ?? "-"} · ${status?.consumerGroupName ?? "-"}`}
        </span>
        {status?.healthMessage && <span className="queue-health-message">{status.healthMessage}</span>}
        {status?.redisError && <span className="queue-health-error">{status.redisError}</span>}
        {status?.lastExtensionSeenAtUtc && (
          <span className="queue-health-meta">
            Son extension: {status.lastExtensionDisplayName ?? "-"} · {formatFullDateTime(status.lastExtensionSeenAtUtc)}
          </span>
        )}
      </div>
      <div className="queue-health-metrics">
        <span>Aktif {status?.activeJobCount ?? 0}</span>
        <span>Bekleyen {status?.pendingJobCount ?? 0}</span>
        <span>Publish bekleyen {status?.unpublishedPendingCount ?? 0}</span>
        <span>Hata {status?.publishErrorCount ?? 0}</span>
        <span>
          Extension {status?.healthyExtensionClientCount ?? 0}/{status?.activeExtensionClientCount ?? 0}
        </span>
        {status?.streamsEnabled && (
          <>
            <span>Redis pending {status.redisPendingMessageCount ?? "-"}</span>
            <span>Consumer {status.redisConsumerCount ?? "-"}</span>
          </>
        )}
      </div>
      <button
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        onClick={onRetry}
        title={!canRetry ? noPermissionTitle : !hasUnpublished ? "Yeniden denenecek publish yok." : undefined}
        type="button"
      >
        {retrying ? "Deneniyor" : "Publish retry"}
      </button>
    </div>
  );
}

function ExtensionPairPanel({
  canManage,
  displayName,
  noPermissionTitle,
  onCopyToken,
  onDisplayNameChange,
  onPair,
  pairing,
  pairResult,
}: {
  canManage: boolean;
  displayName: string;
  noPermissionTitle: string;
  onCopyToken: () => void;
  onDisplayNameChange: (value: string) => void;
  onPair: () => void;
  pairing: boolean;
  pairResult: MebbisExtensionPairResponse | null;
}) {
  const disabled = !canManage || pairing;

  return (
    <div className="queue-health-band success">
      <div className="queue-health-main">
        <span className="queue-health-title">MEBBIS Extension Pair</span>
        <span className="queue-health-meta">
          Yetkili kullanici aktif kurum ve kendi kullanici hesabi icin extension token uretir.
          Extension giris bilgisini tokeni ureten kullanicidan okur.
        </span>
        {pairResult && (
          <span className="queue-health-message">
            {pairResult.client.displayName} icin token olusturuldu. Token yalniz bir kez gosterilir.
          </span>
        )}
      </div>
      <div className="queue-health-metrics">
        <label className="form-group" style={{ minWidth: 220 }}>
          <span className="form-label">Extension adi</span>
          <input
            className="form-input"
            disabled={pairing}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            value={displayName}
          />
        </label>
        {pairResult && (
          <label className="form-group" style={{ minWidth: 320 }}>
            <span className="form-label">Extension token</span>
            <input
              className="form-input"
              readOnly
              type="text"
              value={pairResult.apiToken}
            />
          </label>
        )}
      </div>
      <div className="job-row-actions">
        {pairResult && (
          <button className="btn btn-secondary btn-sm" onClick={onCopyToken} type="button">
            Kopyala
          </button>
        )}
        <button
          className="btn btn-primary btn-sm"
          disabled={disabled}
          onClick={onPair}
          title={!canManage ? noPermissionTitle : undefined}
          type="button"
        >
          {pairing ? "Uretiliyor" : "Token uret"}
        </button>
      </div>
    </div>
  );
}

function getQueuePublishLabel(job: MebJob, t: ReturnType<typeof useT>): string {
  if (job.queuePublishError) return t("mebJobs.publish.streamError");
  if (job.queuePublishedAtIso) return t("mebJobs.publish.stream");
  if ((job.queuePublishAttemptCount ?? 0) > 0) return t("mebJobs.publish.dbFallback");
  return t("mebJobs.publish.db");
}

function getQueuePublishTitle(job: MebJob, t: ReturnType<typeof useT>): string {
  if (job.queuePublishError) {
    return job.queuePublishError;
  }

  if (job.queuePublishedAtIso) {
    return t("mebJobs.publishTitle.wrote", { time: formatFullDateTime(job.queuePublishedAtIso) });
  }

  if (job.queuePublishLastAttemptAtIso) {
    return t("mebJobs.publishTitle.lastAttempt", { time: formatFullDateTime(job.queuePublishLastAttemptAtIso) });
  }

  return t("mebJobs.publishTitle.dbQueue");
}

function buildStepText(job: MebbisJobResponse, t: ReturnType<typeof useT>): string {
  if (job.errorMessage) {
    return job.errorMessage;
  }

  switch (job.status) {
    case "pending":
      return t("mebJobs.step.pending");
    case "leased":
    case "running":
      return t("mebJobs.step.running");
    case "retry":
      return t("mebJobs.step.retry");
    case "succeeded":
      return t("mebJobs.step.succeeded");
    case "needs_manual_action":
      return t("mebJobs.step.needsManual");
    case "cancelled":
      return t("mebJobs.step.cancelled");
    case "failed":
      return t("mebJobs.step.failed");
    default:
      return job.status;
  }
}

function formatStaleSince(ts: number | null, now: number, t: ReturnType<typeof useT>): string {
  if (ts == null) return t("mebJobs.stale.never");
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) return t("mebJobs.stale.seconds", { count: diffSec });
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("mebJobs.stale.minutes", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  return t("mebJobs.stale.hours", { count: diffHr });
}

function formatJobTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString(currentLocale(), {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(currentLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "-";
  const end = endIso ? new Date(endIso) : new Date();
  if (Number.isNaN(end.getTime())) return "-";
  const ms = Math.max(0, end.getTime() - start.getTime());
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} sn`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min} dk ${remSec} sn`;
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return `${h} sa ${remMin} dk`;
}
