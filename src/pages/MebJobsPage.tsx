import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { JobDrawer } from "../components/drawers/JobDrawer";
import { PlusIcon, RefreshIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { NewMebJobModal } from "../components/modals/NewMebJobModal";
import { FilterChip } from "../components/ui/FilterChip";
import { JobsSummaryCard } from "../components/ui/JobsSummaryCard";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { getCandidates } from "../lib/candidates-api";
import {
  cancelMebbisJob,
  createCandidateLookupJob,
  listMebbisJobs,
  mapMebbisStatusToJobStatus,
  mebbisJobTypeLabel,
  parseJobPayload,
  type MebbisJobResponse,
} from "../lib/mebbis-jobs-api";
import { buildJobsSummary, type MebJob } from "../mock/mebJobs";
import type { JobStatus } from "../types";

type StatusFilter = "all" | "running" | "queued" | "manual" | "failed" | "success";

type SortKey =
  | "jobType"
  | "candidate"
  | "step"
  | "status"
  | "startedAt"
  | "duration";

type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<JobStatus, number> = {
  running: 0,
  queued: 1,
  warning: 2,
  manual: 2,
  failed: 3,
  success: 4,
};

function sortJobs(jobs: MebJob[], key: SortKey, dir: SortDir): MebJob[] {
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

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all",     label: "Tümü" },
  { key: "running", label: "Çalışıyor" },
  { key: "queued",  label: "Bekliyor" },
  { key: "manual",  label: "Manuel" },
  { key: "failed",  label: "Hata" },
  { key: "success", label: "Başarılı" },
];

const ACTIVE_STATUSES: JobStatus[] = ["running", "queued"];
const POLL_INTERVAL_MS = 5000;

function applyFilter(jobs: MebJob[], filter: StatusFilter): MebJob[] {
  if (filter === "all") return jobs;
  return jobs.filter((j) => j.status === filter);
}

type CandidateLite = { id: string; firstName: string; lastName: string; nationalId: string };

export function MebJobsPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("startedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [jobs, setJobs] = useState<MebJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [candidatesById, setCandidatesById] = useState<Map<string, CandidateLite>>(new Map());
  const [candidatesByNationalId, setCandidatesByNationalId] = useState<Map<string, CandidateLite>>(
    new Map()
  );
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("selected");
  const candidateMapsRef = useRef({
    byId: candidatesById,
    byNationalId: candidatesByNationalId,
  });

  useEffect(() => {
    candidateMapsRef.current = { byId: candidatesById, byNationalId: candidatesByNationalId };
  }, [candidatesById, candidatesByNationalId]);

  const loadJobs = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const items = await listMebbisJobs(100);
        const { byId, byNationalId } = candidateMapsRef.current;
        setJobs(items.map((item) => mapBackendJob(item, byId, byNationalId)));
      } catch {
        if (showSpinner) showToast("MEB işleri yüklenemedi", "error");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    let cancelled = false;
    getCandidates({ pageSize: 500 })
      .then((response) => {
        if (cancelled) return;
        const list: CandidateLite[] = response.items.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          nationalId: c.nationalId,
        }));
        setCandidatesById(new Map(list.map((c) => [c.id, c])));
        setCandidatesByNationalId(new Map(list.map((c) => [c.nationalId, c])));
      })
      .catch(() => {
        // sessizce yut — sadece aday ad eşleşmesi olmaz
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  // Aktif (running/queued) iş varken arka planda polling
  const hasActiveJob = useMemo(
    () => jobs.some((j) => ACTIVE_STATUSES.includes(j.status)),
    [jobs]
  );

  useEffect(() => {
    if (!hasActiveJob) return;
    const id = window.setInterval(() => {
      void loadJobs(false);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [hasActiveJob, loadJobs]);

  const summary = useMemo(() => buildJobsSummary(jobs), [jobs]);
  const filtered = useMemo(
    () => sortJobs(applyFilter(jobs, filter), sortKey, sortDir),
    [jobs, filter, sortKey, sortDir]
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "startedAt" || key === "duration" ? "desc" : "asc");
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const selected = selectedId ? jobs.find((j) => j.id === selectedId) ?? null : null;

  const openDrawer = (id: string) => setSearchParams({ selected: id });
  const closeDrawer = () => setSearchParams({});

  const handleCancel = async (job: MebJob) => {
    setActionPendingId(job.id);
    try {
      await cancelMebbisJob(job.id);
      showToast("İş iptal edildi");
      await loadJobs(false);
    } catch {
      showToast("İş iptal edilemedi", "error");
    } finally {
      setActionPendingId(null);
    }
  };

  return (
    <>
      <PageToolbar
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              disabled={loading}
              onClick={() => void loadJobs()}
              type="button"
            >
              <RefreshIcon size={14} />
              Yenile
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setModalOpen(true)}
              type="button"
            >
              <PlusIcon size={14} />
              Yeni MEB İşi
            </button>
          </>
        }
        title="MEB İşleri"
      />

      <div className="jobs-summary">
        {summary.map((s) => (
          <JobsSummaryCard
            count={s.count}
            key={s.status}
            label={s.label}
            tone={s.tone}
          />
        ))}
      </div>

      <div className="jobs-toolbar">
        {FILTERS.map((f) => (
          <FilterChip
            active={f.key === filter}
            key={f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      <div className="table-wrap">
        <Panel>
          <table className="data-table data-table-clickable">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("jobType")}>
                  İş Tipi{sortIndicator("jobType")}
                </th>
                <th className="sortable" onClick={() => toggleSort("candidate")}>
                  Aday{sortIndicator("candidate")}
                </th>
                <th className="sortable" onClick={() => toggleSort("step")}>
                  Adım{sortIndicator("step")}
                </th>
                <th className="sortable" onClick={() => toggleSort("status")}>
                  Durum{sortIndicator("status")}
                </th>
                <th className="sortable" onClick={() => toggleSort("startedAt")}>
                  Başlangıç{sortIndicator("startedAt")}
                </th>
                <th className="sortable" onClick={() => toggleSort("duration")}>
                  Süre{sortIndicator("duration")}
                </th>
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
                          disabled={actionPendingId === job.id}
                          onClick={() => void handleCancel(job)}
                          type="button"
                        >
                          İptal
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td className="data-table-empty" colSpan={7}>
                    Bu filtreye uyan iş yok.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="data-table-empty" colSpan={7}>
                    MEB işleri yükleniyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      <JobDrawer
        job={selected}
        onCancel={() => selected && void handleCancel(selected)}
        onClose={closeDrawer}
      />

      <NewMebJobModal
        onClose={() => setModalOpen(false)}
        onSubmit={async (values) => {
          await createCandidateLookupJob(values.candidateId);
          setModalOpen(false);
          showToast("MEB işi kuyruğa alındı");
          await loadJobs();
        }}
        open={modalOpen}
      />
    </>
  );
}

function mapBackendJob(
  job: MebbisJobResponse,
  candidatesById: Map<string, CandidateLite>,
  candidatesByNationalId: Map<string, CandidateLite>
): MebJob {
  const payload = parseJobPayload(job);
  const nationalId = typeof payload.nationalId === "string" ? payload.nationalId : null;

  const candidate =
    (job.entityId ? candidatesById.get(job.entityId) : undefined) ??
    (nationalId ? candidatesByNationalId.get(nationalId) : undefined);

  const candidateName = candidate ? `${candidate.firstName} ${candidate.lastName}` : null;
  const targetSecondary = candidate?.nationalId ?? nationalId ?? job.entityId ?? "-";

  return {
    id: job.id,
    jobNo: `#${job.id.slice(0, 8)}`,
    jobType: mebbisJobTypeLabel(job.jobType),
    candidateName,
    targetSecondary,
    step: buildStepText(job),
    status: mapMebbisStatusToJobStatus(job.status),
    startedAtIso: job.startedAtUtc ?? job.createdAtUtc,
    completedAtIso: job.completedAtUtc,
    errorMessage: job.errorMessage,
  };
}

function buildStepText(job: MebbisJobResponse): string {
  if (job.errorMessage) {
    return job.errorMessage;
  }

  switch (job.status) {
    case "pending":
      return "Kuyrukta";
    case "leased":
    case "running":
      return "Extension çalışıyor";
    case "retry":
      return "Başarısız";
    case "succeeded":
      return "Tamamlandı";
    case "needs_manual_action":
      return "Manuel işlem gerekli";
    case "cancelled":
      return "İptal edildi";
    case "failed":
      return "Başarısız";
    default:
      return job.status;
  }
}

function formatJobTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
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
