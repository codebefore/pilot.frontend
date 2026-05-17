import { useEffect, useId, useMemo, useState } from "react";

import { ChevronDownIcon } from "../icons";
import { useT } from "../../lib/i18n";
import type { CandidateResponse } from "../../lib/types";

type QuickPracticeAssignmentProps = {
  candidates: CandidateResponse[];
  /** Controlled: parent kontrol eder. */
  candidateId: string;
  /** Seçim değişikliğini parent'a (TrainingPage) iletiyor. */
  onSettingsChange: (params: { candidateId: string }) => void;
  isLoading?: boolean;
  /** Adaylar sayfasından bulk yönlendirme ile gelinen aday kümesi.
   *  Boş array → scope yok, panel başta kapalı; açılırsa tüm aktif adaylar listelenir.
   *  Doluysa scope adayları gösterilir ve panel açık gelir. */
  scopedCandidateIds?: readonly string[];
  /** Scope aktifken kullanıcıya "temizle" linki için. */
  onClearScope?: () => void;
};

export function QuickPracticeAssignment({
  candidates,
  candidateId,
  onSettingsChange,
  isLoading = false,
  scopedCandidateIds,
  onClearScope,
}: QuickPracticeAssignmentProps) {
  const t = useT();
  const scopeActive = (scopedCandidateIds?.length ?? 0) > 0;
  const [expanded, setExpanded] = useState(scopeActive);
  const panelId = useId();

  useEffect(() => {
    if (scopeActive) setExpanded(true);
  }, [scopeActive]);

  const sortedCandidates = useMemo(
    () =>
      candidates
        .filter((c) => c.status === "active")
        .slice()
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`,
            "tr"
          )
        ),
    [candidates]
  );

  const visibleCandidates = useMemo(() => {
    if (scopeActive) {
      const set = new Set(scopedCandidateIds);
      return sortedCandidates.filter((c) => set.has(c.id));
    }
    return sortedCandidates;
  }, [sortedCandidates, scopeActive, scopedCandidateIds]);

  const toggle = (id: string) => {
    if (isLoading) return;
    onSettingsChange({ candidateId: id === candidateId ? "" : id });
  };

  return (
    <div className="training-quick-assign">
      <button
        type="button"
        className={`training-quick-assign-header${expanded ? " is-open" : ""}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span className="training-quick-assign-chevron" aria-hidden="true">
          <ChevronDownIcon size={14} />
        </span>
        <span>{t("training.quick.candidateListTitle")}</span>
        <span className="training-quick-assign-count">
          {visibleCandidates.length}
        </span>
      </button>
      <div id={panelId} hidden={!expanded}>
        {expanded ? (
          <>
            {scopeActive ? (
              <div className="training-quick-assign-scope">
                <span>
                  {t("training.quick.scopeBadge", {
                    count: scopedCandidateIds?.length ?? 0,
                  })}
                </span>
                <button
                  className="training-quick-assign-scope-clear"
                  onClick={onClearScope}
                  type="button"
                >
                  {t("training.quick.scopeClear")}
                </button>
              </div>
            ) : null}
            <ul className="training-filters-list training-filters-list-scroll">
              {visibleCandidates.map((c) => {
                const checked = c.id === candidateId;
                return (
                  <li key={c.id}>
                    <label className="training-filters-item switch-toggle switch-toggle-sm">
                      <input
                        checked={checked}
                        disabled={isLoading}
                        onChange={() => toggle(c.id)}
                        type="checkbox"
                      />
                      <span className="switch-toggle-control" />
                      <span className="training-filters-name">
                        {c.firstName} {c.lastName} ({c.licenseClass})
                      </span>
                    </label>
                  </li>
                );
              })}
              {visibleCandidates.length === 0 ? (
                <li className="training-filters-empty">
                  {t("training.filter.noMatches")}
                </li>
              ) : null}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
