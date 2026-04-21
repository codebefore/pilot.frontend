import { CandidatesPage } from "./CandidatesPage";
import { useT } from "../lib/i18n";

export function ExamDireksiyonPage() {
  const t = useT();

  return (
    <CandidatesPage
      columnStorageKey="exams.direksiyon.columns.v1"
      title={t("examDireksiyon.title")}
    />
  );
}
