import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type FocusEventHandler,
  type Ref,
} from "react";

import { ClockIcon } from "../icons";

type LocalizedTimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  size?: "md" | "sm";
  inputRef?: Ref<HTMLInputElement>;
  stepMinutes?: number;
};

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function buildTimeOptions(stepMinutes: number): string[] {
  const safeStep = Number.isInteger(stepMinutes) && stepMinutes > 0 ? stepMinutes : 5;
  const options: string[] = [];

  for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += safeStep) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    options.push(formatTime(hour, minute));
  }

  return options;
}

export function LocalizedTimeInput({
  value,
  onChange,
  ariaLabel,
  className,
  disabled = false,
  name,
  onBlur,
  placeholder = "HH:mm",
  size = "md",
  inputRef,
  stepMinutes = 5,
}: LocalizedTimeInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const timeOptions = useMemo(() => buildTimeOptions(stepMinutes), [stepMinutes]);

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
    if (!open || !selectedOptionRef.current) {
      return;
    }

    selectedOptionRef.current.scrollIntoView?.({ block: "nearest" });
  }, [open, value]);

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

  const openPopover = () => {
    if (disabled) return;
    setOpen(true);
  };

  const selectTime = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    notifyBlur();
  };

  const triggerClassName = [
    className ?? (size === "sm" ? "form-input-sm" : "form-input"),
    "localized-date-trigger",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`localized-date-field ${size === "sm" ? "small" : ""}`} ref={rootRef}>
      <div
        aria-disabled={disabled}
        className={`${triggerClassName} localized-date-trigger-shell`}
        onClick={() => {
          if (!open) {
            openPopover();
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
              openPopover();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
              event.preventDefault();
              openPopover();
            }
          }}
          placeholder={placeholder}
          readOnly
          type="text"
          value={value}
        />
        <span className="localized-date-icons" aria-hidden="true">
          <ClockIcon size={size === "sm" ? 14 : 16} />
        </span>
      </div>

      <input
        aria-hidden="true"
        className="localized-date-native-input"
        disabled={disabled}
        name={name}
        onBlur={onBlur}
        readOnly
        ref={assignInputRef}
        tabIndex={-1}
        type="time"
        value={value}
      />

      {open ? (
        <div
          aria-label={ariaLabel ? `${ariaLabel} secimi` : "Saat secimi"}
          className="localized-time-popover"
          role="dialog"
        >
          <div className="localized-time-popover-header">
            <div className="localized-time-popover-title">Saat Sec</div>
            <div className="localized-time-popover-value">{value || placeholder}</div>
          </div>

          <div className="localized-time-list" role="listbox">
            {timeOptions.map((option) => (
              <button
                key={option}
                aria-selected={option === value}
                className={[
                  "localized-time-option",
                  option === value ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => selectTime(option)}
                ref={option === value ? selectedOptionRef : null}
                role="option"
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
