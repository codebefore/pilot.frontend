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
  type UIEventHandler,
} from "react";
import { createPortal, flushSync } from "react-dom";

type CustomSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  commitOnTypeahead?: boolean;
  onMenuScroll?: UIEventHandler<HTMLDivElement>;
  openOnFocus?: boolean;
  placeholder?: string;
  size?: "md" | "sm";
};

type SelectOption = {
  disabled?: boolean;
  label: string;
  secondaryLabel?: string;
  value: string;
};

function normalizeTypeaheadText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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
    autoFocus = false,
    children,
    className,
    commitOnTypeahead = false,
    defaultValue,
    disabled = false,
    name,
    onBlur,
    onChange,
    onKeyDown,
    onMenuScroll,
    openOnFocus = false,
    placeholder,
    size = "md",
    title,
    value,
    ...rest
  },
  forwardedRef
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const hiddenSelectRef = useRef<HTMLSelectElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(0);
  const lastDispatchedValueRef = useRef<string | null>(null);
  const pendingActiveIndexRef = useRef<number | null>(null);
  const suppressNextEnterOpenRef = useRef(false);
  const typeaheadValueRef = useRef<string | null>(null);
  const typeaheadRef = useRef<{ query: string; timeoutId: number | null }>({
    query: "",
    timeoutId: null,
  });
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [internalValue, setInternalValue] = useState(
    value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : ""
  );

  const options = useMemo(() => parseOptions(children), [children]);
  const currentValue = value !== undefined ? String(value) : internalValue;
  const selectedOption =
    options.find((option) => option.value === currentValue) ??
    options.find((option) => option.value === "");
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === currentValue));

  const setActiveOptionIndex = (index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  };

  useEffect(() => {
    if (value === undefined) return;
    setInternalValue(String(value));
    lastDispatchedValueRef.current = String(value);
    if (commitOnTypeahead) {
      setOpen(false);
    }
  }, [commitOnTypeahead, value]);

  useEffect(() => {
    if (!open) return;
    if (pendingActiveIndexRef.current !== null) {
      setActiveOptionIndex(pendingActiveIndexRef.current);
      pendingActiveIndexRef.current = null;
    } else {
      setActiveOptionIndex(selectedIndex);
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open, selectedIndex]);

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

  useEffect(() => {
    if (!open) return;
    const option = menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[activeIndex];
    option?.scrollIntoView?.({ block: "nearest" });
    if (typeaheadValueRef.current) {
      option?.focus();
    }
  }, [activeIndex, open]);

  useEffect(
    () => () => {
      if (typeaheadRef.current.timeoutId !== null) {
        window.clearTimeout(typeaheadRef.current.timeoutId);
      }
    },
    []
  );

  useEffect(() => {
    if (!autoFocus || disabled) return;
    triggerRef.current?.focus();
  }, [autoFocus, disabled]);

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

  const closeMenuNow = () => {
    if (!open) {
      setOpen(false);
      return;
    }
    flushSync(() => setOpen(false));
  };

  const dispatchValue = (nextValue: string) => {
    lastDispatchedValueRef.current = nextValue;
    const hiddenSelect = hiddenSelectRef.current;

    if (!hiddenSelect) {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      return;
    }

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value"
    )?.set;
    valueSetter?.call(hiddenSelect, nextValue);
    hiddenSelect.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const commitValue = (nextValue: string) => {
    typeaheadValueRef.current = null;
    closeMenuNow();
    const hiddenSelect = hiddenSelectRef.current;

    if (!hiddenSelect) {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      return;
    }

    dispatchValue(nextValue);
    hiddenSelect.focus();
    hiddenSelect.blur();
  };

  const commitValueIfChanged = (nextValue: string) => {
    if (lastDispatchedValueRef.current === nextValue || hiddenSelectRef.current?.value === nextValue) {
      typeaheadValueRef.current = null;
      closeMenuNow();
      return;
    }
    commitValue(nextValue);
  };

  const moveActiveOption = (direction: 1 | -1) => {
    if (options.length === 0) return;

    let nextIndex = activeIndexRef.current;
    for (let attempt = 0; attempt < options.length; attempt += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex]?.disabled) {
        typeaheadValueRef.current = null;
        setActiveOptionIndex(nextIndex);
        return;
      }
    }
  };

  const moveToTypeaheadOption = (key: string) => {
    if (key.length !== 1 || options.length === 0) return false;
    const normalizedKey = normalizeTypeaheadText(key);
    if (!normalizedKey) return false;

    if (typeaheadRef.current.timeoutId !== null) {
      window.clearTimeout(typeaheadRef.current.timeoutId);
    }
    const nextQuery = `${typeaheadRef.current.query}${normalizedKey}`;
    typeaheadRef.current.query = nextQuery;
    typeaheadRef.current.timeoutId = window.setTimeout(() => {
      typeaheadRef.current.query = "";
      typeaheadRef.current.timeoutId = null;
    }, 700);

    const startIndex = open ? activeIndexRef.current + 1 : selectedIndex + 1;
    const findMatch = (query: string) => {
      for (let offset = 0; offset < options.length; offset += 1) {
        const index = (startIndex + offset) % options.length;
        const option = options[index];
        if (!option || option.disabled || option.value === "") continue;
        if (normalizeTypeaheadText(option.label).startsWith(query)) {
          return index;
        }
      }
      return -1;
    };

    let nextIndex = findMatch(nextQuery);
    if (nextIndex < 0 && nextQuery.length > 1) {
      typeaheadRef.current.query = normalizedKey;
      nextIndex = findMatch(normalizedKey);
    }
    if (nextIndex < 0) return false;

    if (commitOnTypeahead) {
      suppressNextEnterOpenRef.current = true;
      commitValue(options[nextIndex]?.value ?? "");
      return true;
    }

    pendingActiveIndexRef.current = nextIndex;
    typeaheadValueRef.current = options[nextIndex]?.value ?? null;
    setActiveOptionIndex(nextIndex);
    setOpen(true);
    return true;
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
    if (disabled) return;

    if (
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      moveToTypeaheadOption(event.key)
    ) {
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActiveOption(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open && commitOnTypeahead && suppressNextEnterOpenRef.current) {
        suppressNextEnterOpenRef.current = false;
        return;
      }
      const typeaheadOption = typeaheadValueRef.current
        ? options.find((option) => option.value === typeaheadValueRef.current)
        : null;
      if (typeaheadOption && !typeaheadOption.disabled) {
        commitValueIfChanged(typeaheadOption.value);
        return;
      }
      if (open) {
        const activeOption = options[activeIndexRef.current];
        if (activeOption && !activeOption.disabled) {
          commitValueIfChanged(activeOption.value);
        }
        return;
      }
      setOpen(true);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      typeaheadValueRef.current = null;
      setOpen(false);
      return;
    }

    if (event.key === "Tab" && open) {
      const activeOption =
        (typeaheadValueRef.current
          ? options.find((option) => option.value === typeaheadValueRef.current)
          : null) ?? options[activeIndexRef.current];
      if (activeOption && !activeOption.disabled) {
        typeaheadValueRef.current = null;
        dispatchValue(activeOption.value);
      }
      setOpen(false);
    }

    onKeyDown?.(event as unknown as ReactKeyboardEvent<HTMLSelectElement>);
  };

  useEffect(() => {
    if (!open || disabled) return;

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;

      const fromMenu = target ? menuRef.current?.contains(target) : false;
      const fromDocumentSurface =
        target === document ||
        target === document.body ||
        target === document.documentElement;
      if (!fromMenu && !fromDocumentSurface) return;
      if (fromMenu && event.key === "Enter") return;

      if (
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        moveToTypeaheadOption(event.key)
      ) {
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveActiveOption(event.key === "ArrowDown" ? 1 : -1);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const typeaheadOption = typeaheadValueRef.current
          ? options.find((option) => option.value === typeaheadValueRef.current)
          : null;
        const activeOption = typeaheadOption ?? options[activeIndexRef.current];
        if (activeOption && !activeOption.disabled) {
          commitValueIfChanged(activeOption.value);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        typeaheadValueRef.current = null;
        setOpen(false);
        return;
      }

      if (event.key === "Tab") {
        const typeaheadOption = typeaheadValueRef.current
          ? options.find((option) => option.value === typeaheadValueRef.current)
          : null;
        const activeOption = typeaheadOption ?? options[activeIndexRef.current];
        if (activeOption && !activeOption.disabled) {
          typeaheadValueRef.current = null;
          dispatchValue(activeOption.value);
        }
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [disabled, open, options, selectedIndex]);

  const handleTriggerFocus = () => {
    if (disabled || !openOnFocus) return;
    setOpen(true);
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
        onFocus={handleTriggerFocus}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
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
          onScroll={onMenuScroll}
          ref={menuRef}
          role="listbox"
          style={menuStyle ?? undefined}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              aria-selected={option.value === currentValue}
              className={[
                optionClassName,
                option.value === currentValue ? "selected" : "",
                index === activeIndex ? "active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={option.disabled}
              onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                commitValue(option.value);
              }}
              onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                if (event.key !== "Enter" && event.key !== " ") return;
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
