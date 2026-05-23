import { useEffect, useRef, useState } from "react";

import { CheckIcon, PencilIcon, TrashIcon, XIcon } from "../icons";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { formatExamScheduleLicenseClassSummary } from "../../lib/exam-schedule-summary";
import { formatDateTR } from "../../lib/status-maps";
import type { ExamCodeOption, ExamScheduleOption } from "../../lib/types";

type CandidateExamDateSidebarProps = {
  title: string;
  options: ExamScheduleOption[];
  selectedDate: string;
  selectedCode?: string;
  onSelect: (date: string) => void;
  onCodeSelect?: (code: string) => void;
  onSidebarTabChange?: (tab: "dates" | "codes") => void;
  onDelete?: (option: ExamScheduleOption) => void;
  onEdit?: (option: ExamScheduleOption, date: string) => void;
  deletingOptionId?: string | null;
  actions?: { label: string; onClick: () => void; disabled?: boolean }[];
  codeOptions?: ExamCodeOption[];
  onCodeAdd?: () => void;
  onCodeDelete?: (option: ExamCodeOption) => void;
  onCodeEdit?: (option: ExamCodeOption, code: string) => void;
  deletingCodeId?: string | null;
  editingOptionId?: string | null;
  editingCodeId?: string | null;
  showTime?: boolean;
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
  selectedDate,
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
  deletingCodeId,
  editingOptionId,
  editingCodeId,
  showTime = true,
  summaryMode = "capacity",
}: CandidateExamDateSidebarProps) {
  const [today, setToday] = useState(getTodayDateOnly);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"dates" | "codes">("dates");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingCodeId, setConfirmingCodeId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState("");
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

  const todayDividerDate = findTodayDividerDate(options, today);
  const showCodeTab = codeOptions !== undefined && onCodeSelect !== undefined;
  const startDateEdit = (option: ExamScheduleOption) => {
    setConfirmingId(null);
    setEditingDateId(option.id);
    setEditingDateValue(option.date);
  };
  const submitDateEdit = (option: ExamScheduleOption) => {
    if (!editingDateValue || editingDateValue === option.date) {
      setEditingDateId(null);
      return;
    }
    onEdit?.(option, editingDateValue);
  };
  const startCodeEdit = (option: ExamCodeOption) => {
    setConfirmingCodeId(null);
    setEditingCodeLocalId(option.id);
    setEditingCodeValue(option.code);
    setEditingCodeError("");
  };
  const submitCodeEdit = (option: ExamCodeOption) => {
    const cleaned = editingCodeValue.replace(/\D/g, "").slice(0, 9);
    if (cleaned.length !== 9) {
      setEditingCodeError("Sınav kodu 9 hane olmalı.");
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
        <div className="exam-date-sidebar-tabs" role="tablist" aria-label="Direksiyon sınavı filtreleri">
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
            <div className="exam-date-sidebar-actions" role="toolbar" aria-label="Sınav kodu aksiyonları">
              <button
                className="btn btn-secondary btn-sm exam-date-sidebar-action"
                onClick={onCodeAdd}
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
                      aria-label="Sınav kodunu kaydet"
                      className="exam-date-option-action"
                      disabled={editingCodeId === option.id}
                      onClick={() => submitCodeEdit(option)}
                      type="button"
                    >
                      <CheckIcon size={14} />
                    </button>
                    <button
                      aria-label="Düzenlemeyi iptal et"
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
                        aria-label="Sınav kodunu düzenle"
                        className="exam-date-option-action"
                        disabled={editingCodeId === option.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          startCodeEdit(option);
                        }}
                        title="Düzenle"
                        type="button"
                      >
                        <PencilIcon size={14} />
                      </button>
                    ) : null}
                    {onCodeDelete ? (
                      <button
                        aria-label="Sınav kodunu sil"
                        className="exam-date-option-action danger"
                        disabled={!canDelete || isDeleting}
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmingCodeId((current) => (current === option.id ? null : option.id));
                        }}
                        title={!canDelete ? "Bağlı sınav tarihi veya aday olduğu için silinemez." : "Sil"}
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
                        disabled={isDeleting}
                        onClick={() => onCodeDelete(option)}
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
        return (
          <div className="exam-date-option-group" key={option.id}>
            {option.date === todayDividerDate ? (
              <div aria-hidden="true" className="exam-date-divider" data-testid="exam-date-divider" />
            ) : null}
            <div className="exam-date-option-shell">
              {isEditing ? (
                <div className="exam-date-option exam-date-option-edit">
                  <LocalizedDateInput
                    ariaLabel="Sınav tarihi"
                    className="exam-date-option-edit-input"
                    defaultOnOpen={option.date}
                    lang="tr-TR"
                    onChange={setEditingDateValue}
                    size="sm"
                    value={editingDateValue}
                  />
                </div>
              ) : (
                <button
                  aria-pressed={selectedDate === option.date}
                  className={selectedDate === option.date ? "exam-date-option active" : "exam-date-option"}
                  onClick={() => onSelect(selectedDate === option.date ? "" : option.date)}
                  type="button"
                >
                  <span className="exam-date-option-head">
                    <span className="exam-date-option-date">{formatDateTR(option.date)}</span>
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
                    disabled={editingOptionId === option.id}
                    onClick={() => submitDateEdit(option)}
                    type="button"
                  >
                    <CheckIcon size={14} />
                  </button>
                  <button
                    aria-label="Düzenlemeyi iptal et"
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
                      disabled={editingOptionId === option.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        startDateEdit(option);
                      }}
                      type="button"
                    >
                      <PencilIcon size={14} />
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      aria-label={`${formatDateTR(option.date)} sınav tarihini sil`}
                      className="exam-date-option-action danger"
                      disabled={isDeleting}
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmingId((current) => (current === option.id ? null : option.id));
                      }}
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
                      disabled={isDeleting}
                      onClick={() => onDelete(option)}
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
