import { useNavigate } from "react-router-dom";

import { PageTabs } from "../layout/PageToolbar";
import { CashRegistersSettingsSection } from "./CashRegistersSettingsSection";
import { CashMovementCategoriesSettingsSection } from "./CashMovementCategoriesSettingsSection";

export type FinanceSettingsTab = "cash-registers" | "movement-categories";

export function FinanceSettingsSection({ tab }: { tab: FinanceSettingsTab }) {
  const navigate = useNavigate();
  return (
    <div className="settings-section-stack">
      <PageTabs
        active={tab}
        onChange={(next) => navigate(`/settings/finance/${next}`)}
        tabs={[
          { key: "cash-registers", label: "Kasalar" },
          { key: "movement-categories", label: "Gelir/Gider Kalemleri" },
        ]}
      />
      {tab === "cash-registers" ? (
        <CashRegistersSettingsSection />
      ) : (
        <CashMovementCategoriesSettingsSection />
      )}
    </div>
  );
}
