import { useEffect, useRef, useState } from "react";

import { ChevronDownIcon } from "../icons";
import { useToast } from "../ui/Toast";
import type { Institution } from "../../mock/institutions";

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
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="inst-dot" />
        <span>{active.name}</span>
        <ChevronDownIcon />
      </button>

      {open && (
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
