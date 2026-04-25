import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useEffect, useState } from "react";

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

const STATUS_OPTIONS = [
  { value: "planned", label: "Planlandı" },
  { value: "completed", label: "Tamamlandı" },
];

export function TrainingEventDetailModal({
  event,
  instructors,
  onClose,
  onInstructorChange,
  onStatusChange,
  onNotesChange,
  onDelete,
}: TrainingEventDetailModalProps) {
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

  const editable = event !== null && !event.external;

  return (
    <Modal
      footer={
        confirmingDelete && editable && onDelete ? (
          <>
            <span className="training-event-delete-confirm">
              Silmek istediğine emin misin?
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setConfirmingDelete(false)}
              type="button"
            >
              İptal
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
              Evet, sil
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
                Sil
              </button>
            ) : null}
            <button className="btn btn-secondary" onClick={onClose} type="button">
              Kapat
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
          {event.external ? (
            <div className="training-event-external-banner">
              <strong>{event.sourceCalendar ?? "Başka takvim"}</strong>{" "}
              takviminden gelen kayıt — bu sayfadan düzenlenemez. Çakışma
              görünürlüğü için gölge olarak gösteriliyor.
            </div>
          ) : null}
          {event.external ? (
            <DrawerRow label="Kaynak Takvim">
              {event.sourceCalendar ?? "—"}
            </DrawerRow>
          ) : null}

          {event.kind === "uygulama" ? (
            <>
              <DrawerRow label="Aday">
                {event.candidateName ?? event.groupName}
              </DrawerRow>
              <DrawerRow label="Araç">{event.vehiclePlate ?? "—"}</DrawerRow>
            </>
          ) : (
            <>
              {event.external ? null : (
                <DrawerRow label="Dönem">{event.termName}</DrawerRow>
              )}
              <DrawerRow label="Grup">{event.groupName}</DrawerRow>
            </>
          )}

          {editable ? (
            <EditableRow
              displayValue={event.instructorName}
              inputValue={event.instructorId}
              label="Eğitmen"
              onSave={saveInstructor}
              options={instructorOptions}
            />
          ) : (
            <DrawerRow label="Eğitmen">{event.instructorName}</DrawerRow>
          )}

          {editable && onStatusChange ? (
            <EditableRow
              displayValue={event.status === "completed" ? "Tamamlandı" : "Planlandı"}
              inputValue={event.status ?? "planned"}
              label="Durum"
              onSave={saveStatus}
              options={STATUS_OPTIONS}
            />
          ) : (
            <DrawerRow label="Durum">
              {event.status === "completed" ? "Tamamlandı" : "Planlandı"}
            </DrawerRow>
          )}

          <DrawerRow label="Ehliyet Sınıfı">{event.licenseClass}</DrawerRow>
          <DrawerRow label="Tarih">{fmtDate(event.start)}</DrawerRow>
          <DrawerRow label="Saat">
            {fmtTime(event.start)} – {fmtTime(event.end)} ({durationHours(event.start, event.end)})
          </DrawerRow>
          {event.kind === "teorik" ? (
            <DrawerRow label="Aday Sayısı">{event.candidateCount}</DrawerRow>
          ) : null}
          {event.location ? <DrawerRow label="Yer">{event.location}</DrawerRow> : null}

          {editable && onNotesChange ? (
            <EditableRow
              displayValue={event.notes ?? "—"}
              inputValue={event.notes ?? ""}
              label="Not"
              onSave={saveNotes}
            />
          ) : event.notes ? (
            <DrawerRow label="Not">{event.notes}</DrawerRow>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
