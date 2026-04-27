import { useT } from "../../lib/i18n";
import type { GroupResponse, InstructorResponse } from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";

type QuickLessonAssignmentProps = {
  instructors: InstructorResponse[];
  groups: GroupResponse[];
  /** Takvimden seçilen slot — başlangıç saati panel'de gösterilir. */
  selectedSlot: { start: Date; end: Date } | null;
  /** Controlled: parent kontrol eder. */
  groupId: string;
  instructorId: string;
  /** Seçim değişikliğini parent'a (TrainingPage) iletiyor. */
  onSettingsChange: (params: { instructorId: string; groupId: string }) => void;
  isLoading?: boolean;
};

export function QuickLessonAssignment({
  instructors,
  groups,
  selectedSlot,
  groupId,
  instructorId,
  onSettingsChange,
  isLoading = false,
}: QuickLessonAssignmentProps) {
  const t = useT();
  const slotTime = selectedSlot
    ? selectedSlot.start.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="training-quick-assign">
      <div className="training-quick-assign-header">
        <span>{t("training.quick.header")}</span>
        {slotTime ? (
          <span className="training-quick-assign-slot">{slotTime}</span>
        ) : null}
      </div>

      <div className="form-group">
        <CustomSelect
          className="form-select"
          disabled={isLoading}
          onChange={(e) =>
            onSettingsChange({ groupId: e.target.value, instructorId })
          }
          value={groupId}
        >
          <option value="">{t("training.quick.groupPlaceholder")}</option>
          {/* Aktif aday'ı 0 olan gruplar atlanır (assignedCandidateCount
              kontenjan sayacı, gerçek atama değil). Sıralama: startDate
              desc (en güncel grup en üstte), tarih yoksa en sonda. */}
          {groups
            .filter((g) => g.activeCandidateCount > 0)
            .sort((a, b) => {
              if (!a.startDate && !b.startDate) {
                return a.title.localeCompare(b.title, "tr");
              }
              if (!a.startDate) return 1;
              if (!b.startDate) return -1;
              return b.startDate.localeCompare(a.startDate);
            })
            .map((group) => (
              <option key={group.id} value={group.id}>
                {/* "Nisan 2026 - 1A" → "Nisan - 1A" — yıl bilgisini kısalt. */}
                {group.title.replace(/\s+\d{4}/g, "")} (
                {group.activeCandidateCount})
              </option>
            ))}
        </CustomSelect>
      </div>

      <div className="form-group">
        <CustomSelect
          className="form-select"
          disabled={isLoading}
          onChange={(e) =>
            onSettingsChange({ groupId, instructorId: e.target.value })
          }
          value={instructorId}
        >
          <option value="">{t("training.quick.instructorPlaceholder")}</option>
          {/* Sadece teorik ders verebilen eğitmenler — en az bir teorik
              branşı olmalı (`practice` dışında). */}
          {instructors
            .filter((inst) => inst.branches.some((b) => b !== "practice"))
            .sort((a, b) => a.firstName.localeCompare(b.firstName, "tr"))
            .map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.firstName} {inst.lastName}
              </option>
            ))}
        </CustomSelect>
      </div>
    </div>
  );
}
