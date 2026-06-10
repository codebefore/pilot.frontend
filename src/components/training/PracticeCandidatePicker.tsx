import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";

import { MebIcon } from "../icons";
import { useT, currentLocale } from "../../lib/i18n";
import {
  getPracticeCandidates,
  type PracticeCandidateListItem,
  type PracticeCandidateTab,
} from "../../lib/practice-candidates-api";

type PracticeCandidatePickerProps = {
  onAssign: (candidateId: string) => void;
};

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 50;

const tabs: PracticeCandidateTab[] = ["all", "havuz", "basarisiz", "randevulu"];

export function PracticeCandidatePicker({ onAssign }: PracticeCandidatePickerProps) {
  const t = useT();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<PracticeCandidateTab>("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PracticeCandidateListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      const stored = localStorage.getItem("pilot.training.pickerView");
      return stored === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedSearch(searchInput),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tab]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getPracticeCandidates(
      {
        tab,
        search: debouncedSearch.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      },
      controller.signal
    )
      .then((response) => {
        setItems(response.items);
        setTotalCount(response.totalCount);
        setTotalPages(response.totalPages);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setItems([]);
        setTotalCount(0);
        setTotalPages(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, page, tab]);

  const switchView = (next: "grid" | "list") => {
    setViewMode(next);
    try {
      localStorage.setItem("pilot.training.pickerView", next);
    } catch {
      /* ignore */
    }
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(currentLocale(), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tabLabel = (value: PracticeCandidateTab) => {
    if (value === "all") return t("training.picker.stage.all");
    if (value === "havuz") return t("training.picker.stage.havuz");
    if (value === "basarisiz") return t("training.picker.stage.failed");
    return t("training.picker.stage.randevulu");
  };

  const currentColumns = useMemo(() => {
    return [
      t("training.picker.col.name"),
      t("training.picker.col.licenseClass"),
      t("training.picker.col.group"),
      t("training.picker.col.attempt"),
      t("training.picker.col.progress"),
      t("training.picker.col.lastLesson"),
    ];
  }, [t]);

  const openCandidate = (candidateId: string) => {
    navigate(`/candidates/${candidateId}`, {
      state: {
        returnLabel: "← Direksiyon sayfasına dön",
        returnTo: "/training/uygulama",
      },
    });
  };

  const assignCandidate = (event: MouseEvent, candidateId: string) => {
    event.stopPropagation();
    onAssign(candidateId);
  };

  const formatHours = (value: number) => {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };

  return (
    <section className="practice-picker">
      <header className="practice-picker-header">
        <div className="practice-picker-title">
          <h3>{t("training.picker.title")}</h3>
          <span className="practice-picker-subtitle">
            {loading
              ? t("training.picker.loading")
              : t("training.picker.subtitle", { count: totalCount })}
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
        <div className="practice-picker-stage-tabs" role="tablist">
          {tabs.map((value) => (
            <button
              aria-pressed={tab === value}
              className={
                tab === value
                  ? "practice-picker-stage-tab is-active"
                  : "practice-picker-stage-tab"
              }
              key={value}
              onClick={() => setTab(value)}
              type="button"
            >
              {tabLabel(value)}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="practice-picker-empty">
          {loading ? t("training.picker.loading") : t("training.picker.empty")}
        </div>
      ) : viewMode === "list" ? (
        <table className="practice-picker-table">
          <thead>
            <tr>
              {currentColumns.map((column) => (
                <th key={column}>{column}</th>
              ))}
              <th>{t("training.picker.col.assign")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((candidate) => (
              <tr
                className="practice-picker-row"
                key={candidate.candidateId}
                onClick={() => openCandidate(candidate.candidateId)}
              >
                <td className="practice-picker-row-name">
                  <span>
                    {candidate.fullName}
                    <small>{candidate.registrationNumber}</small>
                  </span>
                </td>
                <td>
                  <span className="license-class-badge">
                    {candidate.licenseClass}
                  </span>
                </td>
                <td className="practice-picker-row-muted">
                  {candidate.groupTitle ?? "—"}
                </td>
                <td>
                  <span className="practice-picker-attempt-badge">
                    {candidate.attemptSlotLabel}
                  </span>
                </td>
                <td>
                  <div className="practice-picker-row-progress">
                    <div
                      aria-hidden="true"
                      className={
                        candidate.remainingPracticeHours <= 0
                          ? "practice-picker-bar practice-picker-bar-done"
                          : candidate.remainingPracticeHours <= 4
                            ? "practice-picker-bar practice-picker-bar-almost"
                            : "practice-picker-bar"
                      }
                    >
                      <div
                        className="practice-picker-bar-fill"
                        style={{
                          width: `${
                            candidate.targetPracticeHours > 0
                              ? Math.min(
                                  100,
                                  (candidate.completedPracticeHours / candidate.targetPracticeHours) * 100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="practice-picker-progress-text">
                      {formatHours(candidate.completedPracticeHours)} / {formatHours(candidate.targetPracticeHours)}
                    </span>
                  </div>
                </td>
                <td className="practice-picker-row-muted">
                  {formatDateTime(candidate.lastPracticeLessonAt)}
                </td>
                <td className="practice-picker-action-cell">
                  <button
                    aria-label={t("training.picker.assignCandidate", {
                      name: candidate.fullName,
                    })}
                    className="practice-picker-assign-btn"
                    onClick={(event) => assignCandidate(event, candidate.candidateId)}
                    type="button"
                  >
                    <MebIcon size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="practice-picker-grid">
          {items.map((candidate) => (
            <li key={candidate.candidateId}>
              <div
                className="practice-picker-card"
                onClick={() => openCandidate(candidate.candidateId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCandidate(candidate.candidateId);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="practice-picker-card-head">
                  <div className="practice-picker-card-name">
                    <strong>{candidate.fullName}</strong>
                    <span className="license-class-badge">
                      {candidate.licenseClass}
                    </span>
                  </div>
                  <button
                    aria-label={t("training.picker.assignCandidate", {
                      name: candidate.fullName,
                    })}
                    className="practice-picker-assign-btn"
                    onClick={(event) => assignCandidate(event, candidate.candidateId)}
                    type="button"
                  >
                    <MebIcon size={16} />
                  </button>
                </div>

                <div className="practice-picker-card-progress">
                  <span>
                    {candidate.completedPracticeHours} / {candidate.targetPracticeHours}
                  </span>
                  <span>{candidate.attemptSlotLabel}</span>
                </div>

                <div className="practice-picker-card-meta">
                  <span>{candidate.groupTitle ?? "—"}</span>
                  <span>
                    {candidate.lastPracticeLessonAt
                      ? t("training.picker.lastLesson", {
                          at: formatDateTime(candidate.lastPracticeLessonAt),
                        })
                      : t("training.picker.noLessonsYet")}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="practice-picker-pagination">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            {t("common.prev")}
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            type="button"
          >
            {t("common.next")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
