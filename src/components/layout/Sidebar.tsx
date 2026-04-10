import { NavLink } from "react-router-dom";

import { mockInstitutions } from "../../mock/institutions";
import { navSections } from "../../nav";
import { InstitutionSelector } from "./InstitutionSelector";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  activeInstitutionId: string;
  onInstitutionChange: (id: string) => void;
};

export function Sidebar({
  open,
  onClose,
  activeInstitutionId,
  onInstitutionChange,
}: SidebarProps) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <nav className={open ? "sidebar open" : "sidebar"}>
        <div className="sidebar-inst">
          <InstitutionSelector
            activeId={activeInstitutionId}
            institutions={mockInstitutions}
            onSelect={onInstitutionChange}
          />
        </div>
        {navSections.map((section) => (
          <div className="sidebar-section" key={section.heading}>
            <div className="sidebar-heading">{section.heading}</div>
            {section.items.map((item) => {
              const { Icon, badge } = item;
              return (
                <NavLink
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                  end={item.path === "/"}
                  key={item.key}
                  to={item.path}
                >
                  <span className="sidebar-icon">
                    <Icon />
                  </span>
                  {item.label}
                  {badge && (
                    <span className={`sidebar-badge ${badge.tone ?? ""}`.trim()}>
                      {badge.value}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
