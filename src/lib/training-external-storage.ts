import type {
  TrainingCalendarEvent,
  TrainingEventKind,
} from "./training-calendar";
import type { InstructorResponse } from "./types";

// Backend'de henüz "başka takvim" konsepti yok. Bakım, idari toplantı,
// sınav komisyonu vb. kayıtları geçici olarak frontend'de tutuyoruz —
// salt-okunur gölge olarak takvime düşer, çakışma görünürlüğünü
// sağlar. Backend tarafına Source field'ı eklendiğinde bu modül
// silinecek.
//
// localStorage'da spec listesi tutulur (göreceli tarihler değil,
// `dayOffset` bugüne göre çözülür). İlk açılışta varsayılan seed
// yazılır; kullanıcı el ile temizlerse veya tarayıcı verisi
// silinirse seed yeniden gelir.

const KEY = (kind: TrainingEventKind) => `pilot.training.external.${kind}`;

type ExternalSpec = {
  id: string;
  dayOffset: number;
  startHour: number;
  startMinute?: number;
  durationHours: number;
  /** instructors dizisinin index'i — backend kataloğundaki eğitmenle bağlanır. */
  instructorIndex: number;
  groupName: string;
  licenseClass: string;
  candidateCount: number;
  candidateName?: string;
  vehiclePlate?: string;
  notes?: string;
  sourceCalendar: string;
};

const buildDefaultTheoryExternals = (): ExternalSpec[] => [
  // Uygulama eğitim slotları (Direksiyon Slot)
  { id: "t-ext-1", dayOffset: 0, startHour: 13, durationHours: 1, instructorIndex: 4, groupName: "Direksiyon Slot", licenseClass: "B", candidateCount: 1, sourceCalendar: "Uygulama Eğitim" },
  { id: "t-ext-2", dayOffset: 1, startHour: 11, durationHours: 1, instructorIndex: 0, groupName: "Direksiyon Slot", licenseClass: "B", candidateCount: 1, sourceCalendar: "Uygulama Eğitim" },
  { id: "t-ext-3", dayOffset: 2, startHour: 13, durationHours: 1, instructorIndex: 4, groupName: "Direksiyon Slot", licenseClass: "C", candidateCount: 1, sourceCalendar: "Uygulama Eğitim" },
  { id: "t-ext-4", dayOffset: 3, startHour: 14, durationHours: 2, instructorIndex: 2, groupName: "Direksiyon Slot", licenseClass: "B", candidateCount: 2, sourceCalendar: "Uygulama Eğitim" },
  { id: "t-ext-5", dayOffset: 7, startHour: 14, startMinute: 30, durationHours: 1, instructorIndex: 0, groupName: "Direksiyon Slot", licenseClass: "B", candidateCount: 1, sourceCalendar: "Uygulama Eğitim" },
  // Diğer takvim çeşitleri
  { id: "t-ext-6", dayOffset: 4, startHour: 9, durationHours: 1, instructorIndex: 1, groupName: "Bakım", licenseClass: "B", candidateCount: 0, sourceCalendar: "Bakım" },
  { id: "t-ext-7", dayOffset: -2, startHour: 14, durationHours: 1, instructorIndex: 0, groupName: "Aylık Toplantı", licenseClass: "B", candidateCount: 0, sourceCalendar: "İdari" },
  { id: "t-ext-8", dayOffset: 1, startHour: 16, startMinute: 30, durationHours: 1, instructorIndex: 2, groupName: "Sınav Görevi", licenseClass: "B", candidateCount: 0, sourceCalendar: "Sınav Komisyonu" },
  { id: "t-ext-9", dayOffset: 5, startHour: 13, durationHours: 2, instructorIndex: 4, groupName: "Saha Eğitimi", licenseClass: "C", candidateCount: 8, sourceCalendar: "Saha" },
  { id: "t-ext-10", dayOffset: 8, startHour: 9, startMinute: 30, durationHours: 1, instructorIndex: 3, groupName: "Yıllık İzin", licenseClass: "B", candidateCount: 0, sourceCalendar: "İzin" },
  { id: "t-ext-11", dayOffset: 10, startHour: 11, durationHours: 1, instructorIndex: 1, groupName: "Araç Kontrolü", licenseClass: "B", candidateCount: 0, sourceCalendar: "Bakım" },
];

