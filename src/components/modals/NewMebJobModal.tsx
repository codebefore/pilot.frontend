import { useEffect, useId, useMemo, useState } from "react";

import { getCandidates } from "../../lib/candidates-api";
import { useT } from "../../lib/i18n";
import { formatNationalId } from "../../lib/national-id";
import type { CandidateResponse } from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { PanelListSkeleton } from "../ui/Skeleton";

type NewMebJobSubmitValues = {
  jobType: string;
  candidateId: string;
};

type NewMebJobModalProps = {
  open: boolean;
  canManage?: boolean;
  onClose: () => void;
  onSubmit: (values: NewMebJobSubmitValues) => void | Promise<void>;
};

const SEARCH_DEBOUNCE_MS = 300;
const RESULT_LIMIT = 20;

type CandidateLite = Pick<CandidateResponse, "id" | "firstName" | "lastName" | "nationalId" | "licenseClass">;

export function NewMebJobModal({
  open,
  canManage = true,
  onClose,
  onSubmit,
}: NewMebJobModalProps) {
  const t = useT();
  const [jobType, setJobType] = useState<string>("");
  const jobTypeSelectId = useId();
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
    () => canManage && Boolean(jobType) && Boolean(selected) && !submitting,
    [canManage, jobType, selected, submitting]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({ jobType, candidateId: selected.id });
    } catch {
      setSubmitError(t("newMebJob.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            title={!canManage ? t("common.noPermission") : undefined}
            type="button"
          >
            {submitting ? t("newMebJob.submitting") : t("newMebJob.submit")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={t("newMebJob.modalTitle")}
    >
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={jobTypeSelectId}>{t("newMebJob.jobTypeLabel")}</label>
            <CustomSelect
              id={jobTypeSelectId}
              className="form-select"
              disabled={!canManage}
              onChange={(e) => setJobType(e.target.value)}
              placeholder={t("newMebJob.jobTypePlaceholder")}
              value={jobType}
            >
              <option value="" disabled>
                {t("newMebJob.jobTypePlaceholder")}
              </option>
              <option value="candidate_lookup">
                {t("newMebJob.jobType.candidateLookup")}
              </option>
            </CustomSelect>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("newMebJob.candidateLabel")}</label>
            {selected ? (
              <div className="meb-modal-selected">
                <div className="meb-modal-selected-info">
                  <span className="meb-modal-selected-name">
                    {selected.firstName} {selected.lastName}
                  </span>
                  <span className="meb-modal-selected-meta">
                    {formatNationalId(selected.nationalId)}
                    {selected.licenseClass ? ` · ${selected.licenseClass}` : ""}
                  </span>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={!canManage}
                  onClick={() => setSelected(null)}
                  title={!canManage ? t("common.noPermission") : undefined}
                  type="button"
                >
                  {t("newMebJob.changeCandidate")}
                </button>
              </div>
            ) : (
              <>
                <input
                  autoFocus
                  className="form-input"
                  disabled={!canManage}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("newMebJob.searchPlaceholder")}
                  type="text"
                  value={search}
                />
                <div className="meb-modal-candidate-list">
                  {loading ? (
                    <PanelListSkeleton rows={4} />
                  ) : candidates.length === 0 ? (
                    <div className="meb-modal-candidate-empty">
                      {debouncedSearch ? t("newMebJob.candidateNoMatch") : t("newMebJob.candidateEmpty")}
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <button
                        className="meb-modal-candidate-item"
                        disabled={!canManage}
                        key={c.id}
                        onClick={() => setSelected(c)}
                        title={!canManage ? t("common.noPermission") : undefined}
                        type="button"
                      >
                        <span className="meb-modal-candidate-name">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="meb-modal-candidate-meta">
                          {formatNationalId(c.nationalId)}
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
          <span>{t("newMebJob.infoBox")}</span>
        </div>
      </form>
    </Modal>
  );
}
