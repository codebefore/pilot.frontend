import { useQuery } from "@tanstack/react-query";

import { DashboardNotesPanel } from "../components/dashboard/DashboardNotesPanel";
import { AlertIcon } from "../components/icons";
import { Panel } from "../components/ui/Panel";
import { PanelListSkeleton } from "../components/ui/Skeleton";
import { TaskItem } from "../components/ui/TaskItem";
import { useT } from "../lib/i18n";
import { getDashboardOverview } from "../lib/stats-api";
import type { DashboardOverviewResponse } from "../lib/types";

type DashboardPageProps = {
  userName?: string | null;
};

export function DashboardPage({ userName }: DashboardPageProps) {
  const t = useT();
  const {
    data: dashboard = { pendingTasks: [], recentMebJobs: [], recentActivity: [] },
    isLoading: dashboardLoading,
  } = useQuery<DashboardOverviewResponse>({
    queryKey: ["dashboard", "overview"],
    queryFn: () => getDashboardOverview(),
  });

  const displayName = userName?.trim() || "Pilot";

  return (
    <>
      <div className="dash-header">
        <h1>{t("dashboard.greeting", { name: displayName })}</h1>
      </div>

      <div className="dash-content">
        <div className="dash-primary-grid">
          <Panel
            action={<button className="panel-action" type="button">{t("dashboard.viewAll")}</button>}
            icon={<span className="icon-orange"><AlertIcon /></span>}
            title={t("dashboard.panel.pendingTasks")}
          >
            {dashboardLoading ? (
              <PanelListSkeleton rows={3} />
            ) : dashboard.pendingTasks.length > 0 ? (
              dashboard.pendingTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  priority={task.priority}
                  source={task.source}
                  status={task.status}
                  time={task.time}
                  title={task.title}
                />
              ))
            ) : (
              <div className="panel-empty">{t("dashboard.emptyPendingTasks")}</div>
            )}
          </Panel>

          <DashboardNotesPanel />

          <Panel title={t("dashboard.panel.recentActivity")}>
            {dashboardLoading ? (
              <PanelListSkeleton rows={4} />
            ) : dashboard.recentActivity.length > 0 ? (
              dashboard.recentActivity.map((event) => (
                <div className="activity-item" key={event.id}>
                  <div className={`activity-avatar tone-${event.avatarTone}`}>
                    {event.avatar}
                  </div>
                  <div>
                    <div className="activity-text">
                      <strong>{event.actor}</strong> {event.description}
                    </div>
                    <div className="activity-time">{event.time}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="panel-empty">{t("dashboard.emptyRecentActivity")}</div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
