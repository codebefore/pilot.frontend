import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

type CustomSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  placeholder?: string;
  size?: "md" | "sm";
};

type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

function parseOptions(children: CustomSelectProps["children"]): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== "option") {
      return [];
    }

    const option = child as ReactElement<{
      children?: ReactNode;
      disabled?: boolean;
      value?: string | number | readonly string[];
    }>;

    return [
      {
        value: String(option.props.value ?? ""),
        label: Children.toArray(option.props.children).join(""),
        disabled: option.props.disabled,
      },
    ];
  });
}

export const CustomSelect = forwardRef<HTMLSelectElement, CustomSelectProps>(function CustomSelect(
  {
    "aria-label": ariaLabel,
    children,
    className,
    defaultValue,
    disabled = false,
    name,
    onBlur,
    onChange,
    onKeyDown,
    placeholder,
    size = "md",
    value,
    ...rest
  },
  forwardedRef
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hiddenSelectRef = useRef<HTMLSelectElement | null>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(
    value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : ""
  );

  const options = useMemo(() => parseOptions(children), [children]);
  const currentValue = value !== undefined ? String(value) : internalValue;
  const selectedOption =
    options.find((option) => option.value === currentValue) ??
    options.find((option) => option.value === "");

  useEffect(() => {
    if (value === undefined) return;
    setInternalValue(String(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
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

  const assignRefs = (node: HTMLSelectElement | null) => {
    hiddenSelectRef.current = node;

    if (!forwardedRef) return;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
      return;
    }

    forwardedRef.current = node;
  };

  const handleHiddenChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (value === undefined) {
      setInternalValue(event.target.value);
    }
    onChange?.(event);
  };

  const commitValue = (nextValue: string) => {
    const hiddenSelect = hiddenSelectRef.current;

    if (!hiddenSelect) {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      setOpen(false);
      return;
    }

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value"
    )?.set;
    valueSetter?.call(hiddenSelect, nextValue);
    hiddenSelect.dispatchEvent(new Event("change", { bubbles: true }));
    hiddenSelect.focus();
    hiddenSelect.blur();
    setOpen(false);
  };

  const triggerClassName = [
    className ?? (size === "sm" ? "form-select-sm" : "form-select"),
    "custom-select-trigger",
  ]
    .filter(Boolean)
    .join(" ");

  const handleTriggerClick = () => {
    if (disabled) return;
    setOpen((current) => !current);
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event as unknown as ReactKeyboardEvent<HTMLSelectElement>);
    if (disabled) return;
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div
      className={`custom-select ${size === "sm" ? "small" : ""}`}
      ref={rootRef}
    >
      <div
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        className={triggerClassName}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
      >
        <span
          className={[
            "custom-select-trigger-text",
            selectedOption?.label ? "" : "placeholder",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {selectedOption?.label || placeholder || ""}
        </span>
      </div>

      <select
        {...rest}
        aria-hidden="true"
        aria-label={ariaLabel}
        className="custom-select-native"
        disabled={disabled}
        name={name}
        onBlur={onBlur}
        onChange={handleHiddenChange}
        ref={assignRefs}
        tabIndex={-1}
        value={currentValue}
      >
        {children}
      </select>

      {open ? (
        <div className="custom-select-menu" id={listboxId} role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              aria-selected={option.value === currentValue}
              className={[
                "custom-select-option",
                option.value === currentValue ? "selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={option.disabled}
              onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                commitValue(option.value);
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
