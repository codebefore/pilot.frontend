import { CandidatesPage, type CandidateColumnId } from "./CandidatesPage";
import { useT } from "../lib/i18n";
import type { CandidateExamTabValue, GetCandidatesParams } from "../lib/candidates-api";

export function ExamUygulamaPage() {
  const t = useT();
  const defaultVisibleColumnIds: CandidateColumnId[] = [];
  const tabs: { key: CandidateExamTabValue; label: string }[] = [
    { key: "havuz", label: t("examESinav.tab.havuz") },
    { key: "basarisiz", label: t("examESinav.tab.basarisiz") },
    { key: "randevulu", label: t("examESinav.tab.randevulu") },
  ];
  const buildParams = (tab: string): Partial<GetCandidatesParams> => ({
    status: "active",
    drivingExamTab: tab as CandidateExamTabValue,
  });

  return (
    <CandidatesPage
      columnStorageKey="exams.uygulama.columns.v9"
      columnLabelOverrides={{
        drivingExamDate: "Tarih",
        drivingExamAttemptCount: "Hak",
        drivingExamAttendanceStatus: "Sınav Durumu",
        drivingExamResultStatus: "Sınav Sonucu",
      }}
      defaultVisibleColumnIds={defaultVisibleColumnIds}
      excludePenaltyPointsFromExamLists
      examDateSidebar={{
        examType: "uygulama",
        field: "drivingExamDate",
        showLicenseClassInHeader: true,
        showTime: false,
        summaryMode: "capacity",
        title: t("candidates.col.drivingExamDate"),
      }}
      groupColumnMode="term"
      showBulkGroupAction={false}
      showBulkStatusAction={true}
      showCreateCandidateAction={false}
      showFiltersAction={false}
      showTabCounts={true}
      tabConfig={{
        tabs,
        defaultTab: "havuz",
        buildParams,
      }}
      title={t("examUygulama.title")}
    />
  );
}
