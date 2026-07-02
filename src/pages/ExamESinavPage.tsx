import { CandidatesPage, type CandidateColumnId } from "./CandidatesPage";
import { useT } from "../lib/i18n";
import type { ESinavTabValue, GetCandidatesParams } from "../lib/candidates-api";

export function ExamESinavPage() {
  const t = useT();
  const defaultVisibleColumnIds: CandidateColumnId[] = [];
  const tabs: { key: ESinavTabValue; label: string }[] = [
    { key: "havuz", label: t("examESinav.tab.havuz") },
    { key: "basarisiz", label: t("examESinav.tab.basarisiz") },
    { key: "randevulu", label: t("examESinav.tab.randevulu") },
  ];
  const buildParams = (tab: string): Partial<GetCandidatesParams> => ({
    status: "active",
    eSinavTab: tab as ESinavTabValue,
  });

  return (
    <CandidatesPage
      columnStorageKey="exams.e-sinav.columns.v9"
      columnLabelOverrides={{
        eSinavAttemptCount: "Hak",
        eSinavScore: "Puan",
      }}
      defaultVisibleColumnIds={defaultVisibleColumnIds}
      examDateSidebar={{
        examType: "e_sinav",
        field: "eSinavDate",
        showTime: true,
        summaryMode: "candidateCount",
        title: t("candidates.col.eSinavDate"),
      }}
      groupColumnMode="term"
      showBulkGroupAction={false}
      showBulkStatusAction={true}
      showCreateCandidateAction={false}
      showFiltersAction={false}
      tabConfig={{
        tabs,
        defaultTab: "havuz",
        buildParams,
      }}
      title={t("examESinav.title")}
    />
  );
}
