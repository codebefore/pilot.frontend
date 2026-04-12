import { NavLink } from "react-router-dom";

import { useT } from "../../lib/i18n";
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
  const t = useT();
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
          <div className="sidebar-section" key={section.headingKey}>
            <div className="sidebar-heading">{t(section.headingKey)}</div>
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
                  {t(item.labelKey)}
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
