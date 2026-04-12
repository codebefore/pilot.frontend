import { useEffect, useState } from "react";

import { PlusIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { GroupDrawer } from "../components/drawers/GroupDrawer";
import { NewGroupModal } from "../components/modals/NewGroupModal";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { getGroups } from "../lib/groups-api";
import {
  formatDateTR,
  groupMebStatusLabel,
  groupMebStatusToPill,
  groupStatusLabel,
  groupStatusToPill,
} from "../lib/status-maps";
import type { GroupResponse } from "../lib/types";

export function GroupsPage() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);

    getGroups({ pageSize: 100 }, controller.signal)
      .then((result) => {
        setGroups(result.items);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast("Gruplar yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [refreshKey, showToast]);

  const handleGroupCreated = () => {
    setModalOpen(false);
    showToast("Grup başarıyla oluşturuldu");
    setRefreshKey((k) => k + 1);
  };

  const handleGroupUpdated = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <PageToolbar
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setModalOpen(true)}
            type="button"
          >
            <PlusIcon size={14} />
            Yeni Grup
          </button>
        }
        title="Gruplar / Dönemler"
      />

      {loading ? (
        <div className="groups-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="panel" key={i}>
              <div className="panel-header">
                <span className="skeleton" style={{ width: `${130 + (i * 41) % 80}px`, height: 14 }} />
                <span className="skeleton skeleton-pill" style={{ width: 56 }} />
              </div>
              <div className="group-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[70, 88, 88, 64].map((w, j) => (
                  <div className="drawer-row" key={j}>
                    <span className="skeleton" style={{ width: w }} />
                    <span className="skeleton" style={{ width: `${60 + (i + j) * 13 % 40}px` }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="data-table-empty" style={{ padding: "48px 0", textAlign: "center" }}>
          Henüz grup oluşturulmamış.
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => (
            <div
              className="panel group-card"
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
            >
              <div className="panel-header">
                <span className="panel-title">{group.title}</span>
                <StatusPill
                  label={groupStatusLabel(group.status)}
                  status={groupStatusToPill(group.status)}
                />
              </div>
              <div className="group-body">
                <div className="drawer-row">
                  <span className="label">Kontenjan</span>
                  <span className="value">
                    {group.assignedCandidateCount} / {group.capacity}
                  </span>
                </div>
                <div className="drawer-row">
                  <span className="label">Başlangıç</span>
                  <span className="value">{formatDateTR(group.startDate)}</span>
                </div>
                <div className="drawer-row">
                  <span className="label">Bitiş</span>
                  <span className="value">{formatDateTR(group.endDate)}</span>
                </div>
                <div className="drawer-row">
                  <span className="label">MEB Durumu</span>
                  <span className="value">
                    <StatusPill
                      label={groupMebStatusLabel(group.mebStatus)}
                      status={groupMebStatusToPill(group.mebStatus)}
                    />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewGroupModal
        onClose={() => setModalOpen(false)}
        onSubmit={handleGroupCreated}
        open={modalOpen}
      />

      <GroupDrawer
        groupId={selectedGroupId}
        onClose={() => setSelectedGroupId(null)}
        onUpdated={handleGroupUpdated}
      />
    </>
  );
}
