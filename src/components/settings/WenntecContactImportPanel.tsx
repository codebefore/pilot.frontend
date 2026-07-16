import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/http";
import { canManageArea, canViewArea } from "../../lib/permissions";
import {
  analyzeWenntecContactImport,
  applyWenntecContactImport,
  getWenntecContactImport,
  listWenntecContactImportReviewItems,
  listWenntecContactImports,
  type WenntecContactImportBatch,
  type WenntecContactImportSummary,
} from "../../lib/wenntec-contact-import-api";
import type { JobStatus } from "../../types";
import { StatusPill } from "../ui/StatusPill";
import { useToast } from "../ui/Toast";

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const ACTIVE = new Set(["apply_queued", "applying", "finalizing"]);
const MIGRATION_ACCESS_REQUIRED_TITLE = "Verified migration approval is required.";

const metrics: Array<[string, keyof WenntecContactImportSummary]> = [
  ["Toplam satır", "totalRows"],
  ["Tekil T.C.", "distinctIdentities"],
  ["Mükerrer T.C.", "duplicateIdentities"],
  ["Adayla eşleşen", "matchedIdentities"],
  ["Adayı bulunamayan", "candidateNotFoundIdentities"],
  ["Telefonu kullanılabilir", "phoneAvailableIdentities"],
  ["Adresi kullanılabilir", "addressAvailableIdentities"],
  ["Telefon yazılacak aday", "phoneFillCandidates"],
  ["Adres yazılacak aday", "addressFillCandidates"],
  ["Kaynak çakışması", "sourceConflictIdentities"],
  ["Geçersiz T.C. satırı", "invalidNationalIdRows"],
  ["Güncellenen aday", "updatedCandidates"],
  ["Değişiklik gerekmeyen", "noChangeIdentities"],
  ["Manuel inceleme", "manualReviewIdentities"],
];

