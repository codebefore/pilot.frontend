import { useEffect, useRef, useState } from "react";

import { CheckIcon, PencilIcon, TrashIcon, XIcon } from "../icons";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { LocalizedTimeInput } from "../ui/LocalizedTimeInput";
import {
  formatExamScheduleLicenseClassHeader,
  formatExamScheduleLicenseClassSummary,
} from "../../lib/exam-schedule-summary";
import { useT } from "../../lib/i18n";
import { formatDateTR } from "../../lib/status-maps";
import type { ExamCodeOption, ExamScheduleOption } from "../../lib/types";

type CandidateExamDateSidebarProps = {
  title: string;
  options: ExamScheduleOption[];
  selectedOptionId?: string;
  selectedCode?: string;
  onSelect: (option: ExamScheduleOption | null) => void;
  onCodeSelect?: (code: string) => void;
  onSidebarTabChange?: (tab: "dates" | "codes") => void;
  onDelete?: (option: ExamScheduleOption) => void;
  onEdit?: (option: ExamScheduleOption, date: string, time?: string) => void;
  deletingOptionId?: string | null;
  actions?: { label: string; onClick: () => void; disabled?: boolean; title?: string }[];
  codeOptions?: ExamCodeOption[];
  onCodeAdd?: () => void;
  onCodeDelete?: (option: ExamCodeOption) => void;
  onCodeEdit?: (option: ExamCodeOption, code: string) => void;
  canManageMutations?: boolean;
  deletingCodeId?: string | null;
  editingOptionId?: string | null;
  editingCodeId?: string | null;
  showTime?: boolean;
  showLicenseClassInHeader?: boolean;
  summaryMode?: "capacity" | "candidateCount" | "licenseClass";
};

function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateOnly(): string {
  return toDateOnly(new Date());
}

function getMillisecondsUntilNextDay(): number {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(nextDay.getTime() - now.getTime(), 0);
}

function findTodayDividerDate(
  options: ExamScheduleOption[],
  today: string
): string | null {
  return (
    options
      .map((option) => option.date)
      .filter((date) => date <= today)
      .sort((left, right) => right.localeCompare(left))[0] ?? null
  );
}

