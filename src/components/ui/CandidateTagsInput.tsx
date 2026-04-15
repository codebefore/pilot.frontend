import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { searchCandidateTags } from "../../lib/candidates-api";
import { useT } from "../../lib/i18n";
import { normalizeTextQuery } from "../../lib/search";
import type { CandidateTag } from "../../lib/types";

type CandidateTagsInputProps = {
  value: string[];
  onChange: (names: string[]) => void;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 20;
const TAG_COLOR_COUNT = 6;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

/**
 * Deterministically pick a color index from a tag name so the same tag always
 * renders in the same color across renders and across candidates.
 */
export function tagColorIndex(name: string): number {
  const key = normalize(name);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % TAG_COLOR_COUNT;
}

export function CandidateTagsInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
  disabled = false,
  className,
}: CandidateTagsInputProps) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<CandidateTag[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Debounced suggestion fetch whenever the dropdown is open and the query changes.
  useEffect(() => {
    if (!open) return;
    const normalizedQuery = normalizeTextQuery(inputValue);
    if (!normalizedQuery) {
      setSuggestions([]);
      setLoading(false);
      setHighlightedIndex(0);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchCandidateTags(normalizedQuery, SEARCH_LIMIT, controller.signal)
        .then((result) => {
          setSuggestions(result);
          setLoading(false);
          setHighlightedIndex(0);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setSuggestions([]);
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, inputValue]);

  const trimmedInput = inputValue.trim();
  const normalizedInput = normalize(inputValue);
  const selectedKeys = useMemo(() => new Set(value.map(normalize)), [value]);

  const filteredSuggestions = useMemo(
    () => suggestions.filter((s) => !selectedKeys.has(normalize(s.name))),
    [selectedKeys, suggestions]
  );

  const canCreate =
    trimmedInput.length > 0 &&
    !selectedKeys.has(normalizedInput) &&
    !filteredSuggestions.some((s) => normalize(s.name) === normalizedInput);

  type MenuItem =
    | { kind: "create"; label: string }
    | { kind: "suggestion"; tag: CandidateTag };

  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [];
    if (canCreate) items.push({ kind: "create", label: trimmedInput });
    for (const tag of filteredSuggestions) {
      items.push({ kind: "suggestion", tag });
    }
    return items;
  }, [canCreate, filteredSuggestions, trimmedInput]);

  // Clamp the highlight when the item list shrinks.
  useEffect(() => {
    if (highlightedIndex >= menuItems.length) {
      setHighlightedIndex(Math.max(0, menuItems.length - 1));
    }
  }, [highlightedIndex, menuItems.length]);

  const addTag = (name: string) => {
    const next = name.trim();
    if (!next) return;
    if (selectedKeys.has(normalize(next))) {
      setInputValue("");
      return;
    }
    onChange([...value, next]);
    setInputValue("");
  };

  const removeTagAt = (index: number) => {
    const next = value.slice(0, index).concat(value.slice(index + 1));
    onChange(next);
  };

  const commitHighlighted = () => {
    const item = menuItems[highlightedIndex];
    if (!item) return;
    if (item.kind === "create") {
      addTag(item.label);
    } else {
      addTag(item.tag.name);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (menuItems.length === 0) return;
      setHighlightedIndex((idx) => (idx + 1) % menuItems.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open || menuItems.length === 0) return;
      setHighlightedIndex((idx) => (idx - 1 + menuItems.length) % menuItems.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (menuItems.length > 0) {
        commitHighlighted();
      } else if (trimmedInput.length > 0) {
        addTag(trimmedInput);
      }
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === "Backspace" && inputValue.length === 0 && value.length > 0) {
      event.preventDefault();
      removeTagAt(value.length - 1);
      return;
    }

    if (event.key === "," || event.key === ";") {
      // Typing a comma or semicolon commits the current text as a tag.
      if (trimmedInput.length > 0) {
        event.preventDefault();
        addTag(trimmedInput);
      }
    }
  };

  const fieldClass = [
    "tag-input-field",
    "form-input",
    open ? "open" : "",
    disabled ? "disabled" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const emptyLabel = loading
    ? t("candidates.tags.loading")
    : t("candidates.tags.noMatches");

  return (
    <div className="tag-input-root" ref={rootRef}>
      <div
        aria-disabled={disabled}
        className={fieldClass}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        {value.map((name, index) => (
          <span
            className={`tag-input-chip color-${tagColorIndex(name)}`}
            key={`${name}-${index}`}
          >
            <span className="tag-input-chip-label">{name}</span>
            <button
              aria-label={t("candidates.tags.remove", { name })}
              className="tag-input-chip-remove"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                removeTagAt(index);
                inputRef.current?.focus();
              }}
              tabIndex={-1}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          aria-label={ariaLabel ?? t("candidates.tags.label")}
          className="tag-input-inner"
          disabled={disabled}
          onChange={(event) => {
            setInputValue(event.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder ?? t("candidates.tags.placeholder") : ""}
          ref={inputRef}
          type="text"
          value={inputValue}
        />
      </div>

      {open && !disabled && (
        <div className="tag-input-menu" role="listbox">
          {menuItems.length === 0 ? (
            <div className="tag-input-menu-empty">{emptyLabel}</div>
          ) : (
            menuItems.map((item, index) => {
              const isActive = index === highlightedIndex;
              if (item.kind === "create") {
                return (
                  <button
                    className={`tag-input-menu-item create${isActive ? " active" : ""}`}
                    key="__create__"
                    onClick={(event) => {
                      event.preventDefault();
                      addTag(item.label);
                      inputRef.current?.focus();
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    type="button"
                  >
                    <span className="tag-input-menu-create-prefix">
                      {t("candidates.tags.createNew")}
                    </span>
                    <span className="tag-input-menu-create-name">{item.label}</span>
                  </button>
                );
              }
              return (
                <button
                  className={`tag-input-menu-item${isActive ? " active" : ""}`}
                  key={item.tag.id}
                  onClick={(event) => {
                    event.preventDefault();
                    addTag(item.tag.name);
                    inputRef.current?.focus();
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  type="button"
                >
                  {item.tag.name}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
