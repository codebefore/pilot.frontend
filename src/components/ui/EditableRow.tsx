import { useEffect, useRef, useState } from "react";

import { useT } from "../../lib/i18n";
import { CheckIcon, PencilIcon, XIcon } from "../icons";
import { CustomSelect } from "./CustomSelect";
import { LocalizedDateInput } from "./LocalizedDateInput";

export type SelectOption = { value: string; label: string };

type EditableRowProps = {
  label: string;
  displayValue: string;
  inputValue: string;
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
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancel = () => {
    loadOptionsControllerRef.current?.abort();
    loadOptionsControllerRef.current = null;
    setLoadingOptions(false);
    setEditing(false);
    setDraft(inputValue);
  };

  const save = async () => {
    if (draft === inputValue) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  const isSelect = !!(staticOptions || loadOptions);

  return (
    <div className="drawer-row editable-row">
      {!editing && <span className="label">{label}</span>}
      {editing ? (
        <span className="editable-row-edit">
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
                    save();
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
