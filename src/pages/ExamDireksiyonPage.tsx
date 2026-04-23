import { CandidatesPage, type CandidateColumnId } from "./CandidatesPage";
import { useT } from "../lib/i18n";
import type { CandidateExamTabValue, GetCandidatesParams } from "../lib/candidates-api";

export function ExamDireksiyonPage() {
  const t = useT();
  const defaultVisibleColumnIds: CandidateColumnId[] = [
    "photo",
    "name",
    "nationalId",
    "group",
    "drivingExamDate",
    "drivingExamAttemptCount",
    "mebSyncStatus",
    "examFeePaid",
    "status",
  ];
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
      columnStorageKey="exams.direksiyon.columns.v3"
      columnLabelOverrides={{
        drivingExamDate: "Tarih",
        drivingExamAttemptCount: "Hak",
      }}
      defaultVisibleColumnIds={defaultVisibleColumnIds}
      examDateSidebar={{
        examType: "direksiyon",
        field: "drivingExamDate",
        showLicenseClassTotalSummary: true,
        showTime: false,
        summaryMode: "capacity",
        title: t("candidates.col.drivingExamDate"),
      }}
      tabConfig={{
        tabs,
        defaultTab: "havuz",
        buildParams,
      }}
      title={t("examDireksiyon.title")}
    />
  );
}
