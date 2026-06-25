import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useT } from "../../lib/i18n";
import { CheckIcon, PencilIcon, XIcon } from "../icons";
import { CustomSelect } from "./CustomSelect";
import { LocalizedDateInput } from "./LocalizedDateInput";

export type SelectOption = { value: string; label: string };

type EditableRowProps = {
  label: string;
  displayValue: string;
  inputValue: string;
  className?: string;
  inputType?: string;
  inputLang?: string;
  disabled?: boolean;
  disabledTitle?: string;
  options?: SelectOption[];
  loadOptions?: (signal?: AbortSignal) => Promise<SelectOption[]>;
  /**
   * Her onChange'te draft değerine uygulanır (canlı). Örn. Türkçe büyük
   * harf normalizasyonu. Save sırasında ayrıca çağrılmaz.
   */
  transform?: (value: string) => string;
  onSave: (value: string) => Promise<void>;
};

export function EditableRow({
  label,
  displayValue,
  inputValue,
  className,
  inputType = "text",
  inputLang,
  disabled = false,
  disabledTitle,
  options: staticOptions,
  loadOptions,
  transform,
  onSave,
}: EditableRowProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(inputValue);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<SelectOption[] | undefined>(staticOptions);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const loadOptionsControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (staticOptions) {
      setOptions(staticOptions);
    }
  }, [staticOptions]);

  useEffect(() => {
    return () => loadOptionsControllerRef.current?.abort();
  }, []);

  const focusEditor = () => {
    const target = rowRef.current?.querySelector<HTMLElement>(
      [
        ".localized-date-trigger-input",
        ".custom-select-trigger",
        "textarea",
        "input:not(.localized-date-native-input)",
        "select:not(.custom-select-native)",
      ].join(", ")
    );

    target?.focus();
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.select();
    }
  };

  const startEdit = async () => {
    if (disabled) {
      return;
    }

    setDraft(inputValue);
    setEditing(true);
    if (loadOptions && !options) {
      loadOptionsControllerRef.current?.abort();
      const controller = new AbortController();
      loadOptionsControllerRef.current = controller;
      setLoadingOptions(true);
      try {
        const loaded = await loadOptions(controller.signal);
        setOptions(loaded);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          throw error;
        }
      } finally {
        if (loadOptionsControllerRef.current === controller) {
          loadOptionsControllerRef.current = null;
          setLoadingOptions(false);
        }
      }
    }
    setTimeout(focusEditor, 0);
  };

  const cancel = () => {
    loadOptionsControllerRef.current?.abort();
    loadOptionsControllerRef.current = null;
    setLoadingOptions(false);
    setEditing(false);
    setDraft(inputValue);
  };

  const save = async () => {
    if (draft === inputValue) { setEditing(false); return true; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const openAdjacentRow = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;

    const scope =
      row.closest(".candidate-detail-edit-list") ??
      row.closest(".drawer-section") ??
      row.closest(".profile-section") ??
      row.parentElement;
    if (!scope) return;

    const rows = Array.from(scope.querySelectorAll<HTMLElement>(".editable-row"));
    const currentIndex = rows.indexOf(row);
    if (currentIndex === -1) return;

    for (let index = currentIndex + direction; index >= 0 && index < rows.length; index += direction) {
      const trigger = rows[index].querySelector<HTMLButtonElement>(".edit-trigger:not(:disabled)");
      if (trigger) {
        trigger.click();
        return;
      }
    }
  };

  const saveAndOpenAdjacentRow = async (direction: 1 | -1) => {
    const saved = await save();
    if (saved) {
      setTimeout(() => openAdjacentRow(direction), 0);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      void save().catch(() => undefined);
    }
    if (e.key === "Escape") cancel();
  };

  const onEditKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".localized-date-popover") || target.closest(".icon-btn")) return;

    e.preventDefault();
    void saveAndOpenAdjacentRow(e.shiftKey ? -1 : 1).catch(() => undefined);
  };

  const isSelect = !!(staticOptions || loadOptions);

  return (
    <div className={["drawer-row editable-row", className].filter(Boolean).join(" ")} ref={rowRef}>
      {!editing && <span className="label">{label}</span>}
      {editing ? (
        <span className="editable-row-edit" onKeyDown={onEditKeyDown}>
          {isSelect ? (
            <CustomSelect
              aria-label={label}
              className="form-select-sm"
              disabled={saving || loadingOptions}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              ref={inputRef as React.Ref<HTMLSelectElement>}
              value={draft}
            >
              {(options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </CustomSelect>
          ) : (
            inputType === "date" ? (
              <LocalizedDateInput
                ariaLabel={label}
                disabled={saving}
                lang={inputLang}
                onChange={setDraft}
                size="sm"
                value={draft}
              />
            ) : inputType === "textarea" ? (
              <textarea
                aria-label={label}
                className="form-textarea form-textarea-sm"
                disabled={saving}
                lang={inputLang}
                onChange={(e) => setDraft(transform ? transform(e.target.value) : e.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    void save().catch(() => undefined);
                  }
                  if (event.key === "Escape") {
                    cancel();
                  }
                }}
                value={draft}
              />
            ) : (
              <input
                aria-label={label}
                className="form-input-sm"
                disabled={saving}
                lang={inputLang}
                onChange={(e) => setDraft(transform ? transform(e.target.value) : e.target.value)}
                onKeyDown={onKeyDown}
                ref={inputRef as React.Ref<HTMLInputElement>}
                type={inputType}
                value={draft}
              />
            )
          )}
          <button className="icon-btn icon-btn-confirm" disabled={saving || loadingOptions} onClick={save} title={t("common.save")} type="button">
            <CheckIcon size={13} />
          </button>
          <button className="icon-btn" disabled={saving} onClick={cancel} title={t("common.cancel")} type="button">
            <XIcon size={13} />
          </button>
        </span>
      ) : (
        <span className="editable-row-view">
          <span className="value">{displayValue || "—"}</span>
          <button
            className="icon-btn edit-trigger"
            disabled={disabled}
            onClick={startEdit}
            title={disabled ? (disabledTitle ?? t("editableRow.title.cannotEdit")) : t("common.edit")}
            type="button"
          >
            <PencilIcon size={12} />
          </button>
        </span>
      )}
    </div>
  );
}
