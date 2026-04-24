import { useEffect, useRef, useState } from "react";

type SearchInputProps = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  /**
   * When set, typed characters accumulate locally and `onChange` is called
   * only after the user pauses typing for `debounceMs` milliseconds. Useful
   * for server-backed searches so each keystroke does not fire a request.
   * When omitted the input fires synchronously on every keystroke.
   */
  debounceMs?: number;
  /**
   * Increment/change this when an external action should discard pending
   * debounced text even if the controlled `value` itself did not change.
   */
  resetSignal?: unknown;
};

export function SearchInput({
  value,
  placeholder,
  onChange,
  debounceMs,
  resetSignal,
}: SearchInputProps) {
  // Debounced mode keeps the typed-but-not-yet-flushed text in local state.
  // External `value` changes (e.g. a "Clear filters" button) still win — the
  // effect below resets local state whenever the parent supplies a new value.
  const [localValue, setLocalValue] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!debounceMs) return;
    setLocalValue(value);
  }, [value, debounceMs, resetSignal]);

  useEffect(() => {
    if (!debounceMs) return;
    if (localValue === value) return;
    const handle = window.setTimeout(() => onChangeRef.current(localValue), debounceMs);
    return () => window.clearTimeout(handle);
  }, [localValue, value, debounceMs]);

  const displayValue = debounceMs ? localValue : value;

  return (
    <input
      className="search-input"
      onChange={(e) => {
        if (debounceMs) {
          setLocalValue(e.target.value);
        } else {
          onChange(e.target.value);
        }
      }}
      placeholder={placeholder}
      type="search"
      value={displayValue}
    />
  );
}
