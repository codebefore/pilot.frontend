import { useRef, useState } from "react";

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
  loadOptions?: () => Promise<SelectOption[]>;
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
  onSave,
}: EditableRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(inputValue);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<SelectOption[] | undefined>(staticOptions);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null);

  const startEdit = async () => {
    if (disabled) {
      return;
    }

    setDraft(inputValue);
    setEditing(true);
    if (loadOptions && !options) {
      setLoadingOptions(true);
      try {
        const loaded = await loadOptions();
        setOptions(loaded);
      } finally {
        setLoadingOptions(false);
      }
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancel = () => { setEditing(false); setDraft(inputValue); };

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
            ) : (
              <input
                className="form-input-sm"
                disabled={saving}
                lang={inputLang}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                ref={inputRef as React.Ref<HTMLInputElement>}
                type={inputType}
                value={draft}
              />
            )
          )}
          <button className="icon-btn icon-btn-confirm" disabled={saving || loadingOptions} onClick={save} title="Kaydet" type="button">
            <CheckIcon size={13} />
          </button>
          <button className="icon-btn" disabled={saving} onClick={cancel} title="Vazgeç" type="button">
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
            title={disabled ? (disabledTitle ?? "Düzenlenemez") : "Düzenle"}
            type="button"
          >
            <PencilIcon size={12} />
          </button>
        </span>
      )}
    </div>
  );
}
