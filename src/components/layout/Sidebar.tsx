import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useT } from "../../lib/i18n";
import { canViewAnyArea } from "../../lib/permissions";
import { useAuth } from "../../lib/auth";
import type { AuthInstitution } from "../../lib/auth-storage";
import { navSections, type NavItem } from "../../nav";
import type { NavKey } from "../../types";
import { ChevronDownIcon } from "../icons";
import { InstitutionSelector } from "./InstitutionSelector";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  activeInstitutionId: string;
  institutions: AuthInstitution[];
  onInstitutionChange: (id: string) => Promise<void>;
  desktopVisible?: boolean;
  onMouseLeave?: () => void;
};

function isPathActive(pathname: string, path: string): boolean {
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

function isNavItemActive(pathname: string, item: NavItem): boolean {
  return (
    isPathActive(pathname, item.path) ||
    item.children?.some((child) => isPathActive(pathname, child.path)) === true
  );
}

export function Sidebar({
  open,
  onClose,
  activeInstitutionId,
  institutions,
  onInstitutionChange,
  desktopVisible = true,
  onMouseLeave,
}: SidebarProps) {
  const t = useT();
  const location = useLocation();
  const { user, permissions } = useAuth();
  const visibleSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items
            .filter((item) => canViewAnyArea(user, permissions, item.permissionAreas))
            .map((item) => ({
              ...item,
              children: item.children?.filter((child) =>
                canViewAnyArea(user, permissions, child.permissionAreas ?? item.permissionAreas)
              ),
            })),
        }))
        .filter((section) => section.items.length > 0),
    [permissions, user]
  );
  const activeParentKeys = useMemo(
    () =>
      visibleSections.flatMap((section) =>
        section.items
          .filter((item) => item.children && item.children.length > 0)
          .filter((item) => isNavItemActive(location.pathname, item))
          .map((item) => item.key)
      ),
    [location.pathname, visibleSections]
  );
  const [openSubmenus, setOpenSubmenus] = useState<Set<NavKey>>(
    () => new Set(activeParentKeys)
  );
  const activeParentSignature = activeParentKeys.join("|");

  useEffect(() => {
    if (!activeParentSignature) return;

    setOpenSubmenus((current) => {
      let changed = false;
      const next = new Set(current);

      activeParentKeys.forEach((key) => {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [activeParentKeys, activeParentSignature]);

  const openSubmenu = (item: NavItem) => {
    setOpenSubmenus(new Set([item.key]));
  };

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <nav
        className={[
          "sidebar",
          open ? "open" : "",
          desktopVisible ? "" : "desktop-collapsed",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseLeave={onMouseLeave}
      >
        <div className="sidebar-inst">
          <InstitutionSelector
            activeId={activeInstitutionId}
            institutions={institutions}
            onSelect={onInstitutionChange}
          />
        </div>
        {visibleSections.map((section) => (
          <div className="sidebar-section" key={section.headingKey}>
            <div className="sidebar-heading">{t(section.headingKey)}</div>
            {section.items.map((item) => {
              const { Icon } = item;
              const children = item.children ?? [];
              const hasChildren = children.length > 0;
              const itemActive = isNavItemActive(location.pathname, item);
              const subnavOpen = openSubmenus.has(item.key);

              return (
                <div className="sidebar-nav-group" key={item.key}>
                  {hasChildren ? (
                    <button
                      aria-controls={`sidebar-subnav-${item.key}`}
                      aria-expanded={subnavOpen}
                      className={[
                        "sidebar-link",
                        "sidebar-link-parent",
                        itemActive ? "active" : "",
                        subnavOpen ? "expanded" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => openSubmenu(item)}
                      type="button"
                    >
                      <span className="sidebar-icon">
                        <Icon />
                      </span>
                      {t(item.labelKey)}
                      <span aria-hidden="true" className="sidebar-menu-chevron">
                        <ChevronDownIcon />
                      </span>
                    </button>
                  ) : (
                    <NavLink
                      className={({ isActive }) =>
                        isActive ? "sidebar-link active" : "sidebar-link"
                      }
                      end={item.path === "/"}
                      onClick={() => setOpenSubmenus(new Set())}
                      to={item.path}
                    >
                      <span className="sidebar-icon">
                        <Icon />
                      </span>
                      {t(item.labelKey)}
                    </NavLink>
                  )}

                  {hasChildren && subnavOpen && (
                    <div className="sidebar-subnav" id={`sidebar-subnav-${item.key}`}>
                      {children.map((child) => (
                          <NavLink
                            className={({ isActive }) =>
                              isActive
                                ? "sidebar-link sidebar-link-child active"
                                : "sidebar-link sidebar-link-child"
                            }
                            key={child.key}
                            end={child.path === item.path}
                            onClick={() => setOpenSubmenus(new Set([item.key]))}
                            to={child.path}
                          >
                            <span aria-hidden="true" className="sidebar-subdot" />
                            {t(child.labelKey)}
                          </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
