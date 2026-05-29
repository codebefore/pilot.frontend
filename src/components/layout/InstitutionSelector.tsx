import { useEffect, useRef, useState } from "react";

import type { AuthInstitution } from "../../lib/auth-storage";
import { useToast } from "../ui/Toast";

type InstitutionSelectorProps = {
  institutions: AuthInstitution[];
  activeId: string;
  onSelect: (id: string) => Promise<void>;
};

export function InstitutionSelector({
  institutions,
  activeId,
  onSelect,
}: InstitutionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const active = activeId ? institutions.find((i) => i.id === activeId) : undefined;
  const hasInstitutions = institutions.length > 0;
  const loading = selectingId !== null;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className={open ? "inst-selector open" : "inst-selector"} ref={ref}>
      <button
        className="inst-selector-btn"
        disabled={!hasInstitutions || loading}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="inst-dot" />
        <span className="inst-selector-text">
          <span>{active?.name ?? (hasInstitutions ? "Kurum seç" : "Kurum bulunamadı")}</span>
          {active?.slug ? <small>{active.slug}</small> : null}
        </span>
      </button>

      {open && hasInstitutions && (
        <div className="inst-menu">
          <div className="inst-menu-label">Kurumlar</div>
          {institutions.map((inst) => (
            <button
              className={inst.id === activeId ? "inst-menu-item active" : "inst-menu-item"}
              disabled={loading}
              key={inst.id}
              onClick={async () => {
                if (inst.id === activeId) {
                  setOpen(false);
                  return;
                }

                setSelectingId(inst.id);
                try {
                  await onSelect(inst.id);
                  setOpen(false);
                  showToast(`${inst.name} seçildi`);
                } catch {
                  showToast("Kurum değiştirilemedi", "error");
                } finally {
                  setSelectingId(null);
                }
              }}
              type="button"
            >
              <span className="inst-dot" />
              <span className="inst-menu-item-main">
                <span>{inst.name}</span>
                <small>{inst.slug}</small>
              </span>
              {inst.roleName ? <span className="inst-role-badge">{inst.roleName}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
