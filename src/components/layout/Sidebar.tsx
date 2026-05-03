import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useT } from "../../lib/i18n";
import { useSidebarStats } from "../../lib/sidebar-stats";
import type { SidebarStatsResponse } from "../../lib/types";
import { mockInstitutions } from "../../mock/institutions";
import { navSections, type NavItem } from "../../nav";
import type { NavKey } from "../../types";
import { ChevronDownIcon } from "../icons";
import { InstitutionSelector } from "./InstitutionSelector";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  activeInstitutionId: string;
  onInstitutionChange: (id: string) => void;
  desktopVisible?: boolean;
  onMouseLeave?: () => void;
};

type SidebarBadge = { value: number; tone: "info" | "warn" | "danger" };

/** Map the live stats response to per-nav-key badge content. Items that
 *  resolve to undefined render with no badge at all. */
function buildNavBadges(stats: SidebarStatsResponse): Partial<Record<NavKey, SidebarBadge>> {
  const mebAttention = stats.mebJobs.failed + stats.mebJobs.manualReview;
  return {
    candidates: { value: stats.candidates.active, tone: "info" },
    documents:
      stats.documents.missingCount > 0
        ? { value: stats.documents.missingCount, tone: "warn" }
        : undefined,
    mebjobs: mebAttention > 0 ? { value: mebAttention, tone: "danger" } : undefined,
    payments:
      stats.payments.dueToday > 0
        ? { value: stats.payments.dueToday, tone: "warn" }
        : undefined,
  };
}

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
  onInstitutionChange,
  desktopVisible = true,
  onMouseLeave,
}: SidebarProps) {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { stats, loading, error } = useSidebarStats();
  const activeParentKeys = useMemo(
    () =>
      navSections.flatMap((section) =>
        section.items
          .filter((item) => item.children && item.children.length > 0)
          .filter((item) => isNavItemActive(location.pathname, item))
          .map((item) => item.key)
      ),
    [location.pathname]
  );
  const [openSubmenus, setOpenSubmenus] = useState<Set<NavKey>>(
    () => new Set(activeParentKeys)
  );
  // While the first request is still in flight, render with no badges to
  // avoid flashing zeros. After error we keep the last fallback (zeros) and
  // simply show no decoration — the rest of the app stays usable.
  const badges = loading || error ? {} : buildNavBadges(stats);
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

  const openSubmenuFirstChild = (item: NavItem) => {
    const firstChildPath = item.children?.[0]?.path;

    setOpenSubmenus(new Set([item.key]));

    if (firstChildPath) {
      navigate(firstChildPath);
    }
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
            institutions={mockInstitutions}
            onSelect={onInstitutionChange}
          />
        </div>
        {navSections.map((section) => (
          <div className="sidebar-section" key={section.headingKey}>
            <div className="sidebar-heading">{t(section.headingKey)}</div>
            {section.items.map((item) => {
              const { Icon } = item;
              const badge = badges[item.key];
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
                      onClick={() => openSubmenuFirstChild(item)}
                      type="button"
                    >
                      <span className="sidebar-icon">
                        <Icon />
                      </span>
                      {t(item.labelKey)}
                      {badge && (
                        <span className={`sidebar-badge ${badge.tone}`.trim()}>
                          {badge.value}
                        </span>
                      )}
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
                      {badge && (
                        <span className={`sidebar-badge ${badge.tone}`.trim()}>
                          {badge.value}
                        </span>
                      )}
                    </NavLink>
                  )}

                  {hasChildren && subnavOpen && (
                    <div className="sidebar-subnav" id={`sidebar-subnav-${item.key}`}>
                      {children.map((child) => {
                        const childBadge = badges[child.key];
                        return (
                          <NavLink
                            className={({ isActive }) =>
                              isActive
                                ? "sidebar-link sidebar-link-child active"
                                : "sidebar-link sidebar-link-child"
                            }
                            key={child.key}
                            onClick={() => setOpenSubmenus(new Set([item.key]))}
                            to={child.path}
                          >
                            <span aria-hidden="true" className="sidebar-subdot" />
                            {t(child.labelKey)}
                            {childBadge && (
                              <span className={`sidebar-badge ${childBadge.tone}`.trim()}>
                                {childBadge.value}
                              </span>
                            )}
                          </NavLink>
                        );
                      })}
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
