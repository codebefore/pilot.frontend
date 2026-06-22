import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PencilIcon } from "../icons";
import { TrainingBranchFormModal } from "../modals/TrainingBranchFormModal";
import { SettingsTableSkeleton } from "../ui/Skeleton";
import { StatusPill } from "../ui/StatusPill";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/auth";
import { canManageArea } from "../../lib/permissions";
import { useT } from "../../lib/i18n";
import { getTrainingBranchDefinitions } from "../../lib/training-branch-definitions-api";
import type { TrainingBranchDefinitionResponse } from "../../lib/types";

const SETTINGS_QUERY_CACHE_MS = 5 * 60 * 1000;

export function TrainingBranchesSettingsSection() {
  const { showToast } = useToast();
  const t = useT();
  const queryClient = useQueryClient();
  const { user, permissions } = useAuth();
  const canManage = canManageArea(user, permissions, "settings");
  const canEditSystemFields = user?.isSuperAdmin === true;
  const [items, setItems] = useState<TrainingBranchDefinitionResponse[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<TrainingBranchDefinitionResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const branchesQuery = useQuery({
    gcTime: SETTINGS_QUERY_CACHE_MS,
    queryKey: ["settings", "training-branches", { activity: "all", page: 1, pageSize: 100 }, refreshKey],
    queryFn: ({ signal }) => getTrainingBranchDefinitions({ activity: "all", page: 1, pageSize: 100 }, signal),
    retry: false,
  });
  const loading = branchesQuery.isLoading;

  useEffect(() => {
    if (branchesQuery.data) {
      setItems(branchesQuery.data.items);
    }
  }, [branchesQuery.data]);

  useEffect(() => {
    if (branchesQuery.isError) {
      showToast(t("trainingBranchSettings.toast.loadFailed"), "error");
    }
  }, [branchesQuery.isError, showToast, t]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((item) => item.isActive).length,
      limited: items.filter(
        (item) => item.totalLessonHourLimit !== null
      ).length,
    };
  }, [items]);

  const closeForm = () => {
    setEditing(null);
    setFormOpen(false);
  };

  const handleSaved = () => {
    showToast(t("trainingBranchSettings.toast.updated"));
    closeForm();
    setRefreshKey((value) => value + 1);
    void queryClient.invalidateQueries({ queryKey: ["training", "branches"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "instructors"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["settings", "classrooms", "training-branches"] });
    void queryClient.invalidateQueries({ queryKey: ["instructors", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["instructors", "detail"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("trainingBranchSettings.summary.total")}</span>
            <strong className="settings-summary-value">{summary.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Aktif</span>
            <strong className="settings-summary-value">{summary.active}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Limitli</span>
            <strong className="settings-summary-value">{summary.limited}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">{t("trainingBranchSettings.list.title")}</div>
          </div>

          <div className="settings-panel-note">
            Branş kodları, sıralama ve saat limitleri sistem tarafından sabit tutulur. Sadece ad ve renk düzenlenebilir.
          </div>

          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Limitler</th>
                  <th>Renk</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SettingsTableSkeleton columns={[170, 120, 74, 72, 42]} rows={4} />
                ) : null}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Branş bulunamadı.</td>
                  </tr>
                ) : null}
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      Toplam {item.totalLessonHourLimit ?? "-"}
                    </td>
                    <td>
                      <span
                        className="settings-color-swatch"
                        style={{ backgroundColor: item.colorHex }}
                      />
                      {item.colorHex}
                    </td>
                    <td>
                      <StatusPill
                        label={item.isActive ? "Aktif" : "Pasif"}
                        status={item.isActive ? "success" : "manual"}
                      />
                    </td>
                    <td className="settings-table-actions">
                      <button
                        aria-label={t("common.edit")}
                        className="icon-button"
                        disabled={!canManage}
                        onClick={() => {
                          if (!canManage) return;
                          setEditing(item);
                          setFormOpen(true);
                        }}
                        title={!canManage ? t("common.noPermission") : t("common.edit")}
                        type="button"
                      >
                        <PencilIcon size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <TrainingBranchFormModal
        canManage={canManage}
        canEditSystemFields={canEditSystemFields}
        editing={editing}
        onClose={closeForm}
        onSaved={handleSaved}
        open={formOpen}
      />
    </>
  );
}