export function WenntecContactImportPanel({
  migrationAccessToken,
  onMigrationAccessInvalid,
}: {
  migrationAccessToken: string;
  onMigrationAccessInvalid: () => void;
}) {
  const { activeInstitution, user, permissions } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const canView = canViewArea(user, permissions, "candidates");
  const canManage = canManageArea(user, permissions, "candidates");
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<WenntecContactImportBatch | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryKey = useMemo(
    () => ["candidate-contact-imports", activeInstitution?.id ?? "none"],
    [activeInstitution?.id],
  );
  const history = useQuery({
    queryKey,
    queryFn: ({ signal }) => listWenntecContactImports(migrationAccessToken, signal),
    enabled: canView,
    refetchInterval: (query) => query.state.data?.some((batch) => ACTIVE.has(batch.status)) ? 2_000 : false,
  });
  const detail = useQuery({
    queryKey: [...queryKey, selected?.id ?? "none"],
    queryFn: ({ signal }) => getWenntecContactImport(selected!.id, migrationAccessToken, signal),
    enabled: canView && selected !== null && ACTIVE.has(selected.status),
    refetchInterval: 2_000,
  });
  const upload = useMutation({
    mutationFn: (source: File) => analyzeWenntecContactImport(source, migrationAccessToken),
    onSuccess: (batch) => {
      setSelected(batch);
      void queryClient.invalidateQueries({ queryKey });
      showToast("Wenntec iletişim dosyası analiz edildi.");
    },
    onError: (error) => handleError(error, "Dosya analiz edilemedi.", showToast, onMigrationAccessInvalid),
  });
  const apply = useMutation({
    mutationFn: (id: string) => applyWenntecContactImport(id, migrationAccessToken),
    onSuccess: (batch) => {
      setSelected(batch);
      void queryClient.invalidateQueries({ queryKey });
      showToast("Aday iletişim aktarımı job kuyruğuna alındı.");
    },
    onError: (error) => handleError(error, "Aktarım başlatılamadı.", showToast, onMigrationAccessInvalid),
  });

  useEffect(() => {
    const current = detail.data ?? history.data?.find((batch) => batch.id === selected?.id);
    if (current && (current.updatedAtUtc !== selected?.updatedAtUtc || current.status !== selected?.status)) {
      setSelected(current);
    }
  }, [detail.data, history.data, selected]);

  useEffect(() => {
    if (isAccessError(history.error) || isAccessError(detail.error)) onMigrationAccessInvalid();
  }, [detail.error, history.error, onMigrationAccessInvalid]);

  const visible = selected ?? history.data?.[0] ?? null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) return showToast("Önce erentc.sql dosyasını seçin.", "error");
    if (file.size > MAX_FILE_SIZE) return showToast("Dosya 12 MB sınırını aşıyor.", "error");
    upload.mutate(file);
  };

  return (
    <>
      <section className="settings-surface">
        <div className="settings-surface-header"><h2 className="settings-surface-title">Wenntec Aday İletişim Aktarımı</h2></div>
        <div className="settings-surface-body">
          <div className="settings-info-note">
            T.C. kimlik numarasıyla eşleşen aktif adayların yalnızca boş telefon ve adres alanları doldurulur.
            Dolu alanların üzerine yazılmaz. Aynı T.C. ile bulunan tüm aday kayıtları güncellenir.
          </div>
          {canManage ? (
            <form className="settings-form wenntec-upload-form" onSubmit={submit}>
              <div className="form-group">
                <label className="form-label" htmlFor="wenntec-contact-file">Wenntec iletişim SQL dosyası</label>
                <input
                  accept=".sql,application/sql,text/plain"
                  className="form-input"
                  id="wenntec-contact-file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <span className="settings-info-note">UTF-16 LE, en fazla 12 MB; beklenen dosya: erentc.sql</span>
              </div>
              <div className="settings-form-actions">
                <button className="btn btn-primary" disabled={!file || upload.isPending} type="submit">
                  {upload.isPending ? "Analiz ediliyor..." : "Dosyayı analiz et"}
                </button>
              </div>
            </form>
          ) : <div className="settings-info-note">Bu işlem için aday yönetme yetkisi gereklidir.</div>}
        </div>
      </section>

      {visible && (
        <section className="settings-surface">
          <div className="settings-surface-header">
            <div>
              <h2 className="settings-surface-title">Dry-run Özeti</h2>
              <div className="settings-info-note">{visible.sourceFileName} · {formatSize(visible.fileSizeBytes)} · {visible.fileSha256.slice(0, 12)}…</div>
            </div>
            <StatusPill {...statusOf(visible.status)} />
          </div>
          <div className="settings-surface-body">
            <div className="settings-summary-grid">
              {metrics.map(([label, key]) => (
                <div className="settings-summary-card" key={key}>
                  <span className="settings-summary-label">{label}</span>
                  <strong className="settings-summary-value">{(visible.summary[key] ?? 0).toLocaleString("tr-TR")}</strong>
                </div>
              ))}
            </div>
            {visible.errorMessage && <div className="settings-form-helper error" role="alert">{visible.errorMessage}</div>}
            {visible.status === "analyzed" || visible.status === "apply_failed" || visible.status === "completed_with_review" ? (
              <div className="settings-form-actions wenntec-confirm-popover-anchor">
                <button className="btn btn-primary" disabled={!canManage || apply.isPending} onClick={() => setConfirmOpen(true)} type="button">
                  {visible.status === "completed_with_review" ? "Bulunamayanları tekrar kontrol et" : "Aktarımı başlat"}
                </button>
                {confirmOpen && (
                  <div className="wenntec-confirm-popover" role="dialog" aria-modal="true">
                    <strong>Aday iletişim aktarımını başlat</strong>
                    <p>Yalnızca boş telefon/adres alanları arka plan job’ı ile doldurulacak. Devam edilsin mi?</p>
                    <div className="settings-form-actions">
                      <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)} type="button">Vazgeç</button>
                      <button className="btn btn-primary" onClick={() => { setConfirmOpen(false); apply.mutate(visible.id); }} type="button">Evet, başlat</button>
                    </div>
                  </div>
                )}
              </div>
            ) : ACTIVE.has(visible.status) ? (
              <div className="settings-info-note">
                {visible.status === "finalizing"
                  ? `Servis güncellemeleri tamamlanıyor: ${(visible.summary.projectionMessagesPublished ?? 0).toLocaleString("tr-TR")} / ${(visible.summary.projectionMessagesTotal ?? 0).toLocaleString("tr-TR")}`
                  : `Aktarım arka plan job’ı tarafından işleniyor: ${visible.summary.processedIdentities.toLocaleString("tr-TR")} / ${visible.summary.distinctIdentities.toLocaleString("tr-TR")}`}
              </div>
            ) : null}
            {visible.status === "completed_with_review" && (
              <ReviewItems batch={visible} token={migrationAccessToken} />
            )}
          </div>
        </section>
      )}

      {(history.data?.length ?? 0) > 0 && (
        <section className="settings-surface">
          <div className="settings-surface-header"><h2 className="settings-surface-title">Son İletişim Analizleri</h2></div>
          <div className="settings-surface-body settings-module-list">
            {history.data?.map((batch) => (
              <button className="wenntec-history-item" key={batch.id} onClick={() => setSelected(batch)} type="button">
                <span><strong>{batch.sourceFileName}</strong><small>{formatDate(batch.createdAtUtc)}</small></span>
                <span>{statusOf(batch.status).label}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ReviewItems({ batch, token }: { batch: WenntecContactImportBatch; token: string }) {
  const query = useQuery({
    queryKey: ["candidate-contact-import-review", batch.id],
    queryFn: ({ signal }) => listWenntecContactImportReviewItems(batch.id, token, signal),
  });
  return (
    <div>
      <h3 className="settings-surface-title">Manuel İnceleme ({batch.summary.manualReviewIdentities})</h3>
      {query.isPending ? <div className="settings-info-note">Kayıtlar yükleniyor...</div> : null}
      {query.isError ? <div className="settings-form-helper error">İnceleme kayıtları yüklenemedi.</div> : null}
      <div className="settings-module-list">
        {query.data?.map((item) => (
          <div className="settings-module-item" key={item.id}>
            <div><strong>{item.maskedNationalId}</strong><div className="settings-info-note">{item.reason ?? item.status}</div></div>
            <div className="settings-info-note">{item.phoneNumber ?? "Telefon yok"} · {item.address ?? "Adres yok"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusOf(status: string): { label: string; status: JobStatus } {
  const values: Record<string, { label: string; status: JobStatus }> = {
    analyzed: { label: "Analiz tamamlandı", status: "warning" },
    apply_queued: { label: "Aktarım kuyruğunda", status: "queued" },
    applying: { label: "Adaylar güncelleniyor", status: "running" },
    finalizing: { label: "Servisler güncelleniyor", status: "running" },
    completed: { label: "Tamamlandı", status: "success" },
    completed_with_review: { label: "Tamamlandı / inceleme var", status: "manual" },
    apply_failed: { label: "Aktarım başarısız", status: "failed" },
  };
  return values[status] ?? { label: status, status: "warning" };
}

function handleError(error: unknown, fallback: string, toast: (message: string, tone?: "success" | "error") => void, invalidate: () => void) {
  if (isAccessError(error)) invalidate();
  toast(error instanceof ApiError ? error.problemTitle ?? fallback : fallback, "error");
}

function isAccessError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403 && error.problemTitle === MIGRATION_ACCESS_REQUIRED_TITLE;
}

function formatDate(value: string) { return new Date(value).toLocaleString("tr-TR"); }
function formatSize(value: number) { return `${(value / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`; }
