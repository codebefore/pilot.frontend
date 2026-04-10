import { useMemo, useState } from "react";
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
import { buildJobsSummary, mockMebJobs, type MebJob } from "../mock/mebJobs";
import type { JobStatus } from "../types";

type StatusFilter = "all" | "running" | "attention" | "success";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all",       label: "Tümü" },
  { key: "running",   label: "Çalışıyor" },
  { key: "attention", label: "Hata / Manuel" },
  { key: "success",   label: "Başarılı" },
];

const ATTENTION_STATUSES: JobStatus[] = ["failed", "manual", "retry"];

function applyFilter(jobs: MebJob[], filter: StatusFilter): MebJob[] {
  switch (filter) {
    case "all":       return jobs;
    case "running":   return jobs.filter((j) => j.status === "running");
    case "success":   return jobs.filter((j) => j.status === "success");
    case "attention": return jobs.filter((j) => ATTENTION_STATUSES.includes(j.status));
  }
}

export function MebJobsPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("selected");

  const summary = useMemo(() => buildJobsSummary(mockMebJobs), []);
  const filtered = useMemo(() => applyFilter(mockMebJobs, filter), [filter]);

  const selected = selectedId
    ? mockMebJobs.find((j) => j.id === selectedId) ?? null
    : null;

  const openDrawer = (id: string) => setSearchParams({ selected: id });
  const closeDrawer = () => setSearchParams({});

  const handleRetry = (job: MebJob) => {
    showToast(`İş ${job.jobNo} yeniden kuyruğa alındı`);
    closeDrawer();
  };

  const handleManual = (job: MebJob) => {
    showToast(`Manuel işlem için ${job.jobNo} açıldı`);
  };

  return (
    <>
      <PageToolbar
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => showToast("Sayfa yenilendi")}
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
          <table className="data-table">
            <thead>
              <tr>
                <th>İş No</th>
                <th>İş Tipi</th>
                <th>Aday / Grup</th>
                <th>Adım</th>
                <th>Durum</th>
                <th>Başlangıç</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} onClick={() => openDrawer(job.id)}>
                  <td><span className="job-id">{job.jobNo}</span></td>
                  <td><span className="job-type">{job.jobType}</span></td>
                  <td><span className="job-candidate">{job.target}</span></td>
                  <td>{job.step}</td>
                  <td><StatusPill status={job.status} /></td>
                  <td><span className="job-time">{job.startedAt}</span></td>
                  <td>
                    {job.status === "failed" && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetry(job);
                        }}
                        type="button"
                      >
                        Tekrar Dene
                      </button>
                    )}
                    {job.status === "manual" && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManual(job);
                        }}
                        type="button"
                      >
                        İşlem Yap
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="data-table-empty" colSpan={7}>
                    Bu filtreye uyan iş yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      <JobDrawer
        job={selected}
        onClose={closeDrawer}
        onRetry={() => selected && handleRetry(selected)}
      />

      <NewMebJobModal
        onClose={() => setModalOpen(false)}
        onSubmit={() => {
          setModalOpen(false);
          showToast("MEB işi kuyruğa alındı");
        }}
        open={modalOpen}
      />
    </>
  );
}
