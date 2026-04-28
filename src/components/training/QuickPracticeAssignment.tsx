import { useMemo, useState } from "react";

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
   *  Boş array → scope yok, tüm aktif adaylar listelenir. Doluysa
   *  search boşken sadece o ID'lerdeki adaylar görünür; search yazılınca
   *  tüm aktif aday havuzunda filtre yapılır (scope dışı erişim için). */
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
  const [search, setSearch] = useState("");

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

  const scopeActive = (scopedCandidateIds?.length ?? 0) > 0;

  // Search boşken: scope varsa sadece scope, yoksa ilk N kayıt + hint.
  // Search yazılınca her zaman tüm aktif adaylar (scope dışı erişim).
  const PREVIEW_LIMIT = 20;
  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) {
      if (scopeActive) {
        const set = new Set(scopedCandidateIds);
        return sortedCandidates.filter((c) => set.has(c.id));
      }
      return sortedCandidates.slice(0, PREVIEW_LIMIT);
    }
    return sortedCandidates.filter((c) => {
      const name = `${c.firstName} ${c.lastName}`.toLocaleLowerCase("tr");
      return (
        name.includes(q) ||
        c.nationalId.toLocaleLowerCase("tr").includes(q) ||
        (c.phoneNumber?.toLocaleLowerCase("tr").includes(q) ?? false)
      );
    });
  }, [sortedCandidates, search, scopeActive, scopedCandidateIds]);

  const hiddenCount =
    search.trim().length === 0 && !scopeActive
      ? Math.max(0, sortedCandidates.length - PREVIEW_LIMIT)
      : 0;

  const toggle = (id: string) => {
    if (isLoading) return;
    onSettingsChange({ candidateId: id === candidateId ? "" : id });
  };

  return (
    <div className="training-quick-assign">
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
      <input
        className="training-filters-search"
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("training.quick.candidatePlaceholder")}
        type="search"
        value={search}
      />
      <ul className="training-filters-list training-filters-list-scroll">
        {filteredCandidates.map((c) => {
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
        {filteredCandidates.length === 0 ? (
          <li className="training-filters-empty">
            {t("training.filter.noMatches")}
          </li>
        ) : null}
        {hiddenCount > 0 ? (
          <li className="training-filters-empty">
            {t("training.quick.candidateSearchHint", { count: hiddenCount })}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
