import { format, getDay, parse, startOfWeek } from "date-fns";
import { tr } from "date-fns/locale";
import { dateFnsLocalizer, type Messages } from "react-big-calendar";
import type {
  TrainingLessonResponse,
  TrainingLessonStatus,
  TrainingLessonUpsertRequest,
} from "./types";

// Pazartesi başlangıç: Türkiye için standart. `weekStartsOn: 1` RBC'nin
// `getFirstVisibleDay`/`startOfWeek` çağrılarını da etkiler — locale'i hem
// `format` hem `startOfWeek` için aynı obje üzerinden veriyoruz ki
// inconsistency olmasın.
const locales = { tr };

export const trainingLocalizer = dateFnsLocalizer({
  format: (date: Date, fmt: string) =>
    format(date, fmt, { locale: tr, weekStartsOn: 1 }),
  parse: (value: string, fmt: string) =>
    parse(value, fmt, new Date(), { locale: tr, weekStartsOn: 1 }),
  startOfWeek: () => startOfWeek(new Date(), { locale: tr, weekStartsOn: 1 }),
  getDay,
  locales,
});

// dateFnsLocalizer default `timeGutterFormat: 'p'` (locale-aware time)
// kullanır. TR locale'inde bu doğru "HH:mm" üretir AMA `Calendar`'a
// `formats` prop'u versek bile RBC bazı durumlarda gutter'ı render
// ederken localizer'ın kendi `formats`'ına başvuruyor. Mutasyon yerine
// güvenli yer: localizer üzerine doğrudan `formats` koymak. RBC bunu
// her render'da okuyor.
//
// Aşağıda override sadece "saat gutter" için 24-saat HH:mm; diğer
// formatlar default kalsın diye merge ediyoruz.
trainingLocalizer.formats = {
  ...trainingLocalizer.formats,
  timeGutterFormat: "HH:mm",
};

export const trainingCalendarMessages: Messages = {
  date: "Tarih",
  time: "Saat",
  event: "Etkinlik",
  allDay: "Tüm gün",
  week: "Hafta",
  work_week: "İş haftası",
  day: "Gün",
  month: "Ay",
  previous: "Önceki",
  next: "Sonraki",
  yesterday: "Dün",
  tomorrow: "Yarın",
  today: "Bugün",
  agenda: "Ajanda",
  noEventsInRange: "Bu aralıkta ders yok.",
  showMore: (total) => `+${total} daha`,
};

export type TrainingEventKind = "teorik" | "uygulama";

export type TrainingCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  kind: TrainingEventKind;
  status?: TrainingLessonStatus;
  rowVersion?: number;
  instructorId: string;
  instructorName: string;
  groupId?: string | null;
  termName: string;
  groupName: string;
  // Ehliyet sınıfı teorik derste başlıkta kullanılmaz ama event metadata
  // olarak taşınıyor (rozet, filtre, vb. için). Grubun sınıfıyla eşleşir.
  licenseClass: string;
  candidateCount: number;
  location?: string;
  notes?: string;
  /**
   * Başka bir takvimden (örn. uygulama eğitim, bakım takvimi) gelen
   * event. Bu takvimde **salt-okunur gölge** olarak gösterilir; çakışma
   * görünürlüğünü artırır ama düzenlenemez/sürüklenemez.
   */
  external?: boolean;
  /** External event'in kaynak takvim adı — modalda gösterilir. */
  sourceCalendar?: string;
  /**
   * Uygulama eğitiminde bir event 1 aday + 1 araç + 1 eğitmen birleşimi
   * olduğundan aday adı ve plaka burada tutulur. Teorik takvimde
   * `candidateName` boştur (zaten group + count yapısı var).
  */
  candidateName?: string;
  candidateId?: string | null;
  vehiclePlate?: string;
  vehicleId?: string | null;
  areaId?: string | null;
  routeId?: string | null;
  licenseClassCounts?: TrainingLessonResponse["licenseClassCounts"];
};

const joinLicenseClasses = (lesson: TrainingLessonResponse): string => {
  if (lesson.licenseClass) return lesson.licenseClass;
  if (lesson.licenseClassCounts.length === 0) return "-";
  return lesson.licenseClassCounts
    .map((item) => `${item.licenseClass} (${item.count})`)
    .join(", ");
};

export function trainingLessonToCalendarEvent(
  lesson: TrainingLessonResponse
): TrainingCalendarEvent {
  const start = new Date(lesson.startAtUtc);
  const end = new Date(lesson.endAtUtc);
  const isPractice = lesson.kind === "uygulama";
  const groupName = isPractice
    ? lesson.vehiclePlate ?? "Araç seçilmedi"
    : lesson.groupTitle ?? "Grup seçilmedi";
  const title = isPractice
    ? groupName
    : `${lesson.termName ?? "Dönem"} — ${groupName}`;

  return {
    id: lesson.id,
    title,
    start,
    end,
    kind: lesson.kind,
    status: lesson.status,
    rowVersion: lesson.rowVersion,
    instructorId: lesson.instructorId,
    instructorName: lesson.instructorName,
    groupId: lesson.groupId,
    termName: lesson.termName ?? "-",
    groupName,
    licenseClass: joinLicenseClasses(lesson),
    candidateCount: lesson.candidateCount,
    location: lesson.areaName ?? lesson.routeName ?? undefined,
    notes: lesson.notes ?? undefined,
    candidateName: lesson.candidateName ?? undefined,
    candidateId: lesson.candidateId,
    vehiclePlate: lesson.vehiclePlate ?? undefined,
    vehicleId: lesson.vehicleId,
    areaId: lesson.areaId,
    routeId: lesson.routeId,
    licenseClassCounts: lesson.licenseClassCounts,
  };
}

export function calendarEventToTrainingLessonRequest(
  event: TrainingCalendarEvent,
  overrides: Partial<TrainingLessonUpsertRequest> = {}
): TrainingLessonUpsertRequest {
  return {
    kind: event.kind,
    status: event.status ?? "planned",
    startAtUtc: event.start.toISOString(),
    endAtUtc: event.end.toISOString(),
    instructorId: event.instructorId,
    groupId: event.kind === "teorik" ? event.groupId ?? null : null,
    candidateId: event.kind === "uygulama" ? event.candidateId ?? null : null,
    vehicleId: event.kind === "uygulama" ? event.vehicleId ?? null : null,
    areaId: event.areaId ?? null,
    routeId: event.routeId ?? null,
    licenseClass: event.licenseClass === "-" ? null : event.licenseClass,
    notes: event.notes ?? null,
    rowVersion: event.rowVersion,
    ...overrides,
  };
}
