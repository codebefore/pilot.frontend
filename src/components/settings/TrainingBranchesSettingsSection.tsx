import { useEffect, useMemo, useState } from "react";

import { PencilIcon } from "../icons";
import { TrainingBranchFormModal } from "../modals/TrainingBranchFormModal";
import { StatusPill } from "../ui/StatusPill";
import { useToast } from "../ui/Toast";
import { getTrainingBranchDefinitions } from "../../lib/training-branch-definitions-api";
import type { TrainingBranchDefinitionResponse } from "../../lib/types";

export function TrainingBranchesSettingsSection() {
  const { showToast } = useToast();
  const [items, setItems] = useState<TrainingBranchDefinitionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<TrainingBranchDefinitionResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getTrainingBranchDefinitions(
      { activity: "all", page: 1, pageSize: 100 },
      controller.signal
    )
      .then((response) => setItems(response.items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast("Branş listesi yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey, showToast]);

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
    showToast("Branş güncellendi");
    closeForm();
    setRefreshKey((value) => value + 1);
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">Toplam Branş</span>
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
            <div className="settings-surface-title">Branş Listesi</div>
          </div>

          <div className="settings-panel-note">
            Toplam limitler aynı grup/şube içindeki teorik dersler için uygulanır.
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
                  <tr>
                    <td colSpan={5}>Yükleniyor...</td>
                  </tr>
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
                        className="icon-button"
                        onClick={() => {
                          setEditing(item);
                          setFormOpen(true);
                        }}
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
        editing={editing}
        onClose={closeForm}
        onSaved={handleSaved}
        open={formOpen}
      />
    </>
  );
}