const buildDefaultPracticeExternals = (): ExternalSpec[] => [
  { id: "p-ext-1", dayOffset: -1, startHour: 14, durationHours: 1, instructorIndex: 1, groupName: "—", licenseClass: "B", candidateCount: 0, vehiclePlate: "—", sourceCalendar: "Bakım" },
  { id: "p-ext-2", dayOffset: 2, startHour: 13, durationHours: 1, instructorIndex: 2, groupName: "—", licenseClass: "B", candidateCount: 0, vehiclePlate: "—", sourceCalendar: "Teorik" },
  { id: "p-ext-3", dayOffset: 4, startHour: 13, startMinute: 30, durationHours: 1, instructorIndex: 0, groupName: "—", licenseClass: "B", candidateCount: 0, vehiclePlate: "—", sourceCalendar: "İdari" },
  { id: "p-ext-4", dayOffset: 7, startHour: 15, durationHours: 1, instructorIndex: 3, groupName: "—", licenseClass: "A2", candidateCount: 0, vehiclePlate: "—", sourceCalendar: "İzin" },
];

const buildDefaultExternals = (kind: TrainingEventKind): ExternalSpec[] =>
  kind === "teorik" ? buildDefaultTheoryExternals() : buildDefaultPracticeExternals();

const loadSpecs = (kind: TrainingEventKind): ExternalSpec[] => {
  try {
    const raw = localStorage.getItem(KEY(kind));
    if (raw) {
      const parsed = JSON.parse(raw) as ExternalSpec[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Bozuk JSON → seed'e düş.
  }
  const defaults = buildDefaultExternals(kind);
  try {
    localStorage.setItem(KEY(kind), JSON.stringify(defaults));
  } catch {
    // Quota / private mode → sessiz geç.
  }
  return defaults;
};

const specToEvent = (
  spec: ExternalSpec,
  kind: TrainingEventKind,
  instructors: InstructorResponse[]
): TrainingCalendarEvent | null => {
  if (instructors.length === 0) return null;
  const inst = instructors[spec.instructorIndex % instructors.length];
  const instructorName = `${inst.firstName} ${inst.lastName}`.trim();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() + spec.dayOffset);
  start.setHours(spec.startHour, spec.startMinute ?? 0, 0, 0);
  const end = new Date(start.getTime() + spec.durationHours * 60 * 60 * 1000);

  return {
    id: `external-${kind}-${spec.id}`,
    title: `${spec.sourceCalendar}: ${spec.groupName}`,
    start,
    end,
    kind,
    instructorId: inst.id,
    instructorName,
    termName: "",
    groupName: spec.groupName,
    licenseClass: spec.licenseClass,
    candidateCount: spec.candidateCount,
    candidateName: spec.candidateName,
    vehiclePlate: spec.vehiclePlate,
    notes: spec.notes,
    external: true,
    sourceCalendar: spec.sourceCalendar,
  };
};

/**
 * Belirtilen kind için external (gölge) event'leri döner. Backend
 * instructor kataloğu boşsa (henüz yüklenmediyse) boş dizi döner.
 */
export const loadExternalEvents = (
  kind: TrainingEventKind,
  instructors: InstructorResponse[]
): TrainingCalendarEvent[] => {
  if (instructors.length === 0) return [];
  return loadSpecs(kind)
    .map((spec) => specToEvent(spec, kind, instructors))
    .filter((event): event is TrainingCalendarEvent => event !== null);
};
