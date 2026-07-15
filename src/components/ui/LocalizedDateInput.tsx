import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FocusEventHandler,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

import { CalendarIcon } from "../icons";
import { useLanguage } from "../../lib/i18n";
import { useAnchoredPopover } from "./useAnchoredPopover";

type LocalizedDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  defaultOnOpen?: string;
  disabled?: boolean;
  id?: string;
  lang?: string;
  /** "day" shows a day grid, "month" shows a 12-month grid, "year" shows a year grid and snaps value to Jan 1 of the selected year. */
  mode?: "day" | "month" | "year";
  name?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  size?: "md" | "sm";
  inputRef?: Ref<HTMLInputElement>;
};

type CalendarCell =
  | { key: string; kind: "empty" }
  | { key: string; kind: "day"; iso: string; label: number; isSelected: boolean; isToday: boolean };

type MonthCell = {
  key: string;
  iso: string;
  label: string;
  isSelected: boolean;
  isCurrent: boolean;
};

function normalizeLocale(lang?: string): "tr-TR" | "en-US" {
  return lang?.toLocaleLowerCase("en-US").startsWith("en") ? "en-US" : "tr-TR";
}

function todayISO(): string {
  const date = new Date();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const parts = value.slice(0, 10).split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function weekdayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function formatLocalizedDate(value: string): string {
  const parts = value.slice(0, 10).split("-");
  if (parts.length !== 3) return value;

  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
}

function formatLocalizedMonth(value: string, lang?: string): string {
  const date = parseIsoDate(value);
  if (!date) return "";
  const locale = lang === "tr-TR" ? "tr-TR" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatLocalizedYear(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return "";
  return String(date.getUTCFullYear());
}

function defaultPlaceholder(lang?: string, mode: "day" | "month" | "year" = "day"): string {
  if (mode === "year") {
    return lang === "tr-TR" ? "yyyy" : "yyyy";
  }
  if (mode === "month") {
    return lang === "tr-TR" ? "aa/yyyy" : "mmm yyyy";
  }
  return "gg.aa.yyyy";
}

function weekdayLabels(lang?: string): string[] {
  return lang === "tr-TR"
    ? ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

function monthLabel(date: Date, lang?: string): string {
  const locale = lang === "tr-TR" ? "tr-TR" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function shortMonthNames(lang?: string): string[] {
  const locale = lang === "tr-TR" ? "tr-TR" : "en-US";
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  });
  return Array.from({ length: 12 }, (_, i) =>
    formatter.format(new Date(Date.UTC(2000, i, 1)))
  );
}

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), 1));
}

