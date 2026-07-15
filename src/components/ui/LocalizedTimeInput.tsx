import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type FocusEventHandler,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

import { ClockIcon } from "../icons";
import { useAnchoredPopover } from "./useAnchoredPopover";

type LocalizedTimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  size?: "md" | "sm";
  inputRef?: Ref<HTMLInputElement>;
  allowManualInput?: boolean;
  stepMinutes?: number;
  timeOptions?: Array<string | { value: string; label: string }>;
};

type TimeOption = {
  value: string;
  label: string;
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

function normalizeTimeOptions(options: Array<string | { value: string; label: string }>): TimeOption[] {
  return options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );
}

export function LocalizedTimeInput({
  value,
  onChange,
  ariaLabel,
  className,
  disabled = false,
  id,
  name,
  onBlur,
  placeholder = "SS:DD",
  size = "md",
  inputRef,
  allowManualInput = false,
  stepMinutes = 5,
  timeOptions: customTimeOptions,
}: LocalizedTimeInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const { popoverRef, popoverStyle } = useAnchoredPopover({
    anchorRef: rootRef,
    fallbackWidth: 172,
    matchAnchorWidth: true,
    open,
    preferredMaxHeight: 300,
  });
  const timeOptions = useMemo(
    () =>
      customTimeOptions
        ? normalizeTimeOptions(customTimeOptions)
        : normalizeTimeOptions(buildTimeOptions(stepMinutes)),
    [customTimeOptions, stepMinutes]
  );
  const selectedOption = timeOptions.find((option) => option.value === value);
  const displayValue = selectedOption?.label ?? value;

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

  const handleManualChange = (nextValue: string) => {
    if (!allowManualInput) return;
    onChange(nextValue);
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
          id={id}
          onFocus={() => {
            if (!open) {
              openPopover();
            }
          }}
          onChange={(event) => handleManualChange(event.currentTarget.value)}
          onBlur={notifyBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
              event.preventDefault();
              openPopover();
            }
          }}
          placeholder={placeholder}
          readOnly={!allowManualInput}
          type="text"
          value={displayValue}
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
        step={stepMinutes * 60}
        tabIndex={-1}
        type="time"
        value={value}
      />

      {open ? createPortal(
        <div
          aria-label={ariaLabel ? `${ariaLabel} secimi` : "Saat secimi"}
          className="localized-time-popover"
          ref={popoverRef}
          role="dialog"
          style={popoverStyle}
        >
          <div className="localized-time-popover-header">
            <div className="localized-time-popover-title">Saat Sec</div>
            <div className="localized-time-popover-value">{displayValue || placeholder}</div>
          </div>

          <div className="localized-time-list" role="listbox">
            {timeOptions.map((option) => (
              <button
                key={option.value}
                aria-selected={option.value === value}
                className={[
                  "localized-time-option",
                  option.value === value ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => selectTime(option.value)}
                ref={option.value === value ? selectedOptionRef : null}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
