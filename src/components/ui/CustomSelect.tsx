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
  type CSSProperties,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

type CustomSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  placeholder?: string;
  size?: "md" | "sm";
};

type SelectOption = {
  disabled?: boolean;
  label: string;
  secondaryLabel?: string;
  value: string;
};

function parseOptions(children: CustomSelectProps["children"]): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== "option") {
      return [];
    }

    const option = child as ReactElement<{
      children?: ReactNode;
      "data-secondary"?: string;
      disabled?: boolean;
      value?: string | number | readonly string[];
    }>;

    return [
      {
        value: String(option.props.value ?? ""),
        label: Children.toArray(option.props.children).join(""),
        secondaryLabel: option.props["data-secondary"],
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
    title,
    value,
    ...rest
  },
  forwardedRef
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hiddenSelectRef = useRef<HTMLSelectElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
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
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
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

  useEffect(() => {
    if (!open) return;

    const updateMenuPosition = () => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 8;
      const menuHeight = menuRef.current?.offsetHeight ?? 240;
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
      const availableAbove = rect.top - viewportPadding - gap;
      const openAbove = availableBelow < 120 && availableAbove > availableBelow;
      const availableHeight = openAbove ? availableAbove : availableBelow;
      const menuWidth = rect.width;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
      setMenuStyle({
        left: Math.min(Math.max(viewportPadding, rect.left), maxLeft),
        maxHeight: Math.max(120, Math.min(240, availableHeight)),
        minWidth: rect.width,
        position: "fixed",
        top: openAbove
          ? Math.max(viewportPadding, rect.top - Math.min(menuHeight, availableHeight) - gap)
          : rect.bottom + gap,
        width: rect.width,
        zIndex: 5000,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
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
  const menuClassName = [
    "custom-select-menu",
    size === "sm" ? "custom-select-menu--small" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const optionClassName = [
    "custom-select-option",
    size === "sm" ? "custom-select-option--small" : "",
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
        title={title}
      >
        <span
          className={[
            "custom-select-trigger-text",
            selectedOption?.label ? "" : "placeholder",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {selectedOption?.secondaryLabel ? (
            <span className="custom-select-option-content">
              <span>{selectedOption.label}</span>
              <span className="custom-select-option-secondary">{selectedOption.secondaryLabel}</span>
            </span>
          ) : (
            selectedOption?.label || placeholder || ""
          )}
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

      {open ? createPortal(
        <div
          className={menuClassName}
          id={listboxId}
          ref={menuRef}
          role="listbox"
          style={menuStyle ?? undefined}
        >
          {options.map((option) => (
            <button
              key={option.value}
              aria-selected={option.value === currentValue}
              className={[
                optionClassName,
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
              {option.secondaryLabel ? (
                <span className="custom-select-option-content">
                  <span>{option.label}</span>
                  <span className="custom-select-option-secondary">{option.secondaryLabel}</span>
                </span>
              ) : (
                option.label
              )}
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
});
