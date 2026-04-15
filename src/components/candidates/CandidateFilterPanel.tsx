import { useEffect, useRef } from "react";

import { useLanguage, useT } from "../../lib/i18n";
import type {
  CandidateFilterState,
  TriState,
} from "../../lib/candidate-filters";
import {
  CANDIDATE_GENDER_OPTIONS,
  LICENSE_CLASS_OPTIONS,
} from "../../lib/status-maps";
import type { CandidateGenderValue, LicenseClass } from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";

export type CandidateFilterPanelProps = {
  open: boolean;
  filters: CandidateFilterState;
  activeFilterCount: number;
  /**
   * True when any filter (form or tag) is active; drives the "Filtreleri
   * Temizle" button visibility inside the panel.
   */
  hasAnyActiveFilter: boolean;
  onClose: () => void;
  onChange: <K extends keyof CandidateFilterState>(
    key: K,
    value: CandidateFilterState[K]
  ) => void;
  onClearAll: () => void;
};

/**
 * Collapsible sidebar filter panel for the Candidates page. Renders as a
 * fixed-position overlay on top of the main left sidebar (same slot, same
 * width) so the main content area is not pushed around when opened.
 *
 * Pure controlled component — owns no filter state, just dispatches changes
 * back through `onChange`. Internally handles ESC-to-close and auto-focus
 * onto the first input when the panel opens.
 */
