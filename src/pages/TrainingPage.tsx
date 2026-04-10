import { useState } from "react";

import { PageToolbar } from "../components/layout/PageToolbar";
import { NewTrainingPlanModal } from "../components/modals/NewTrainingPlanModal";
import { DocProgress } from "../components/ui/DocProgress";
import { DrawerRow } from "../components/ui/Drawer";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { mockTrainingPlans } from "../mock/training";

export function TrainingPage() {
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
            Yeni Plan
          </button>
        }
        title="Eğitim Planı"
      />

      <div className="groups-grid">
        {mockTrainingPlans.map((plan) => (
          <Panel key={plan.id} padded title={plan.title}>
            <DrawerRow label="Eğitmen">{plan.instructor}</DrawerRow>
            {plan.vehicle && <DrawerRow label="Araç">{plan.vehicle}</DrawerRow>}
            <DrawerRow label="Toplam Saat">{plan.totalHours}</DrawerRow>
            <DrawerRow label="Atanmış Aday">{plan.assigned}</DrawerRow>
            {plan.progress !== undefined && (
              <DrawerRow label="İlerleme">
                <DocProgress
                  done={plan.progress}
                  label={`%${plan.progress}`}
                  total={100}
                />
              </DrawerRow>
            )}
          </Panel>
        ))}
      </div>

      <NewTrainingPlanModal
        onClose={() => setModalOpen(false)}
        onSubmit={() => {
          setModalOpen(false);
          showToast("Eğitim planı oluşturuldu");
        }}
        open={modalOpen}
      />
    </>
  );
}
