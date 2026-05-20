import { useEffect, useRef, useState } from "react";

import type { Institution } from "../../lib/types";
import { useToast } from "../ui/Toast";

type InstitutionSelectorProps = {
  institutions: Institution[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function InstitutionSelector({
  institutions,
  activeId,
  onSelect,
}: InstitutionSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const active = institutions.find((i) => i.id === activeId) ?? institutions[0];
  const hasInstitutions = institutions.length > 0;

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
        disabled={!hasInstitutions}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="inst-dot" />
        <span>{active?.name ?? "Kurum yükleniyor"}</span>
      </button>

      {open && hasInstitutions && (
        <div className="inst-menu">
          <div className="inst-menu-label">Kurumlar</div>
          {institutions.map((inst) => (
            <button
              className={inst.id === activeId ? "inst-menu-item active" : "inst-menu-item"}
              key={inst.id}
              onClick={() => {
                onSelect(inst.id);
                setOpen(false);
                if (inst.id !== activeId) showToast(`${inst.name} seçildi`);
              }}
              type="button"
            >
              <span className="inst-dot" />
              {inst.name}
              <span className="inst-type-badge">{inst.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
