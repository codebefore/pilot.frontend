import { useEffect, useMemo, useRef, useState } from "react";

import { useLanguage, useT } from "../../lib/i18n";
import type {
  CandidateFilterState,
  TriState,
} from "../../lib/candidate-filters";
import { getGroups } from "../../lib/groups-api";
import {
  CANDIDATE_GENDER_OPTIONS,
  EXISTING_LICENSE_TYPE_OPTIONS,
} from "../../lib/status-maps";
import { buildGroupHeading, compareTermsDesc } from "../../lib/term-label";
import type {
  CandidateGenderValue,
  GroupResponse,
  LicenseClass,
} from "../../lib/types";
import { useLicenseClassOptions } from "../../lib/use-license-class-options";
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
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const { options: licenseClassOptions } = useLicenseClassOptions();

  // Lazily fetch the group catalog the first time the panel opens so the
  // group filter can resolve ids into readable "{title} · {term}" labels.
  useEffect(() => {
    if (!open || groups.length > 0) return;

    const controller = new AbortController();
    getGroups({ pageSize: 200 }, controller.signal)
      .then((result) => setGroups(result.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGroups([]);
      });

    return () => {
      controller.abort();
    };
  }, [open, groups.length]);

  const groupOptions = useMemo(() => {
    const termsFromGroups = groups.map((group) => group.term);
    const uniqueTerms = Array.from(
      new Map(termsFromGroups.map((term) => [term.id, term])).values()
    ).sort(compareTermsDesc);

    return [...groups]
      .sort((a, b) => {
        const termCompare = compareTermsDesc(a.term, b.term);
        if (termCompare !== 0) return termCompare;
        return a.title.localeCompare(b.title, lang === "tr" ? "tr" : "en");
      })
      .map((group) => ({
        id: group.id,
        label: buildGroupHeading(
          group.title,
          group.term,
          uniqueTerms.length > 0 ? uniqueTerms : [group.term],
          lang === "tr" ? "tr" : "en"
        ),
      }));
  }, [groups, lang]);

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
            <input
              aria-label={t("candidates.filters.firstName")}
              className="form-input"
              onChange={(event) => onChange("firstName", event.target.value)}
              placeholder={t("candidates.filters.firstName")}
              ref={firstInputRef}
              type="text"
              value={filters.firstName}
            />
          </div>
          <div className="form-group">
            <input
              aria-label={t("candidates.filters.lastName")}
              className="form-input"
              onChange={(event) => onChange("lastName", event.target.value)}
              placeholder={t("candidates.filters.lastName")}
              type="text"
              value={filters.lastName}
            />
          </div>
          <div className="form-group">
            <input
              aria-label={t("candidates.col.nationalId")}
              className="form-input"
              inputMode="numeric"
              onChange={(event) => onChange("nationalId", event.target.value)}
              placeholder={t("candidates.col.nationalId")}
              type="text"
              value={filters.nationalId}
            />
          </div>
          <div className="form-group">
            <input
              aria-label={t("candidates.filters.motherName")}
              className="form-input"
              onChange={(event) => onChange("motherName", event.target.value)}
              placeholder={t("candidates.filters.motherName")}
              type="text"
              value={filters.motherName}
            />
          </div>
          <div className="form-group">
            <input
              aria-label={t("candidates.filters.fatherName")}
              className="form-input"
              onChange={(event) => onChange("fatherName", event.target.value)}
              placeholder={t("candidates.filters.fatherName")}
              type="text"
              value={filters.fatherName}
            />
          </div>
          <div className="form-group">
            <input
              aria-label={t("candidates.col.phoneNumber")}
              className="form-input"
              inputMode="tel"
              onChange={(event) => onChange("phoneNumber", event.target.value)}
              placeholder={t("candidates.col.phoneNumber")}
              type="text"
              value={filters.phoneNumber}
            />
          </div>
          <div className="form-group">
            <input
              aria-label={t("candidates.col.email")}
              className="form-input"
              onChange={(event) => onChange("email", event.target.value)}
              placeholder={t("candidates.col.email")}
              type="text"
              value={filters.email}
            />
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.col.licenseClass")}
              className="form-select"
              onChange={(event) =>
                onChange("licenseClass", event.target.value as LicenseClass | "")
              }
              value={filters.licenseClass}
            >
              <option value="">{t("candidates.col.licenseClass")}</option>
              {licenseClassOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.col.gender")}
              className="form-select"
              onChange={(event) =>
                onChange("gender", event.target.value as CandidateGenderValue | "")
              }
              value={filters.gender}
            >
              <option value="">{t("candidates.col.gender")}</option>
              {CANDIDATE_GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.col.group")}
              className="form-select"
              onChange={(event) => onChange("groupId", event.target.value)}
              value={filters.groupId}
            >
              <option value="">{t("candidates.col.group")}</option>
              {groupOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.filters.hasActiveGroup")}
              className="form-select"
              onChange={(event) =>
                onChange("hasActiveGroup", event.target.value as TriState)
              }
              value={filters.hasActiveGroup}
            >
              <option value="">{t("candidates.filters.hasActiveGroup")}</option>
              <option value="true">{t("candidates.filters.yes")}</option>
              <option value="false">{t("candidates.filters.no")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.filters.hasPhoto")}
              className="form-select"
              onChange={(event) =>
                onChange("hasPhoto", event.target.value as TriState)
              }
              value={filters.hasPhoto}
            >
              <option value="">{t("candidates.filters.hasPhoto")}</option>
              <option value="true">{t("candidates.filters.yes")}</option>
              <option value="false">{t("candidates.filters.no")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.filters.hasExamResult")}
              className="form-select"
              onChange={(event) =>
                onChange("hasExamResult", event.target.value as TriState)
              }
              value={filters.hasExamResult}
            >
              <option value="">{t("candidates.filters.hasExamResult")}</option>
              <option value="true">{t("candidates.filters.yes")}</option>
              <option value="false">{t("candidates.filters.no")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.filters.examFeePaid")}
              className="form-select"
              onChange={(event) =>
                onChange("examFeePaid", event.target.value as TriState)
              }
              value={filters.examFeePaid}
            >
              <option value="">{t("candidates.filters.examFeePaid")}</option>
              <option value="true">{t("candidates.examFee.paid")}</option>
              <option value="false">{t("candidates.examFee.unpaid")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.filters.initialPaymentReceived")}
              className="form-select"
              onChange={(event) =>
                onChange("initialPaymentReceived", event.target.value as TriState)
              }
              value={filters.initialPaymentReceived}
            >
              <option value="">{t("candidates.filters.initialPaymentReceived")}</option>
              <option value="true">{t("candidates.filters.yes")}</option>
              <option value="false">{t("candidates.filters.no")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.filters.mebExamResult")}
              className="form-select"
              onChange={(event) =>
                onChange("mebExamResult", event.target.value as "" | "passed" | "failed")
              }
              value={filters.mebExamResult}
            >
              <option value="">{t("candidates.filters.mebExamResult")}</option>
              <option value="passed">{t("candidates.filters.mebExamResultPassed")}</option>
              <option value="failed">{t("candidates.filters.mebExamResultFailed")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.filters.existingLicenseType")}
              className="form-select"
              onChange={(event) => onChange("existingLicenseType", event.target.value)}
              value={filters.existingLicenseType}
            >
              <option value="">{t("candidates.filters.existingLicenseType")}</option>
              {EXISTING_LICENSE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div className="form-group">
            <CustomSelect
              aria-label={t("candidates.filters.hasMissingDocuments")}
              className="form-select"
              onChange={(event) =>
                onChange("hasMissingDocuments", event.target.value as TriState)
              }
              value={filters.hasMissingDocuments}
            >
              <option value="">{t("candidates.filters.hasMissingDocuments")}</option>
              <option value="true">{t("candidates.filters.yes")}</option>
              <option value="false">{t("candidates.filters.no")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.birthDate")} ${t("candidates.filters.rangeFrom")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("birthDateFrom", value)}
              placeholder={`${t("candidates.col.birthDate")} (${t("candidates.filters.rangeFrom")})`}
              value={filters.birthDateFrom}
            />
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.birthDate")} ${t("candidates.filters.rangeTo")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("birthDateTo", value)}
              placeholder={`${t("candidates.col.birthDate")} (${t("candidates.filters.rangeTo")})`}
              value={filters.birthDateTo}
            />
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.filters.mebExamDateRange")} ${t("candidates.filters.rangeFrom")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("mebExamDateFrom", value)}
              placeholder={`${t("candidates.filters.mebExamDateRange")} (${t("candidates.filters.rangeFrom")})`}
              value={filters.mebExamDateFrom}
            />
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.filters.mebExamDateRange")} ${t("candidates.filters.rangeTo")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("mebExamDateTo", value)}
              placeholder={`${t("candidates.filters.mebExamDateRange")} (${t("candidates.filters.rangeTo")})`}
              value={filters.mebExamDateTo}
            />
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.filters.drivingExamDateRange")} ${t("candidates.filters.rangeFrom")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("drivingExamDateFrom", value)}
              placeholder={`${t("candidates.filters.drivingExamDateRange")} (${t("candidates.filters.rangeFrom")})`}
              value={filters.drivingExamDateFrom}
            />
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.filters.drivingExamDateRange")} ${t("candidates.filters.rangeTo")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("drivingExamDateTo", value)}
              placeholder={`${t("candidates.filters.drivingExamDateRange")} (${t("candidates.filters.rangeTo")})`}
              value={filters.drivingExamDateTo}
            />
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.createdAtUtc")} ${t("candidates.filters.rangeFrom")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("createdAtFrom", value)}
              placeholder={`${t("candidates.col.createdAtUtc")} (${t("candidates.filters.rangeFrom")})`}
              value={filters.createdAtFrom}
            />
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.createdAtUtc")} ${t("candidates.filters.rangeTo")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("createdAtTo", value)}
              placeholder={`${t("candidates.col.createdAtUtc")} (${t("candidates.filters.rangeTo")})`}
              value={filters.createdAtTo}
            />
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.updatedAtUtc")} ${t("candidates.filters.rangeFrom")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("updatedAtFrom", value)}
              placeholder={`${t("candidates.col.updatedAtUtc")} (${t("candidates.filters.rangeFrom")})`}
              value={filters.updatedAtFrom}
            />
          </div>
          <div className="form-group">
            <LocalizedDateInput
              ariaLabel={`${t("candidates.col.updatedAtUtc")} ${t("candidates.filters.rangeTo")}`}
              lang={dateInputLang}
              onChange={(value) => onChange("updatedAtTo", value)}
              placeholder={`${t("candidates.col.updatedAtUtc")} (${t("candidates.filters.rangeTo")})`}
              value={filters.updatedAtTo}
            />
          </div>
          <div className="form-group">
            <input
              aria-label={`${t("candidates.col.missingDocuments")} ${t("candidates.filters.min")}`}
              className="form-input"
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                onChange("missingDocumentCountMin", event.target.value)
              }
              placeholder={`${t("candidates.col.missingDocuments")} (${t("candidates.filters.min")})`}
              type="number"
              value={filters.missingDocumentCountMin}
            />
          </div>
          <div className="form-group">
            <input
              aria-label={`${t("candidates.col.missingDocuments")} ${t("candidates.filters.max")}`}
              className="form-input"
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                onChange("missingDocumentCountMax", event.target.value)
              }
              placeholder={`${t("candidates.col.missingDocuments")} (${t("candidates.filters.max")})`}
              type="number"
              value={filters.missingDocumentCountMax}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
