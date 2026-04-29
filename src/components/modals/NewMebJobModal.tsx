import { useEffect, useMemo, useState } from "react";

import { getCandidates } from "../../lib/candidates-api";
import type { CandidateResponse } from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";

export type NewMebJobSubmitValues = {
  jobType: string;
  candidateId: string;
};

type NewMebJobModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: NewMebJobSubmitValues) => void | Promise<void>;
};

const JOB_TYPES = [{ label: "Aday Durum Görüntüleme", value: "candidate_lookup" }];
const SEARCH_DEBOUNCE_MS = 300;
const RESULT_LIMIT = 20;

type CandidateLite = Pick<CandidateResponse, "id" | "firstName" | "lastName" | "nationalId" | "licenseClass">;

export function NewMebJobModal({ open, onClose, onSubmit }: NewMebJobModalProps) {
  const [jobType, setJobType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [candidates, setCandidates] = useState<CandidateLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CandidateLite | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setJobType("");
    setSearch("");
    setDebouncedSearch("");
    setCandidates([]);
    setSelected(null);
    setSubmitError(null);
    setSubmitting(false);
  }, [open]);

  // Debounce search input
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  // Fetch candidates when modal open and search changes
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    getCandidates(
      {
        search: debouncedSearch || undefined,
        pageSize: RESULT_LIMIT,
        sortBy: "name",
        sortDir: "asc",
      },
      controller.signal
    )
      .then((response) => {
        setCandidates(
          response.items.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            nationalId: c.nationalId,
            licenseClass: c.licenseClass,
          }))
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCandidates([]);
      })
      .finally(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, [open, debouncedSearch]);

  const canSubmit = useMemo(
    () => Boolean(jobType) && Boolean(selected) && !submitting,
    [jobType, selected, submitting]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({ jobType, candidateId: selected.id });
    } catch {
      setSubmitError("İş başlatılamadı. Tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            İptal
          </button>
          <button
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            type="button"
          >
            {submitting ? "Başlatılıyor…" : "İşi Başlat"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Yeni MEB İşi"
    >
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">İş Tipi</label>
            <CustomSelect
              className="form-select"
              onChange={(e) => setJobType(e.target.value)}
              placeholder="İş tipi seçin"
              value={jobType}
            >
              <option value="" disabled>
                İş tipi seçin
              </option>
              {JOB_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Aday</label>
            {selected ? (
              <div className="meb-modal-selected">
                <div className="meb-modal-selected-info">
                  <span className="meb-modal-selected-name">
                    {selected.firstName} {selected.lastName}
                  </span>
                  <span className="meb-modal-selected-meta">
                    {selected.nationalId}
                    {selected.licenseClass ? ` · ${selected.licenseClass}` : ""}
                  </span>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelected(null)}
                  type="button"
                >
                  Değiştir
                </button>
              </div>
            ) : (
              <>
                <input
                  autoFocus
                  className="form-input"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ad, soyad veya TC ile ara…"
                  type="text"
                  value={search}
                />
                <div className="meb-modal-candidate-list">
                  {loading ? (
                    <div className="meb-modal-candidate-empty">Yükleniyor…</div>
                  ) : candidates.length === 0 ? (
                    <div className="meb-modal-candidate-empty">
                      {debouncedSearch ? "Eşleşen aday bulunamadı." : "Aday yok."}
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <button
                        className="meb-modal-candidate-item"
                        key={c.id}
                        onClick={() => setSelected(c)}
                        type="button"
                      >
                        <span className="meb-modal-candidate-name">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="meb-modal-candidate-meta">
                          {c.nationalId}
                          {c.licenseClass ? ` · ${c.licenseClass}` : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {submitError && <div className="form-error">{submitError}</div>}

        <div className="info-box">
          <span className="info-icon">i</span>
          <span>
            İş arka planda çalışacak. Sonucu MEB İşleri sayfasından takip edebilirsiniz.
            Hata durumunda otomatik bildirim alırsınız.
          </span>
        </div>
      </form>
    </Modal>
  );
}
