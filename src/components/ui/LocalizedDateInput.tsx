import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type FocusEventHandler,
  type Ref,
} from "react";

import { CalendarIcon } from "../icons";

type LocalizedDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  defaultOnOpen?: string;
  disabled?: boolean;
  lang?: string;
  /** "day" shows a day grid (default); "month" shows a 12-month grid and snaps value to the first of the selected month. */
  mode?: "day" | "month";
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

function formatLocalizedDate(value: string, lang?: string): string {
  const parts = value.slice(0, 10).split("-");
  if (parts.length !== 3) return value;

  const [year, month, day] = parts;
  if (lang === "tr-TR") {
    return `${day}/${month}/${year}`;
  }

  return `${year}-${month}-${day}`;
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

function defaultPlaceholder(lang?: string, mode: "day" | "month" = "day"): string {
  if (mode === "month") {
    return lang === "tr-TR" ? "aa/yyyy" : "mmm yyyy";
  }
  return lang === "tr-TR" ? "dd/mm/yyyy" : "yyyy-mm-dd";
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
  lang,
  mode = "day",
  name,
  onBlur,
  placeholder,
  size = "md",
  inputRef,
}: LocalizedDateInputProps) {
  const isMonthMode = mode === "month";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const baseDate = parseIsoDate(value) ?? parseIsoDate(defaultOnOpen) ?? parseIsoDate(todayISO())!;
    return monthStart(baseDate);
  });

  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const selectedMonth = useMemo(
    () => monthStart(selectedDate ?? parseIsoDate(defaultOnOpen) ?? parseIsoDate(todayISO())!),
    [defaultOnOpen, selectedDate]
  );
  const today = todayISO();
  const weekdayNames = useMemo(() => weekdayLabels(lang), [lang]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
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
  }, [open, selectedMonth]);

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

  const selectDate = (iso: string) => {
    onChange(iso);
    setOpen(false);
    notifyBlur();
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

  const monthNames = useMemo(() => shortMonthNames(lang), [lang]);
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

  const triggerClassName = [
    className ?? (size === "sm" ? "form-input-sm" : "form-input"),
    "localized-date-trigger",
  ]
    .filter(Boolean)
    .join(" ");
  const displayValue = value
    ? isMonthMode
      ? formatLocalizedMonth(value, lang)
      : formatLocalizedDate(value, lang)
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
          onFocus={() => {
            if (!open) {
              openCalendar();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
              event.preventDefault();
              openCalendar();
            }
          }}
          placeholder={placeholder || defaultPlaceholder(lang, mode)}
          readOnly
          type="text"
          value={displayValue}
        />
        <span className="localized-date-icons" aria-hidden="true">
          <CalendarIcon size={size === "sm" ? 14 : 16} />
        </span>
      </div>

      <input
        aria-hidden="true"
        className="localized-date-native-input"
        disabled={disabled}
        lang={lang}
        name={name}
        onBlur={onBlur}
        onChange={(event) => onHiddenInputChange(event.target.value)}
        ref={assignInputRef}
        tabIndex={-1}
        type="date"
        value={value}
      />

      {open ? (
        <div
          aria-label={ariaLabel ? `${ariaLabel} takvimi` : "Tarih takvimi"}
          className="localized-date-popover"
          role="dialog"
        >
          <div className="localized-date-popover-header">
            <button
              className="localized-date-nav-btn"
              onClick={() =>
                setVisibleMonth((current) =>
                  isMonthMode ? addYears(current, -1) : addMonths(current, -1)
                )
              }
              type="button"
            >
              ‹
            </button>
            <div className="localized-date-month-label">
              {isMonthMode
                ? String(visibleMonth.getUTCFullYear())
                : monthLabel(visibleMonth, lang)}
            </div>
            <button
              className="localized-date-nav-btn"
              onClick={() =>
                setVisibleMonth((current) =>
                  isMonthMode ? addYears(current, 1) : addMonths(current, 1)
                )
              }
              type="button"
            >
              ›
            </button>
          </div>

          {isMonthMode ? (
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
                  onClick={() => selectDate(cell.iso)}
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
                      onClick={() => selectDate(cell.iso)}
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
                selectDate(isMonthMode ? `${today.slice(0, 7)}-01` : today)
              }
              type="button"
            >
              {isMonthMode
                ? lang === "tr-TR"
                  ? "Bu ay"
                  : "This month"
                : lang === "tr-TR"
                ? "Bugun"
                : "Today"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
