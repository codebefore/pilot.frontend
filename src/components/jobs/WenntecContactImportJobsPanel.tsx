import { useQuery, useQueryClient } from "@tanstack/react-query";

import { listWenntecContactImportJobs, type WenntecContactImportBatch } from "../../lib/wenntec-contact-import-api";
import type { JobStatus } from "../../types";
import { RefreshIcon } from "../icons";
import { Panel } from "../ui/Panel";
import { StatusPill } from "../ui/StatusPill";

const ACTIVE = new Set(["apply_queued", "applying", "finalizing"]);

export function WenntecContactImportJobsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["wenntecContactImportJobs"],
    queryFn: ({ signal }) => listWenntecContactImportJobs(signal),
    refetchInterval: (state) => state.state.data?.some((batch) => ACTIVE.has(batch.status)) ? 3_000 : false,
  });
  return (
    <div className="wenntec-jobs-panel">
      <Panel
        action={(
          <button className="btn btn-secondary btn-sm" disabled={query.isFetching} onClick={() => void queryClient.invalidateQueries({ queryKey: ["wenntecContactImportJobs"] })} type="button">
            <RefreshIcon size={14} />{query.isFetching ? "Yenileniyor..." : "Yenile"}
          </button>
        )}
        title="Wenntec Aday İletişim Aktarımları"
      >
        {query.isError ? <div className="wenntec-jobs-message wenntec-jobs-message--error">İletişim aktarım işleri yüklenemedi.</div> : (
          <div className="wenntec-jobs-table-wrap">
            <table className="data-table wenntec-jobs-table">
              <thead><tr><th>Dosya</th><th>Durum</th><th>İlerleme</th><th>Deneme</th><th>Başlatan</th><th>Güncellenme</th></tr></thead>
              <tbody>
                {(query.data ?? []).map((batch) => <JobRow batch={batch} key={batch.id} />)}
                {query.isPending && <tr><td className="data-table-empty" colSpan={6}>Aktarım işleri yükleniyor.</td></tr>}
                {!query.isPending && (query.data?.length ?? 0) === 0 && <tr><td className="data-table-empty" colSpan={6}>Henüz iletişim aktarım işi yok.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function JobRow({ batch }: { batch: WenntecContactImportBatch }) {
  const state = statusOf(batch.status);
  const handled = batch.summary.processedIdentities || 0;
  const progress = batch.status === "finalizing"
    ? `${(batch.summary.projectionMessagesPublished ?? 0).toLocaleString("tr-TR")} / ${(batch.summary.projectionMessagesTotal ?? 0).toLocaleString("tr-TR")} servis güncellemesi`
    : `${handled.toLocaleString("tr-TR")} / ${batch.summary.distinctIdentities.toLocaleString("tr-TR")}`;
  return (
    <>
      <tr>
        <td><div className="wenntec-job-file"><span>{batch.sourceFileName}</span><code>{batch.id.slice(0, 8)}</code></div></td>
        <td><StatusPill label={state.label} status={state.pill} /></td>
        <td>{progress}</td>
        <td>{batch.attemptCount}</td>
        <td>{batch.appliedByName ?? batch.createdByName ?? "-"}</td>
        <td>{new Date(batch.updatedAtUtc).toLocaleString("tr-TR")}</td>
      </tr>
      {batch.errorMessage && <tr className="wenntec-job-error-row"><td colSpan={6}><strong>Hata:</strong> {batch.errorMessage}</td></tr>}
      {(batch.summary.errorLogs?.length ?? 0) > 0 && (
        <tr className="wenntec-job-error-row wenntec-job-error-log-row">
          <td colSpan={6}>
            <details>
              <summary>Hata geçmişi ({batch.summary.errorLogs.length})</summary>
              <ol className="wenntec-job-error-log">
                {batch.summary.errorLogs.map((entry, index) => (
                  <li key={`${entry.occurredAtUtc}-${entry.attempt}-${index}`}>
                    <span>{new Date(entry.occurredAtUtc).toLocaleString("tr-TR")} · {entry.stage === "projection" ? "Servis güncellemesi" : "Aday aktarımı"} · Deneme {entry.attempt}</span>
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

function statusOf(status: string): { label: string; pill: JobStatus } {
  const values: Record<string, { label: string; pill: JobStatus }> = {
    analyzed: { label: "Analiz tamamlandı", pill: "warning" },
    apply_queued: { label: "Aktarım kuyruğunda", pill: "queued" },
    applying: { label: "Adaylar güncelleniyor", pill: "running" },
    finalizing: { label: "Servisler güncelleniyor", pill: "running" },
    completed: { label: "Tamamlandı", pill: "success" },
    completed_with_review: { label: "Tamamlandı / inceleme var", pill: "manual" },
    apply_failed: { label: "Aktarım başarısız", pill: "failed" },
  };
  return values[status] ?? { label: status, pill: "warning" };
}
