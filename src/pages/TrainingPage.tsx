import { useState } from "react";

import { PageToolbar } from "../components/layout/PageToolbar";
import { NewTrainingPlanModal } from "../components/modals/NewTrainingPlanModal";
import { DocProgress } from "../components/ui/DocProgress";
import { DrawerRow } from "../components/ui/Drawer";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { mockTrainingPlans } from "../mock/training";

type TrainingPageProps = {
  type: "teorik" | "uygulama";
};

export function TrainingPage({ type }: TrainingPageProps) {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const plans = mockTrainingPlans.filter((plan) => plan.type === type);
  const title = type === "teorik" ? "Teorik Eğitim Planı" : "Uygulama Eğitim Planı";

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
        title={title}
      />

      <div className="groups-grid">
        {plans.map((plan) => (
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
        defaultType={type}
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
