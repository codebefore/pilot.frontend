import { useState } from "react";

import { PlusIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { NewGroupModal } from "../components/modals/NewGroupModal";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { mockGroups } from "../mock/groups";

export function GroupsPage() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

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

      <div className="groups-grid">
        {mockGroups.map((group) => (
          <Panel
            action={<StatusPill label={group.statusLabel} status={group.status} />}
            key={group.id}
            title={group.name}
          >
            <div className="group-body">
              <div className="drawer-row">
                <span className="label">Kontenjan</span>
                <span className="value">
                  {group.capacityFilled} / {group.capacityTotal}
                </span>
              </div>
              <div className="drawer-row">
                <span className="label">Başlangıç</span>
                <span className="value">{group.startDate}</span>
              </div>
              <div className="drawer-row">
                <span className="label">Bitiş</span>
                <span className="value">{group.endDate}</span>
              </div>
              <div className="drawer-row">
                <span className="label">MEB Durumu</span>
                <span className="value">
                  <StatusPill label={group.mebStatusLabel} status={group.mebStatus} />
                </span>
              </div>
              <div className="group-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => showToast(`${group.name} detayı açıldı`)}
                  type="button"
                >
                  Detay
                </button>
                {group.canAddCandidate && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => showToast(`${group.name} için aday ekleme açıldı`)}
                    type="button"
                  >
                    Aday Ekle
                  </button>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <NewGroupModal
        onClose={() => setModalOpen(false)}
        onSubmit={() => {
          setModalOpen(false);
          showToast("Grup başarıyla oluşturuldu");
        }}
        open={modalOpen}
      />
    </>
  );
}
