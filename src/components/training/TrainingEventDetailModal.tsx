import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";

import { useT } from "../../lib/i18n";
import type { TrainingCalendarEvent } from "../../lib/training-calendar";
import type { TrainingLessonStatus } from "../../lib/types";
import { DrawerRow } from "../ui/Drawer";
import { EditableRow } from "../ui/EditableRow";
import { Modal } from "../ui/Modal";

type InstructorOption = { id: string; name: string };

type TrainingEventDetailModalProps = {
  event: TrainingCalendarEvent | null;
  instructors: InstructorOption[];
  onClose: () => void;
  onInstructorChange?: (eventId: string, instructorId: string, instructorName: string) => void;
  onStatusChange?: (eventId: string, status: TrainingLessonStatus) => Promise<void> | void;
  onNotesChange?: (eventId: string, notes: string) => Promise<void> | void;
  onDelete?: (event: TrainingCalendarEvent) => Promise<void> | void;
};

const fmtDate = (d: Date) => format(d, "d MMMM yyyy, EEEE", { locale: tr });
const fmtTime = (d: Date) => format(d, "HH:mm", { locale: tr });
const durationHours = (start: Date, end: Date) => {
  const diffMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
};

export function TrainingEventDetailModal({
  event,
  instructors,
  onClose,
  onInstructorChange,
  onStatusChange,
  onNotesChange,
  onDelete,
}: TrainingEventDetailModalProps) {
  const t = useT();
  const STATUS_OPTIONS = useMemo(
    () => [
      { value: "planned", label: t("training.modal.statusPlanned") },
      { value: "completed", label: t("training.modal.statusCompleted") },
    ],
    [t]
  );
  const instructorOptions = instructors.map((i) => ({ value: i.id, label: i.name }));

  const saveInstructor = async (newId: string) => {
    if (!event || !onInstructorChange) return;
    const match = instructors.find((i) => i.id === newId);
    if (!match) return;
    onInstructorChange(event.id, match.id, match.name);
  };

  const saveStatus = async (newValue: string) => {
    if (!event || !onStatusChange) return;
    if (newValue !== "planned" && newValue !== "completed") return;
    await onStatusChange(event.id, newValue);
  };

  const saveNotes = async (newValue: string) => {
    if (!event || !onNotesChange) return;
    await onNotesChange(event.id, newValue);
  };

  // Silme onayı inline — "Sil" tıklanınca footer "Emin misiniz?
  // İptal / Evet, sil" moduna geçer. Browser native confirm'e gerek yok.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Modal kapandığında veya farklı event seçildiğinde confirm state'i
  // karışmasın diye sıfırla.
  useEffect(() => {
    setConfirmingDelete(false);
  }, [event?.id]);

  const editable = event !== null;

  return (
    <Modal
      footer={
        confirmingDelete && editable && onDelete ? (
          <>
            <span className="training-event-delete-confirm">
              {t("training.detail.deleteConfirm")}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setConfirmingDelete(false)}
              type="button"
            >
              {t("training.detail.cancel")}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (!event) return;
                setConfirmingDelete(false);
                void onDelete(event);
              }}
              type="button"
            >
              {t("training.detail.confirmDelete")}
            </button>
          </>
        ) : (
          <>
            {editable && onDelete ? (
              <button
                className="btn btn-danger"
                onClick={() => setConfirmingDelete(true)}
                style={{ marginRight: "auto" }}
                type="button"
              >
                {t("training.detail.delete")}
              </button>
            ) : null}
            <button className="btn btn-secondary" onClick={onClose} type="button">
              {t("training.detail.close")}
            </button>
          </>
        )
      }
      onClose={onClose}
      open={event !== null}
      title={event?.title ?? ""}
    >
      {event ? (
        <div className="training-event-modal-body">
          {event.kind === "uygulama" ? (
            <>
              <DrawerRow label={t("training.detail.field.candidate")}>
                {event.candidateName ?? event.groupName}
              </DrawerRow>
              <DrawerRow label={t("training.detail.field.vehicle")}>
                {event.vehiclePlate ?? "—"}
              </DrawerRow>
            </>
          ) : (
            <>
              <DrawerRow label={t("training.detail.field.term")}>
                {event.termName}
              </DrawerRow>
	              <DrawerRow label={t("training.detail.field.group")}>
	                {event.groupName}
	              </DrawerRow>
		              {event.location ? (
		                <DrawerRow label={t("training.detail.field.location")}>
		                  {event.location}
		                </DrawerRow>
	              ) : null}
	            </>
	          )}

          <EditableRow
            displayValue={event.instructorName}
            inputValue={event.instructorId}
            label={t("training.detail.field.instructor")}
            onSave={saveInstructor}
            options={instructorOptions}
          />

          {onStatusChange ? (
            <EditableRow
              displayValue={
                event.status === "completed"
                  ? t("training.modal.statusCompleted")
                  : t("training.modal.statusPlanned")
              }
              inputValue={event.status ?? "planned"}
              label={t("training.detail.field.status")}
              onSave={saveStatus}
              options={STATUS_OPTIONS}
            />
          ) : (
            <DrawerRow label={t("training.detail.field.status")}>
              {event.status === "completed"
                ? t("training.modal.statusCompleted")
                : t("training.modal.statusPlanned")}
            </DrawerRow>
          )}

          <DrawerRow label={t("training.detail.field.licenseClass")}>
            {event.licenseClass}
          </DrawerRow>
          <DrawerRow label={t("training.detail.field.date")}>
            {fmtDate(event.start)}
          </DrawerRow>
          <DrawerRow label={t("training.detail.field.time")}>
            {fmtTime(event.start)} – {fmtTime(event.end)} ({durationHours(event.start, event.end)})
          </DrawerRow>
          {event.kind === "teorik" ? (
            <DrawerRow label={t("training.detail.field.candidateCount")}>
              {event.candidateCount}
            </DrawerRow>
          ) : null}
	          {event.kind !== "teorik" && event.location ? (
	            <DrawerRow label={t("training.detail.field.location")}>
	              {event.location}
	            </DrawerRow>
          ) : null}

          {editable && onNotesChange ? (
            <EditableRow
              displayValue={event.notes ?? "—"}
              inputValue={event.notes ?? ""}
              label={t("training.detail.field.notes")}
              onSave={saveNotes}
            />
          ) : event.notes ? (
            <DrawerRow label={t("training.detail.field.notes")}>{event.notes}</DrawerRow>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
