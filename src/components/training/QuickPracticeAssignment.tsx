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
};

export function QuickPracticeAssignment({
  candidates,
  candidateId,
  onSettingsChange,
  isLoading = false,
}: QuickPracticeAssignmentProps) {
  const t = useT();
  const hasCandidate = candidateId !== "";
  const [expanded, setExpanded] = useState(hasCandidate);
  const panelId = useId();

  useEffect(() => {
    if (hasCandidate) setExpanded(true);
  }, [hasCandidate]);

  const sortedCandidates = useMemo(
    () =>
      candidates
        .filter((c) => c.id === candidateId || c.status === "active")
        .slice()
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`,
            "tr"
          )
        ),
    [candidates, candidateId]
  );

  const visibleCandidates = useMemo(() => {
    return candidateId
      ? sortedCandidates.filter((c) => c.id === candidateId)
      : sortedCandidates;
  }, [sortedCandidates, candidateId]);

  const toggle = (id: string) => {
    if (isLoading) return;
    onSettingsChange({ candidateId: id === candidateId ? "" : id });
  };

  if (!hasCandidate) return null;

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
