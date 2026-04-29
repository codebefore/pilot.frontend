import { useEffect, useMemo, useState } from "react";

import { useT } from "../../lib/i18n";
import {
  getCandidates,
  type CandidateSortField,
  type SortDirection,
} from "../../lib/candidates-api";
import type { TrainingCalendarEvent } from "../../lib/training-calendar";
import type { CandidateResponse } from "../../lib/types";
import { CandidateAvatar } from "../ui/CandidateAvatar";

type PracticeCandidatePickerProps = {
  /** Sayfanın tüm uygulama event'leri — kart başına saat toplamak için. */
  events: TrainingCalendarEvent[];
  /** Bulk yönlendirme ile gelinen aday kümesi; varsa fetch yerine
   *  sadece bu ID'ler frontend'de filtrelenir. */
  scopedCandidateIds?: readonly string[];
  /** Kart tıklanınca QA'ya yazılır. */
  onPick: (candidateId: string) => void;
  /** Bulk scope aktifken üstte çıkan "Tümünü göster" linki için. */
  onClearScope?: () => void;
};

const DEFAULT_TARGET = 16;
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 100;

// Frontend-only sıralama anahtarları (backend'de yok, lokal hesap).
type LocalSortField = "progress" | "lastLesson";
// Tüm sıralanabilir kolon anahtarları.
type SortField = CandidateSortField | LocalSortField;

const BACKEND_SORT_FIELDS: ReadonlySet<SortField> = new Set<SortField>([
  "name",
  "licenseClass",
  "groupTitle",
]);

function hoursOfEvent(e: TrainingCalendarEvent): number {
  return (e.end.getTime() - e.start.getTime()) / (60 * 60 * 1000);
}