export function LocalizedDateInput({
  value,
  onChange,
  ariaLabel,
  className,
  defaultOnOpen,
  disabled = false,
  id,
  lang,
  mode = "day",
  name,
  onBlur,
  placeholder,
  size = "md",
  inputRef,
}: LocalizedDateInputProps) {
  const { lang: activeLanguage } = useLanguage();
  const effectiveLang = normalizeLocale(lang ?? activeLanguage);
  const isMonthMode = mode === "month";
  const isYearMode = mode === "year";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const { popoverRef, popoverStyle } = useAnchoredPopover({
    anchorRef: rootRef,
    fallbackWidth: 296,
    open,
    preferredMaxHeight: 420,
  });
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const baseDate = parseIsoDate(value) ?? parseIsoDate(defaultOnOpen) ?? parseIsoDate(todayISO())!;
    return monthStart(baseDate);
  });
  const initialView: "day" | "month" | "year" = isYearMode ? "year" : isMonthMode ? "month" : "day";
  const [view, setView] = useState<"day" | "month" | "year">(initialView);
  const [typedValue, setTypedValue] = useState<string | null>(null);

  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const selectedMonth = useMemo(
    () => monthStart(selectedDate ?? parseIsoDate(defaultOnOpen) ?? parseIsoDate(todayISO())!),
    [defaultOnOpen, selectedDate]
  );
  const today = todayISO();
  const weekdayNames = useMemo(() => weekdayLabels(effectiveLang), [effectiveLang]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setVisibleMonth(selectedMonth);
    setView(initialView);
  }, [open, selectedMonth, initialView]);

  const assignInputRef = (node: HTMLInputElement | null) => {
    hiddenInputRef.current = node;

    if (!inputRef) return;
    if (typeof inputRef === "function") {
      inputRef(node);
      return;
    }

    inputRef.current = node;
  };

  const notifyBlur = () => {
    if (!onBlur || !hiddenInputRef.current) return;

    onBlur({
      target: hiddenInputRef.current,
      currentTarget: hiddenInputRef.current,
    } as unknown as FocusEvent<HTMLInputElement>);
  };

  const openCalendar = () => {
    if (disabled) return;

    if (!value && defaultOnOpen) {
      onChange(defaultOnOpen);
      setVisibleMonth(monthStart(parseIsoDate(defaultOnOpen)!));
    } else {
      setVisibleMonth(selectedMonth);
    }

    setOpen(true);
  };

  const commitDate = (iso: string) => {
    onChange(iso);
    setTypedValue(null);
    setOpen(false);
    notifyBlur();
  };

  const selectDayCell = (iso: string) => {
    commitDate(iso);
  };

  const selectMonthCell = (iso: string) => {
    if (isMonthMode) {
      commitDate(iso);
      return;
    }
    const parsed = parseIsoDate(iso);
    if (parsed) setVisibleMonth(monthStart(parsed));
    setView("day");
  };

  const selectYearCell = (iso: string) => {
    if (isYearMode) {
      commitDate(iso);
      return;
    }
    const parsed = parseIsoDate(iso);
    if (parsed) {
      setVisibleMonth(new Date(Date.UTC(parsed.getUTCFullYear(), visibleMonth.getUTCMonth(), 1)));
    }
    setView(isMonthMode ? "month" : "month");
  };

  const onHiddenInputChange = (nextValue: string) => {
    onChange(nextValue);
    notifyBlur();
  };

  const cells = useMemo<CalendarCell[]>(() => {
    const items: CalendarCell[] = [];
    const firstDay = weekdayIndex(visibleMonth);
    const totalDays = daysInMonth(visibleMonth);

    for (let index = 0; index < firstDay; index += 1) {
      items.push({ key: `empty-${index}`, kind: "empty" });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), day));
      const iso = toIsoDate(date);
      items.push({
        key: iso,
        kind: "day",
        iso,
        label: day,
        isSelected: value === iso,
        isToday: today === iso,
      });
    }

    while (items.length % 7 !== 0) {
      items.push({ key: `empty-tail-${items.length}`, kind: "empty" });
    }

    return items;
  }, [today, value, visibleMonth]);

  const monthNames = useMemo(() => shortMonthNames(effectiveLang), [effectiveLang]);
  const monthCells = useMemo<MonthCell[]>(() => {
    const selectedMonthIso = value ? `${value.slice(0, 7)}-01` : "";
    const currentMonthIso = `${today.slice(0, 7)}-01`;
    const year = visibleMonth.getUTCFullYear();
    return monthNames.map((label, i) => {
      const iso = toIsoDate(new Date(Date.UTC(year, i, 1)));
      return {
        key: iso,
        iso,
        label,
        isSelected: iso === selectedMonthIso,
        isCurrent: iso === currentMonthIso,
      };
    });
  }, [monthNames, today, value, visibleMonth]);
  const yearCells = useMemo<MonthCell[]>(() => {
    const selectedYearIso = value ? `${value.slice(0, 4)}-01-01` : "";
    const currentYearIso = `${today.slice(0, 4)}-01-01`;
    const startYear = visibleMonth.getUTCFullYear() - 5;
    return Array.from({ length: 12 }, (_, index) => {
      const year = startYear + index;
      const iso = toIsoDate(new Date(Date.UTC(year, 0, 1)));
      return {
        key: iso,
        iso,
        label: String(year),
        isSelected: iso === selectedYearIso,
        isCurrent: iso === currentYearIso,
      };
    });
  }, [today, value, visibleMonth]);

  const parseTypedToIso = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return "";

    if (isYearMode) {
      if (!/^\d{4}$/.test(trimmed)) return null;
      const year = Number(trimmed);
      if (year < 1900 || year > 2999) return null;
      return `${trimmed}-01-01`;
    }

    if (isMonthMode) {
      const m = effectiveLang === "tr-TR"
        ? trimmed.match(/^(\d{1,2})[./-](\d{4})$/)
        : trimmed.match(/^(\d{1,2})[./-](\d{4})$/) || trimmed.match(/^(\d{4})[./-](\d{1,2})$/);
      if (!m) return null;
      let year: number;
      let month: number;
      if (effectiveLang === "tr-TR") {
        month = Number(m[1]);
        year = Number(m[2]);
      } else if (m[1].length === 4) {
        year = Number(m[1]);
        month = Number(m[2]);
      } else {
        month = Number(m[1]);
        year = Number(m[2]);
      }
      if (month < 1 || month > 12 || year < 1900 || year > 2999) return null;
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
    }

    const compactDayMatch = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
    const m =
      compactDayMatch ??
      trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/) ??
      trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
    if (!m) return null;
    let year: number;
    let month: number;
    let day: number;
    if (m[1].length === 4) {
      year = Number(m[1]);
      month = Number(m[2]);
      day = Number(m[3]);
    } else {
      day = Number(m[1]);
      month = Number(m[2]);
      year = Number(m[3]);
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2999) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return toIsoDate(date);
  };

  const handleTriggerInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setTypedValue(raw);
    const iso = parseTypedToIso(raw);
    if (iso === "") {
      onChange("");
      return;
    }
    if (iso) {
      onChange(iso);
      if (!isMonthMode && !isYearMode) {
        setTypedValue(formatLocalizedDate(iso));
      }
      const parsed = parseIsoDate(iso);
      if (parsed) setVisibleMonth(monthStart(parsed));
    }
  };

  const handleTriggerInputBlur = (event: FocusEvent<HTMLInputElement>) => {
    setTypedValue(null);
    if (onBlur) onBlur(event);
  };

  const triggerClassName = [
    className ?? (size === "sm" ? "form-input-sm" : "form-input"),
    "localized-date-trigger",
  ]
    .filter(Boolean)
    .join(" ");
  const displayValue = value
    ? isYearMode
      ? formatLocalizedYear(value)
      : isMonthMode
      ? formatLocalizedMonth(value, effectiveLang)
      : formatLocalizedDate(value)
    : "";

  return (
    <div className={`localized-date-field ${size === "sm" ? "small" : ""}`} ref={rootRef}>
      <div
        aria-disabled={disabled}
        className={`${triggerClassName} localized-date-trigger-shell`}
        onClick={() => {
          if (!open) {
            openCalendar();
          }
        }}
      >
        <input
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={ariaLabel}
          className="localized-date-trigger-input"
          disabled={disabled}
          id={id}
          onChange={handleTriggerInputChange}
          onClick={(event) => {
            event.stopPropagation();
            if (!open) openCalendar();
          }}
          onFocus={() => {
            if (!open) {
              openCalendar();
            }
          }}
          onBlur={handleTriggerInputBlur}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) openCalendar();
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const iso = parseTypedToIso(event.currentTarget.value);
              if (iso) {
                commitDate(iso);
              } else if (iso === "") {
                commitDate("");
              }
            }
            if (event.key === "Escape") {
              setTypedValue(null);
              setOpen(false);
            }
          }}
          placeholder={placeholder || defaultPlaceholder(effectiveLang, mode)}
          type="text"
          value={typedValue ?? displayValue}
        />
        <span className="localized-date-icons" aria-hidden="true">
          <CalendarIcon size={size === "sm" ? 14 : 16} />
        </span>
      </div>

      <input
        aria-hidden="true"
        className="localized-date-native-input"
        disabled={disabled}
        lang={effectiveLang}
        name={name}
        onBlur={onBlur}
        onChange={(event) => onHiddenInputChange(event.target.value)}
        ref={assignInputRef}
        tabIndex={-1}
        type="date"
        value={value}
      />

      {open ? createPortal(
        <div
          aria-label={ariaLabel ? `${ariaLabel} takvimi` : "Tarih takvimi"}
          className="localized-date-popover"
          ref={popoverRef}
          role="dialog"
          style={popoverStyle}
        >
          <div className="localized-date-popover-header">
            <button
              className="localized-date-nav-btn"
              onClick={() =>
                setVisibleMonth((current) =>
                  view === "year"
                    ? addYears(current, -12)
                    : view === "month"
                      ? addYears(current, -1)
                      : addMonths(current, -1)
                )
              }
              type="button"
            >
              ‹
            </button>
            <button
              className="localized-date-month-label localized-date-view-toggle"
              onClick={() => {
                if (view === "day") setView("month");
                else if (view === "month") setView("year");
              }}
              type="button"
              disabled={view === "year"}
            >
              {view === "year"
                ? `${yearCells[0]?.label ?? ""} - ${yearCells[yearCells.length - 1]?.label ?? ""}`
                : view === "month"
                ? String(visibleMonth.getUTCFullYear())
                : monthLabel(visibleMonth, effectiveLang)}
            </button>
            <button
              className="localized-date-nav-btn"
              onClick={() =>
                setVisibleMonth((current) =>
                  view === "year"
                    ? addYears(current, 12)
                    : view === "month"
                      ? addYears(current, 1)
                      : addMonths(current, 1)
                )
              }
              type="button"
            >
              ›
            </button>
          </div>

          {view === "year" ? (
            <div className="localized-date-grid localized-month-grid localized-year-grid">
              {yearCells.map((cell) => (
                <button
                  key={cell.key}
                  className={[
                    "localized-date-day",
                    "localized-month-cell",
                    "localized-year-cell",
                    cell.isSelected ? "selected" : "",
                    cell.isCurrent ? "today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectYearCell(cell.iso)}
                  type="button"
                >
                  {cell.label}
                </button>
              ))}
            </div>
          ) : view === "month" ? (
            <div className="localized-date-grid localized-month-grid">
              {monthCells.map((cell) => (
                <button
                  key={cell.key}
                  className={[
                    "localized-date-day",
                    "localized-month-cell",
                    cell.isSelected ? "selected" : "",
                    cell.isCurrent ? "today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectMonthCell(cell.iso)}
                  type="button"
                >
                  {cell.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="localized-date-weekdays">
                {weekdayNames.map((dayName) => (
                  <span key={dayName}>{dayName}</span>
                ))}
              </div>

              <div className="localized-date-grid">
                {cells.map((cell) =>
                  cell.kind === "empty" ? (
                    <span key={cell.key} className="localized-date-day empty" />
                  ) : (
                    <button
                      key={cell.key}
                      className={[
                        "localized-date-day",
                        cell.isSelected ? "selected" : "",
                        cell.isToday ? "today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => selectDayCell(cell.iso)}
                      type="button"
                    >
                      {cell.label}
                    </button>
                  )
                )}
              </div>
            </>
          )}

          <div className="localized-date-popover-footer">
            <button
              className="localized-date-footer-btn"
              onClick={() =>
                commitDate(
                  isYearMode
                    ? `${today.slice(0, 4)}-01-01`
                    : isMonthMode
                      ? `${today.slice(0, 7)}-01`
                      : today
                )
              }
              type="button"
            >
              {isYearMode
                ? effectiveLang === "tr-TR"
                  ? "Bu yıl"
                  : "This year"
                : isMonthMode
                ? effectiveLang === "tr-TR"
                  ? "Bu ay"
                  : "This month"
                : effectiveLang === "tr-TR"
                ? "Bugün"
                : "Today"}
            </button>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
