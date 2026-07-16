import { useQuery, useQueryClient } from "@tanstack/react-query";

import { RefreshIcon } from "../icons";
import { Panel } from "../ui/Panel";
import { StatusPill } from "../ui/StatusPill";
import { listWenntecImportJobs, type WenntecImportBatch } from "../../lib/wenntec-import-api";
import type { JobStatus } from "../../types";

const ACTIVE_STATUSES = new Set(["queued", "processing", "apply_queued", "applying", "finalizing"]);

const STATUS_LABELS: Record<string, { label: string; pill: JobStatus }> = {
  queued: { label: "Analiz kuyruğunda", pill: "queued" },
  processing: { label: "Analiz ediliyor", pill: "running" },
  analyzed: { label: "Analiz tamamlandı", pill: "warning" },
  apply_queued: { label: "Aktarım kuyruğunda", pill: "queued" },
  applying: { label: "Muhasebeye aktarılıyor", pill: "running" },
  finalizing: { label: "Projeksiyonlar tamamlanıyor", pill: "running" },
  completed: { label: "Tamamlandı", pill: "success" },
  completed_with_review: { label: "Tamamlandı / inceleme var", pill: "manual" },
  failed: { label: "Analiz başarısız", pill: "failed" },
  apply_failed: { label: "Aktarım başarısız", pill: "failed" },
};

const ERROR_STAGE_LABELS: Record<string, string> = {
  analysis: "Analiz",
  apply: "Muhasebe aktarımı",
  projection: "Projeksiyon",
};

function statusOf(status: string) {
  return STATUS_LABELS[status] ?? { label: status, pill: "warning" as JobStatus };
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function progressOf(batch: WenntecImportBatch): string {
  if (["queued", "processing", "analyzed", "failed"].includes(batch.status)) {
    return batch.summary.totalRows > 0 ? `${batch.summary.totalRows.toLocaleString("tr-TR")} satır` : "-";
  }

  const handled = batch.summary.processedRows ?? (
    batch.summary.importedRows + batch.summary.skippedRows + batch.summary.manualReviewRows
  );
  const total = batch.summary.totalRows;
  return total > 0
    ? `${handled.toLocaleString("tr-TR")} / ${total.toLocaleString("tr-TR")}`
    : `${handled.toLocaleString("tr-TR")} kayıt`;
}

export function WenntecImportJobsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["wenntecImportJobs"],
    queryFn: ({ signal }) => listWenntecImportJobs(signal),
    refetchInterval: (state) => {
      const batches = state.state.data;
      if (batches?.some((batch) => ACTIVE_STATUSES.has(batch.status))) return 3_000;
      return batches?.some((batch) => batch.status === "analyzed") ? 10_000 : false;
    },
  });

  return (
    <div className="wenntec-jobs-panel">
      <Panel
        action={
          <button
            className="btn btn-secondary btn-sm"
            disabled={query.isFetching}
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["wenntecImportJobs"] })}
            type="button"
          >
            <RefreshIcon size={14} />
            {query.isFetching ? "Yenileniyor..." : "Yenile"}
          </button>
        }
        title="Wenntec Muhasebe Aktarımları"
      >
        {query.isError ? (
          <div className="wenntec-jobs-message wenntec-jobs-message--error" role="alert">
            Aktarım işleri yüklenemedi.
          </div>
        ) : (
          <div className="wenntec-jobs-table-wrap">
            <table className="data-table wenntec-jobs-table">
              <thead>
                <tr>
                  <th>Dosya</th>
                  <th>Durum</th>
                  <th>İlerleme</th>
                  <th>Deneme</th>
                  <th>Başlatan</th>
                  <th>Güncellenme</th>
                </tr>
              </thead>
              <tbody>
                {(query.data ?? []).map((batch) => {
                  const status = statusOf(batch.status);
                  return (
                    <WenntecJobRows batch={batch} key={batch.id} status={status} />
                  );
                })}
                {query.isPending && (
                  <tr><td className="data-table-empty" colSpan={6}>Aktarım işleri yükleniyor.</td></tr>
                )}
                {!query.isPending && (query.data?.length ?? 0) === 0 && (
                  <tr><td className="data-table-empty" colSpan={6}>Henüz Wenntec aktarım işi yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function WenntecJobRows({
  batch,
  status,
}: {
  batch: WenntecImportBatch;
  status: { label: string; pill: JobStatus };
}) {
  return (
    <>
      <tr>
        <td>
          <div className="wenntec-job-file">
            <span>{batch.sourceFileName}</span>
            <code>{batch.id.slice(0, 8)}</code>
          </div>
        </td>
        <td><StatusPill label={status.label} status={status.pill} /></td>
        <td>{progressOf(batch)}</td>
        <td>{batch.attemptCount}</td>
        <td>{batch.appliedByName ?? batch.createdByName ?? "-"}</td>
        <td>{formatDateTime(batch.updatedAtUtc)}</td>
      </tr>
      {batch.errorMessage && (
        <tr className="wenntec-job-error-row">
          <td colSpan={6}>
            <strong>Hata:</strong> {batch.errorMessage}
          </td>
        </tr>
      )}
      {(batch.summary.errorLogs?.length ?? 0) > 0 && (
        <tr className="wenntec-job-error-row wenntec-job-error-log-row">
          <td colSpan={6}>
            <details>
              <summary>Hata geçmişi ({batch.summary.errorLogs.length})</summary>
              <ol className="wenntec-job-error-log">
                {batch.summary.errorLogs.map((entry, index) => (
                  <li key={`${entry.occurredAtUtc}-${entry.attempt}-${index}`}>
                    <span>
                      {formatDateTime(entry.occurredAtUtc)} · {ERROR_STAGE_LABELS[entry.stage] ?? entry.stage} · Deneme {entry.attempt}
                    </span>
                    <p>{entry.message}</p>
                  </li>
                ))}
              </ol>
            </details>
          </td>
        </tr>
      )}
    </>
  );
}
