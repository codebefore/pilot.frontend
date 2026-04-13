import { NavLink } from "react-router-dom";

import { useT } from "../../lib/i18n";
import { useSidebarStats } from "../../lib/sidebar-stats";
import type { SidebarStatsResponse } from "../../lib/types";
import { mockInstitutions } from "../../mock/institutions";
import { navSections } from "../../nav";
import type { NavKey } from "../../types";
import { InstitutionSelector } from "./InstitutionSelector";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  activeInstitutionId: string;
  onInstitutionChange: (id: string) => void;
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
  };
}

export function Sidebar({
  open,
  onClose,
  activeInstitutionId,
  onInstitutionChange,
}: SidebarProps) {
  const t = useT();
  const { stats, loading, error } = useSidebarStats();
  // While the first request is still in flight, render with no badges to
  // avoid flashing zeros. After error we keep the last fallback (zeros) and
  // simply show no decoration — the rest of the app stays usable.
  const badges = loading || error ? {} : buildNavBadges(stats);

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
              const { Icon } = item;
              const badge = badges[item.key];
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
                    <span className={`sidebar-badge ${badge.tone}`.trim()}>
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