export function CandidateExamDateSidebar({
  title,
  options,
  selectedOptionId = "",
  selectedCode = "",
  onSelect,
  onCodeSelect,
  onSidebarTabChange,
  onDelete,
  onEdit,
  deletingOptionId,
  actions = [],
  codeOptions,
  onCodeAdd,
  onCodeDelete,
  onCodeEdit,
  canManageMutations = true,
  deletingCodeId,
  editingOptionId,
  editingCodeId,
  showTime = true,
  showLicenseClassInHeader = false,
  summaryMode = "capacity",
}: CandidateExamDateSidebarProps) {
  const [today, setToday] = useState(getTodayDateOnly);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"dates" | "codes">("dates");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingCodeId, setConfirmingCodeId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState("");
  const [editingTimeValue, setEditingTimeValue] = useState("");
  const [editingCodeLocalId, setEditingCodeLocalId] = useState<string | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState("");
  const [editingCodeError, setEditingCodeError] = useState("");
  const confirmRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let timeoutId = 0;

    const scheduleNextUpdate = () => {
      timeoutId = window.setTimeout(() => {
        setToday(getTodayDateOnly());
        scheduleNextUpdate();
      }, getMillisecondsUntilNextDay());
    };

    scheduleNextUpdate();

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!confirmingId && !confirmingCodeId) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(event.target as Node)) {
        setConfirmingId(null);
        setConfirmingCodeId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmingId(null);
        setConfirmingCodeId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmingCodeId, confirmingId]);

  useEffect(() => {
    if (deletingOptionId === null || deletingOptionId === undefined) {
      return;
    }
    if (confirmingId === deletingOptionId) {
      setConfirmingId(null);
    }
  }, [confirmingId, deletingOptionId]);

  useEffect(() => {
    if (deletingCodeId === null || deletingCodeId === undefined) {
      return;
    }
    if (confirmingCodeId === deletingCodeId) {
      setConfirmingCodeId(null);
    }
  }, [confirmingCodeId, deletingCodeId]);

  useEffect(() => {
    if (editingOptionId === null || editingOptionId === undefined) {
      return;
    }
    if (editingDateId === editingOptionId) {
      setEditingDateId(null);
    }
  }, [editingDateId, editingOptionId]);

  useEffect(() => {
    if (editingCodeId === null || editingCodeId === undefined) {
      return;
    }
    if (editingCodeLocalId === editingCodeId) {
      setEditingCodeLocalId(null);
    }
  }, [editingCodeId, editingCodeLocalId]);

  const t = useT();
  const todayDividerDate = findTodayDividerDate(options, today);
  const todayDividerOptionId = todayDividerDate
    ? options.find((option) => option.date === todayDividerDate)?.id ?? null
    : null;
  const showCodeTab = codeOptions !== undefined && onCodeSelect !== undefined;
  const noPermissionTitle = t("common.noPermission");
  const startDateEdit = (option: ExamScheduleOption) => {
    if (!canManageMutations) return;
    setConfirmingId(null);
    setEditingDateId(option.id);
    setEditingDateValue(option.date);
    setEditingTimeValue(option.time);
  };
  const submitDateEdit = (option: ExamScheduleOption) => {
    if (!canManageMutations) return;
    const trimmedTime = editingTimeValue.trim();
    const nextTime = showTime ? trimmedTime : undefined;
    const dateUnchanged = editingDateValue === option.date;
    const timeUnchanged = !showTime || nextTime === option.time;
    if (!editingDateValue || (dateUnchanged && timeUnchanged)) {
      setEditingDateId(null);
      return;
    }
    onEdit?.(option, editingDateValue, nextTime);
  };
  const startCodeEdit = (option: ExamCodeOption) => {
    if (!canManageMutations) return;
    setConfirmingCodeId(null);
    setEditingCodeLocalId(option.id);
    setEditingCodeValue(option.code);
    setEditingCodeError("");
  };
  const submitCodeEdit = (option: ExamCodeOption) => {
    if (!canManageMutations) return;
    const cleaned = editingCodeValue.replace(/\D/g, "").slice(0, 9);
    if (cleaned.length !== 9) {
      setEditingCodeError(t("examDateSidebar.error.codeLength"));
      return;
    }
    if (cleaned === option.code) {
      setEditingCodeLocalId(null);
      setEditingCodeError("");
      return;
    }
    onCodeEdit?.(option, cleaned);
  };

  return (
    <div aria-label={title} className="exam-date-sidebar-list" role="complementary">
      {showCodeTab ? (
        <div className="exam-date-sidebar-tabs" role="tablist" aria-label={t("examDateSidebar.aria.practiceFilters")}>
          <button
            aria-selected={activeSidebarTab === "dates"}
            className={activeSidebarTab === "dates" ? "exam-date-sidebar-tab active" : "exam-date-sidebar-tab"}
            onClick={() => {
              setActiveSidebarTab("dates");
              onSidebarTabChange?.("dates");
            }}
            role="tab"
            type="button"
          >
            Sınav Tarihleri
          </button>
          <button
            aria-selected={activeSidebarTab === "codes"}
            className={activeSidebarTab === "codes" ? "exam-date-sidebar-tab active" : "exam-date-sidebar-tab"}
            onClick={() => {
              setActiveSidebarTab("codes");
              onSidebarTabChange?.("codes");
            }}
            role="tab"
            type="button"
          >
            Sınav Kodları
          </button>
        </div>
      ) : null}
      {activeSidebarTab === "codes" && showCodeTab ? (
        <>
          {onCodeAdd ? (
            <div className="exam-date-sidebar-actions" role="toolbar" aria-label={t("examDateSidebar.aria.codeActions")}>
              <button
                className="btn btn-secondary btn-sm exam-date-sidebar-action"
                disabled={!canManageMutations}
                onClick={onCodeAdd}
                title={!canManageMutations ? noPermissionTitle : undefined}
                type="button"
              >
                Sınav Kodu Ekle
              </button>
            </div>
          ) : null}
          {codeOptions.map((option) => {
            const isDeleting = deletingCodeId === option.id;
            const isEditing = editingCodeLocalId === option.id;
            const canDelete = option.scheduleCount === 0 && option.candidateCount === 0;
            return (
              <div className="exam-date-option-shell" key={option.id}>
                {isEditing ? (
                  <div className="exam-code-option exam-date-option-edit">
                    <input
                      autoFocus
                      className="exam-date-option-edit-input"
                      disabled={!canManageMutations}
                      inputMode="numeric"
                      maxLength={9}
                      onChange={(event) => {
                        setEditingCodeValue(event.currentTarget.value.replace(/\D/g, "").slice(0, 9));
                        setEditingCodeError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitCodeEdit(option);
                        if (event.key === "Escape") {
                          setEditingCodeLocalId(null);
                          setEditingCodeError("");
                        }
                      }}
                      aria-invalid={editingCodeError ? "true" : undefined}
                      value={editingCodeValue}
                    />
                    {editingCodeError ? (
                      <span className="exam-date-option-edit-error" role="alert">
                        {editingCodeError}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <button
                    aria-pressed={selectedCode === option.code}
                    className={selectedCode === option.code ? "exam-code-option active" : "exam-code-option"}
                    onClick={() => onCodeSelect(selectedCode === option.code ? "" : option.code)}
                    type="button"
                  >
                    <span className="exam-date-option-head">
                      <span className="exam-date-option-date">{option.code}</span>
                    </span>
                    <span className="exam-date-option-meta">
                      {option.scheduleCount} tarih · {option.candidateCount} aday
                    </span>
                  </button>
                )}
                {isEditing ? (
                  <div className="exam-date-option-actions visible">
                    <button
                      aria-label={t("examDateSidebar.aria.saveCode")}
                      className="exam-date-option-action"
                      disabled={editingCodeId === option.id || !canManageMutations}
                      onClick={() => submitCodeEdit(option)}
                      title={!canManageMutations ? noPermissionTitle : undefined}
                      type="button"
                    >
                      <CheckIcon size={14} />
                    </button>
                    <button
                      aria-label={t("examDateSidebar.aria.cancelEdit")}
                      className="exam-date-option-action"
                      disabled={editingCodeId === option.id}
                      onClick={() => {
                        setEditingCodeLocalId(null);
                        setEditingCodeError("");
                      }}
                      type="button"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="exam-date-option-actions">
                    {onCodeEdit ? (
                      <button
                        aria-label={t("examDateSidebar.aria.editCode")}
                        className="exam-date-option-action"
                        disabled={editingCodeId === option.id || !canManageMutations}
                        onClick={(event) => {
                          event.stopPropagation();
                          startCodeEdit(option);
                        }}
                        title={!canManageMutations ? noPermissionTitle : t("common.edit")}
                        type="button"
                      >
                        <PencilIcon size={14} />
                      </button>
                    ) : null}
                    {onCodeDelete ? (
                      <button
                        aria-label={t("examDateSidebar.aria.deleteCode")}
                        className="exam-date-option-action danger"
                        disabled={!canManageMutations || !canDelete || isDeleting}
                        onClick={(event) => {
                          if (!canManageMutations) return;
                          event.stopPropagation();
                          setConfirmingCodeId((current) => (current === option.id ? null : option.id));
                        }}
                        title={
                          !canManageMutations
                            ? noPermissionTitle
                            : !canDelete
                              ? t("examDateSidebar.error.codeInUse")
                              : "Sil"
                        }
                        type="button"
                      >
                        <TrashIcon size={14} />
                      </button>
                    ) : null}
                  </div>
                )}
                {onCodeDelete && confirmingCodeId === option.id ? (
                  <div className="exam-date-option-confirm" ref={confirmRef} role="dialog">
                    <span className="exam-date-option-confirm-label">Bu kodu sil?</span>
                    <div className="exam-date-option-confirm-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={isDeleting}
                        onClick={() => setConfirmingCodeId(null)}
                        type="button"
                      >
                        Vazgeç
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={isDeleting || !canManageMutations}
                        onClick={() => {
                          if (!canManageMutations) return;
                          onCodeDelete(option);
                        }}
                        title={!canManageMutations ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {isDeleting ? "Siliniyor…" : "Sil"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </>
      ) : (
        <>
      {actions.length > 0 ? (
        <div aria-label={`${title} aksiyonları`} className="exam-date-sidebar-actions" role="toolbar">
          {actions.map((action) => (
            <button
              className="btn btn-secondary btn-sm exam-date-sidebar-action"
              disabled={action.disabled}
              key={action.label}
              onClick={action.onClick}
              title={action.title}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {options.map((option) => {
        const isDeleting = deletingOptionId === option.id;
        const isEditing = editingDateId === option.id;
        const licenseClassHeader = showLicenseClassInHeader
          ? formatExamScheduleLicenseClassHeader(option)
          : "";
        return (
          <div className="exam-date-option-group" key={option.id}>
            {option.id === todayDividerOptionId ? (
              <div aria-hidden="true" className="exam-date-divider" data-testid="exam-date-divider" />
            ) : null}
            <div className="exam-date-option-shell">
              {isEditing ? (
                <div className="exam-date-option exam-date-option-edit">
                  <div className="exam-date-option-edit-fields">
                    <LocalizedDateInput
                      ariaLabel={t("examDateSidebar.aria.examDate")}
                      className="exam-date-option-edit-trigger"
                      defaultOnOpen={option.date}
                      disabled={!canManageMutations}
                      lang="tr-TR"
                      onChange={setEditingDateValue}
                      size="sm"
                      value={editingDateValue}
                    />
                    {showTime ? (
                      <LocalizedTimeInput
                        ariaLabel="Sınav saati"
                        className="exam-date-option-edit-trigger exam-date-option-edit-time-trigger"
                        disabled={!canManageMutations}
                        onChange={setEditingTimeValue}
                        size="sm"
                        value={editingTimeValue}
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <button
                  aria-pressed={selectedOptionId === option.id}
                  className={selectedOptionId === option.id ? "exam-date-option active" : "exam-date-option"}
                  onClick={() => onSelect(selectedOptionId === option.id ? null : option)}
                  type="button"
                >
                  <span className="exam-date-option-head">
                    <span className="exam-date-option-date">{formatDateTR(option.date)}</span>
                    {licenseClassHeader ? (
                      <span className="exam-date-option-license">{licenseClassHeader}</span>
                    ) : null}
                    {showTime && option.time ? (
                      <span className="exam-date-option-time">{option.time}</span>
                    ) : null}
                  </span>
                  <span className="exam-date-option-meta">
                    {summaryMode === "licenseClass"
                      ? formatExamScheduleLicenseClassSummary(option)
                      : summaryMode === "candidateCount"
                        ? `${option.candidateCount} aday`
                        : `${option.candidateCount}/${option.capacity}`}
                  </span>
                </button>
              )}
              {isEditing ? (
                <div className="exam-date-option-actions visible">
                  <button
                    aria-label={`${formatDateTR(option.date)} sınav tarihini kaydet`}
                    className="exam-date-option-action"
                    disabled={editingOptionId === option.id || !canManageMutations}
                    onClick={() => submitDateEdit(option)}
                    title={!canManageMutations ? noPermissionTitle : undefined}
                    type="button"
                  >
                    <CheckIcon size={14} />
                  </button>
                  <button
                    aria-label={t("examDateSidebar.aria.cancelEdit")}
                    className="exam-date-option-action"
                    disabled={editingOptionId === option.id}
                    onClick={() => setEditingDateId(null)}
                    type="button"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              ) : (
                <div className="exam-date-option-actions">
                  {onEdit ? (
                    <button
                      aria-label={`${formatDateTR(option.date)} sınav tarihini düzenle`}
                      className="exam-date-option-action"
                      disabled={editingOptionId === option.id || !canManageMutations}
                      onClick={(event) => {
                        event.stopPropagation();
                        startDateEdit(option);
                      }}
                      title={!canManageMutations ? noPermissionTitle : t("common.edit")}
                      type="button"
                    >
                      <PencilIcon size={14} />
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      aria-label={`${formatDateTR(option.date)} sınav tarihini sil`}
                      className="exam-date-option-action danger"
                      disabled={isDeleting || !canManageMutations}
                      onClick={(event) => {
                        if (!canManageMutations) return;
                        event.stopPropagation();
                        setConfirmingId((current) => (current === option.id ? null : option.id));
                      }}
                      title={!canManageMutations ? noPermissionTitle : "Sil"}
                      type="button"
                    >
                      <TrashIcon size={14} />
                    </button>
                  ) : null}
                </div>
              )}
              {onDelete && confirmingId === option.id ? (
                <div className="exam-date-option-confirm" ref={confirmRef} role="dialog">
                  <span className="exam-date-option-confirm-label">Bu tarihi sil?</span>
                  <div className="exam-date-option-confirm-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={isDeleting}
                      onClick={() => setConfirmingId(null)}
                      type="button"
                    >
                      Vazgeç
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={isDeleting || !canManageMutations}
                      onClick={() => {
                        if (!canManageMutations) return;
                        onDelete(option);
                      }}
                      title={!canManageMutations ? noPermissionTitle : undefined}
                      type="button"
                    >
                      {isDeleting ? "Siliniyor…" : "Sil"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
        </>
      )}
    </div>
  );
}
