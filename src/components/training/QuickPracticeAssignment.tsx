import { useMemo } from "react";
import { Link } from "react-router-dom";

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
      <ul className="training-filters-list training-filters-list-scroll">
        {visibleCandidates.map((c) => {
          const checked = c.id === candidateId;
          return (
            <li key={c.id}>
              <div className="training-filters-item training-quick-assign-candidate">
                <div className="training-quick-assign-candidate-info">
                  <span className="training-quick-assign-candidate-name">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="license-class-badge">{c.licenseClass}</span>
                </div>
                <div className="training-quick-assign-candidate-actions">
                  <label className="training-quick-assign-candidate-toggle switch-toggle switch-toggle-sm">
                    <input
                      aria-label={t("training.picker.selectCandidate", {
                        name: `${c.firstName} ${c.lastName}`,
                      })}
                      checked={checked}
                      disabled={isLoading}
                      onChange={() => toggle(c.id)}
                      type="checkbox"
                    />
                    <span className="switch-toggle-control" />
                  </label>
                  <Link
                    aria-label={t("training.picker.openCandidate", {
                      name: `${c.firstName} ${c.lastName}`,
                    })}
                    className="training-filters-candidate-detail"
                    title={t("training.picker.openCandidate", {
                      name: `${c.firstName} ${c.lastName}`,
                    })}
                    rel="noopener noreferrer"
                    target="_blank"
                    to={`/candidates/${c.id}`}
                  >
                    <svg
                      aria-hidden="true"
                      fill="none"
                      height="14"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="14"
                    >
                      <path d="M15 3h6v6" />
                      <path d="M10 14 21 3" />
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
        {visibleCandidates.length === 0 ? (
          <li className="training-filters-empty">
            {t("training.filter.noMatches")}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