export function CandidateFilterPanel({
  open,
  filters,
  activeFilterCount,
  hasAnyActiveFilter,
  onClose,
  onChange,
  onClearAll,
}: CandidateFilterPanelProps) {
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  // Focus only on the closed -> open transition. The parent rerenders on each
  // filter keystroke, so tying focus to every render would steal focus back to
  // the first field while the user is typing elsewhere.
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!justOpened) return;

    const focusTimer = window.setTimeout(() => {
      firstInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  // Wire an ESC handler while the panel is open — consistent with
  // Modal/Drawer close-on-escape UX.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="cand-filters-backdrop"
        onClick={onClose}
      />
      <aside
        aria-label={t("candidates.filters.button")}
        className="cand-filters-panel"
        id="cand-filters-panel"
      >
        <div className="cand-filters-panel-header">
          <span className="cand-filters-panel-title">
            {t("candidates.filters.button")}
            {activeFilterCount > 0 && (
              <span className="cand-filters-badge">{activeFilterCount}</span>
            )}
          </span>
          <button
            aria-label={t("common.close")}
            className="cand-filters-panel-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {hasAnyActiveFilter && (
          <div className="cand-filters-panel-actions">
            <button
              className="btn btn-secondary btn-sm cand-filters-clear"
              onClick={onClearAll}
              type="button"
            >
              {t("candidates.filters.clear")}
            </button>
          </div>
        )}
        <div className="cand-filters-grid">
          <div className="form-group">
            <label className="form-label">{t("candidates.filters.firstName")}</label>
            <input
              className="form-input"
              onChange={(event) => onChange("firstName", event.target.value)}
              ref={firstInputRef}
              type="text"
              value={filters.firstName}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.filters.lastName")}</label>
            <input
              className="form-input"
              onChange={(event) => onChange("lastName", event.target.value)}
              type="text"
              value={filters.lastName}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.col.nationalId")}</label>
            <input
              className="form-input"
              inputMode="numeric"
              onChange={(event) => onChange("nationalId", event.target.value)}
              type="text"
              value={filters.nationalId}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.col.phoneNumber")}</label>
            <input
              className="form-input"
              inputMode="tel"
              onChange={(event) => onChange("phoneNumber", event.target.value)}
              type="text"
              value={filters.phoneNumber}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.col.email")}</label>
            <input
              className="form-input"
              onChange={(event) => onChange("email", event.target.value)}
              type="text"
              value={filters.email}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.col.licenseClass")}</label>
            <CustomSelect
              aria-label={t("candidates.col.licenseClass")}
              className="form-select"
              onChange={(event) =>
                onChange("licenseClass", event.target.value as LicenseClass | "")
              }
              value={filters.licenseClass}
            >
              <option value="">{t("common.all")}</option>
              {LICENSE_CLASS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.col.gender")}</label>
            <CustomSelect
              aria-label={t("candidates.col.gender")}
              className="form-select"
              onChange={(event) =>
                onChange("gender", event.target.value as CandidateGenderValue | "")
              }
              value={filters.gender}
            >
              <option value="">{t("common.all")}</option>
              {CANDIDATE_GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.col.group")}</label>
            <input
              className="form-input"
              onChange={(event) => onChange("groupTitle", event.target.value)}
              placeholder={t("candidates.filters.groupPlaceholder")}
              type="text"
              value={filters.groupTitle}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.filters.hasActiveGroup")}</label>
            <CustomSelect
              aria-label={t("candidates.filters.hasActiveGroup")}
              className="form-select"
              onChange={(event) =>
                onChange("hasActiveGroup", event.target.value as TriState)
              }
              value={filters.hasActiveGroup}
            >
              <option value="">{t("common.all")}</option>
              <option value="true">{t("candidates.filters.yes")}</option>
              <option value="false">{t("candidates.filters.no")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.filters.hasPhoto")}</label>
            <CustomSelect
              aria-label={t("candidates.filters.hasPhoto")}
              className="form-select"
              onChange={(event) =>
                onChange("hasPhoto", event.target.value as TriState)
              }
              value={filters.hasPhoto}
            >
              <option value="">{t("common.all")}</option>
              <option value="true">{t("candidates.filters.yes")}</option>
              <option value="false">{t("candidates.filters.no")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.filters.hasMebExamResult")}</label>
            <CustomSelect
              aria-label={t("candidates.filters.hasMebExamResult")}
              className="form-select"
              onChange={(event) =>
                onChange("hasMebExamResult", event.target.value as TriState)
              }
              value={filters.hasMebExamResult}
            >
              <option value="">{t("common.all")}</option>
              <option value="true">{t("candidates.filters.yes")}</option>
              <option value="false">{t("candidates.filters.no")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.filters.examFeePaid")}</label>
            <CustomSelect
              aria-label={t("candidates.filters.examFeePaid")}
              className="form-select"
              onChange={(event) =>
                onChange("examFeePaid", event.target.value as TriState)
              }
              value={filters.examFeePaid}
            >
              <option value="">{t("common.all")}</option>
              <option value="true">{t("candidates.examFee.paid")}</option>
              <option value="false">{t("candidates.examFee.unpaid")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">{t("candidates.filters.hasMissingDocuments")}</label>
            <CustomSelect
              aria-label={t("candidates.filters.hasMissingDocuments")}
              className="form-select"
              onChange={(event) =>
                onChange("hasMissingDocuments", event.target.value as TriState)
              }
              value={filters.hasMissingDocuments}
            >
              <option value="">{t("common.all")}</option>
              <option value="true">{t("candidates.filters.yes")}</option>
              <option value="false">{t("candidates.filters.no")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("candidates.col.birthDate")} ({t("candidates.filters.rangeFrom")})
            </label>
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.birthDate")} ${t("candidates.filters.rangeFrom")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("birthDateFrom", value)}
              value={filters.birthDateFrom}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("candidates.col.birthDate")} ({t("candidates.filters.rangeTo")})
            </label>
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.birthDate")} ${t("candidates.filters.rangeTo")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("birthDateTo", value)}
              value={filters.birthDateTo}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("candidates.col.createdAtUtc")} ({t("candidates.filters.rangeFrom")})
            </label>
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.createdAtUtc")} ${t("candidates.filters.rangeFrom")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("createdAtFrom", value)}
              value={filters.createdAtFrom}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("candidates.col.createdAtUtc")} ({t("candidates.filters.rangeTo")})
            </label>
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.createdAtUtc")} ${t("candidates.filters.rangeTo")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("createdAtTo", value)}
              value={filters.createdAtTo}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("candidates.col.updatedAtUtc")} ({t("candidates.filters.rangeFrom")})
            </label>
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.updatedAtUtc")} ${t("candidates.filters.rangeFrom")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("updatedAtFrom", value)}
              value={filters.updatedAtFrom}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("candidates.col.updatedAtUtc")} ({t("candidates.filters.rangeTo")})
            </label>
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.updatedAtUtc")} ${t("candidates.filters.rangeTo")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("updatedAtTo", value)}
              value={filters.updatedAtTo}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("candidates.col.missingDocuments")} ({t("candidates.filters.min")})
            </label>
            <input
              className="form-input"
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                onChange("missingDocumentCountMin", event.target.value)
              }
              type="number"
              value={filters.missingDocumentCountMin}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("candidates.col.missingDocuments")} ({t("candidates.filters.max")})
            </label>
            <input
              className="form-input"
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                onChange("missingDocumentCountMax", event.target.value)
              }
              type="number"
              value={filters.missingDocumentCountMax}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
