import { CandidatesPage } from "./CandidatesPage";
import { useT } from "../lib/i18n";
import type { ESinavTabValue, GetCandidatesParams } from "../lib/candidates-api";

export function ExamESinavPage() {
  const t = useT();
  const tabs: { key: ESinavTabValue; label: string }[] = [
    { key: "havuz", label: t("examESinav.tab.havuz") },
    { key: "basarisiz", label: t("examESinav.tab.basarisiz") },
    { key: "randevulu", label: t("examESinav.tab.randevulu") },
  ];
  const buildParams = (tab: string): Partial<GetCandidatesParams> => ({
    eSinavTab: tab as ESinavTabValue,
  });

  return (
    <CandidatesPage
      columnStorageKey="exams.e-sinav.columns.v1"
      groupColumnMode="term"
      tabConfig={{
        tabs,
        defaultTab: "havuz",
        buildParams,
      }}
      title={t("examESinav.title")}
    />
  );
}