export function PracticeCandidatePicker({
  events,
  scopedCandidateIds,
  onPick,
  onClearScope,
}: PracticeCandidatePickerProps) {
  const t = useT();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({ field: "progress", direction: "desc" });

  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      const stored = localStorage.getItem("pilot.training.pickerView");
      return stored === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  const switchView = (next: "grid" | "list") => {
    setViewMode(next);
    try {
      localStorage.setItem("pilot.training.pickerView", next);
    } catch {
      /* ignore */
    }
  };

  const scopeActive = (scopedCandidateIds?.length ?? 0) > 0;

  // Debounce: kullanıcı yazarken her keystroke'ta backend çağırma.
  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedSearch(searchInput),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(id);
  }, [searchInput]);

  // Backend'den aktif aday listesi. Sıralama backend destekliyse
  // sortBy/sortDir gönderilir; aksi halde local sort uygulanır.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const sendSort = BACKEND_SORT_FIELDS.has(sort.field);
    getCandidates(
      {
        status: "active",
        search: debouncedSearch.trim() || undefined,
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy: sendSort ? (sort.field as CandidateSortField) : undefined,
        sortDir: sendSort ? sort.direction : undefined,
      },
      controller.signal
    )
      .then((response) => setCandidates(response.items))
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, sort.field, sort.direction]);

  // Aday başına verilen uygulama saati ve son ders.
  type CardData = {
    candidate: CandidateResponse;
    hours: number;
    target: number;
    lastLessonAt: Date | null;
  };
  const cards: CardData[] = useMemo(() => {
    const eventsByCandidate = new Map<string, TrainingCalendarEvent[]>();
    for (const e of events) {
      if (e.kind !== "uygulama" || !e.candidateId) continue;
      const list = eventsByCandidate.get(e.candidateId) ?? [];
      list.push(e);
      eventsByCandidate.set(e.candidateId, list);
    }
    const base = scopeActive
      ? candidates.filter((c) => scopedCandidateIds!.includes(c.id))
      : candidates;
    return base.map((c) => {
      const own = eventsByCandidate.get(c.id) ?? [];
      const hours = own.reduce((sum, e) => sum + hoursOfEvent(e), 0);
      const target = c.educationPlan?.practiceLessonHours ?? DEFAULT_TARGET;
      const lastLessonAt = own.reduce<Date | null>(
        (acc, e) => (acc && acc > e.start ? acc : e.start),
        null
      );
      return { candidate: c, hours, target, lastLessonAt };
    });
  }, [
    candidates,
    events,
    scopeActive,
    scopedCandidateIds,
  ]);

  // Local sort (progress, lastLesson) — backend'de yok, frontend uygular.
  // Backend sıralı kolon seçildiyse bu blok sırayı değiştirmez (default
  // index sırası backend'den geliyor).
  const sortedCards = useMemo(() => {
    if (BACKEND_SORT_FIELDS.has(sort.field)) return cards;
    const dirMul = sort.direction === "desc" ? -1 : 1;
    return cards.slice().sort((a, b) => {
      if (sort.field === "progress") {
        // "İlerleme" — kalan saat çok olan üstte (default: desc).
        const aRem = a.target - a.hours;
        const bRem = b.target - b.hours;
        return (aRem - bRem) * dirMul;
      }
      if (sort.field === "lastLesson") {
        const aTs = a.lastLessonAt?.getTime() ?? -Infinity;
        const bTs = b.lastLessonAt?.getTime() ?? -Infinity;
        return (aTs - bTs) * dirMul;
      }
      return 0;
    });
  }, [cards, sort]);

  const formatLastLesson = (d: Date | null) => {
    if (!d) return null;
    return d.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const cycleSort = (field: SortField) => {
    setSort((prev) => {
      if (prev.field !== field) {
        // Yeni alana geçiş: progress için default desc (en kalan üstte),
        // diğerleri için asc.
        return {
          field,
          direction: field === "progress" ? "desc" : "asc",
        };
      }
      return {
        field,
        direction: prev.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  const sortIndicator = (field: SortField) => {
    if (sort.field !== field) return "";
    return sort.direction === "asc" ? " ▲" : " ▼";
  };

  const ariaSort = (field: SortField): "ascending" | "descending" | "none" => {
    if (sort.field !== field) return "none";
    return sort.direction === "asc" ? "ascending" : "descending";
  };

  return (
    <section className="practice-picker">
      <header className="practice-picker-header">
        <div className="practice-picker-title">
          <h3>{t("training.picker.title")}</h3>
          <span className="practice-picker-subtitle">
            {loading
              ? t("training.picker.loading")
              : t("training.picker.subtitle", { count: sortedCards.length })}
          </span>
        </div>
        <div className="practice-picker-header-actions">
          <div className="practice-picker-view-toggle" role="group">
            <button
              aria-pressed={viewMode === "grid"}
              className={
                viewMode === "grid"
                  ? "practice-picker-view-btn practice-picker-view-btn-active"
                  : "practice-picker-view-btn"
              }
              onClick={() => switchView("grid")}
              title={t("training.picker.view.grid")}
              type="button"
            >
              ▦
            </button>
            <button
              aria-pressed={viewMode === "list"}
              className={
                viewMode === "list"
                  ? "practice-picker-view-btn practice-picker-view-btn-active"
                  : "practice-picker-view-btn"
              }
              onClick={() => switchView("list")}
              title={t("training.picker.view.list")}
              type="button"
            >
              ☰
            </button>
          </div>
          {scopeActive && onClearScope ? (
            <button
              className="practice-picker-clear"
              onClick={onClearScope}
              type="button"
            >
              {t("training.quick.scopeClear")}
            </button>
          ) : null}
        </div>
      </header>

      <div className="practice-picker-controls">
        <input
          className="practice-picker-search"
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("training.quick.candidatePlaceholder")}
          type="search"
          value={searchInput}
        />
      </div>

      {sortedCards.length === 0 ? (
        <div className="practice-picker-empty">
          {loading ? t("training.picker.loading") : t("training.picker.empty")}
        </div>
      ) : viewMode === "list" ? (
        <table className="practice-picker-table">
          <thead>
            <tr>
              <th
                aria-sort={ariaSort("name")}
                className="practice-picker-th-sort"
                onClick={() => cycleSort("name")}
              >
                {t("training.picker.col.name")}
                {sortIndicator("name")}
              </th>
              <th
                aria-sort={ariaSort("licenseClass")}
                className="practice-picker-th-sort"
                onClick={() => cycleSort("licenseClass")}
              >
                {t("training.picker.col.licenseClass")}
                {sortIndicator("licenseClass")}
              </th>
              <th
                aria-sort={ariaSort("groupTitle")}
                className="practice-picker-th-sort"
                onClick={() => cycleSort("groupTitle")}
              >
                {t("training.picker.col.group")}
                {sortIndicator("groupTitle")}
              </th>
              <th
                aria-sort={ariaSort("progress")}
                className="practice-picker-th-sort"
                onClick={() => cycleSort("progress")}
              >
                {t("training.picker.col.progress")}
                {sortIndicator("progress")}
              </th>
              <th
                aria-sort={ariaSort("lastLesson")}
                className="practice-picker-th-sort"
                onClick={() => cycleSort("lastLesson")}
              >
                {t("training.picker.col.lastLesson")}
                {sortIndicator("lastLesson")}
              </th>
              <th>{t("training.picker.col.phone")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedCards.map(({ candidate, hours, target, lastLessonAt }) => {
              const remaining = Math.max(0, target - hours);
              const ratio = target > 0 ? Math.min(1, hours / target) : 0;
              const done = remaining <= 0;
              const almost = !done && remaining <= 4;
              return (
                <tr
                  className="practice-picker-row"
                  key={candidate.id}
                  onClick={() => onPick(candidate.id)}
                >
                  <td className="practice-picker-row-name">
                    <CandidateAvatar
                      candidate={candidate}
                      className="practice-picker-card-avatar"
                    />
                    <span>
                      {candidate.firstName} {candidate.lastName}
                    </span>
                  </td>
                  <td>
                    <span className="license-class-badge">
                      {candidate.licenseClass}
                    </span>
                  </td>
                  <td className="practice-picker-row-muted">
                    {candidate.currentGroup?.title ?? "—"}
                  </td>
                  <td>
                    <div className="practice-picker-row-progress">
                      <div
                        aria-hidden="true"
                        className={
                          done
                            ? "practice-picker-bar practice-picker-bar-done"
                            : almost
                              ? "practice-picker-bar practice-picker-bar-almost"
                              : "practice-picker-bar"
                        }
                      >
                        <div
                          className="practice-picker-bar-fill"
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </div>
                      <span
                        className={
                          done
                            ? "practice-picker-progress-text practice-picker-progress-text-done"
                            : "practice-picker-progress-text"
                        }
                      >
                        {Math.round(hours * 10) / 10} / {target}
                      </span>
                    </div>
                  </td>
                  <td className="practice-picker-row-muted">
                    {lastLessonAt ? formatLastLesson(lastLessonAt) : "—"}
                  </td>
                  <td className="practice-picker-row-muted">
                    {candidate.phoneNumber ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <ul className="practice-picker-grid">
          {sortedCards.map(({ candidate, hours, target, lastLessonAt }) => {
            const remaining = Math.max(0, target - hours);
            const ratio = target > 0 ? Math.min(1, hours / target) : 0;
            const done = remaining <= 0;
            const almost = !done && remaining <= 4;
            return (
              <li key={candidate.id}>
                <button
                  className="practice-picker-card"
                  onClick={() => onPick(candidate.id)}
                  type="button"
                >
                  <div className="practice-picker-card-head">
                    <CandidateAvatar
                      candidate={candidate}
                      className="practice-picker-card-avatar"
                    />
                    <div className="practice-picker-card-name">
                      <strong>
                        {candidate.firstName} {candidate.lastName}
                      </strong>
                      <span className="license-class-badge">
                        {candidate.licenseClass}
                      </span>
                    </div>
                  </div>

                  <div className="practice-picker-card-progress">
                    <div
                      aria-hidden="true"
                      className={
                        done
                          ? "practice-picker-bar practice-picker-bar-done"
                          : almost
                            ? "practice-picker-bar practice-picker-bar-almost"
                            : "practice-picker-bar"
                      }
                    >
                      <div
                        className="practice-picker-bar-fill"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                    <span
                      className={
                        done
                          ? "practice-picker-progress-text practice-picker-progress-text-done"
                          : "practice-picker-progress-text"
                      }
                    >
                      {Math.round(hours * 10) / 10} / {target}
                    </span>
                  </div>

                  <div className="practice-picker-card-meta">
                    {lastLessonAt ? (
                      <span>
                        {t("training.picker.lastLesson", {
                          at: formatLastLesson(lastLessonAt) ?? "",
                        })}
                      </span>
                    ) : (
                      <span className="practice-picker-card-meta-muted">
                        {t("training.picker.noLessonsYet")}
                      </span>
                    )}
                    {almost ? (
                      <span className="practice-picker-card-tag">
                        {t("training.picker.almostDone", { remaining })}
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
