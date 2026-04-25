import { useMemo, useState, type ComponentType } from "react";
import { Calendar, type View } from "react-big-calendar";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

import {
  trainingCalendarMessages,
  trainingLocalizer,
  type TrainingCalendarEvent,
  type TrainingEventKind,
} from "../../lib/training-calendar";
import {
  RollingFourWeeksView,
  RollingThreeWeeksView,
  RollingTwoWeeksView,
  RollingWeekView,
} from "./RollingWeekView";

// RBC DnD HOC ile Calendar'ı sar — resize/drop callback'leri aktif olur.
// @types'ın `Event` base tipi bizim TrainingCalendarEvent için gevşek;
// HOC girişini (CalendarProps<Event>) loose tipe, çıkışını da tüm
// prop'ları serbest kabul eden loose ComponentType'a düşürüyoruz (RBC
// zaten runtime'da hepsini takip ediyor).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop(Calendar as any) as unknown as ComponentType<
  Record<string, unknown>
>;

type TrainingCalendarProps = {
  events: TrainingCalendarEvent[];
  /**
   * Takvim sadece aynı tip etkinlikleri (teorik veya uygulama) gösterir,
   * ama event objesi zaten `kind` taşıyor — gelecekte tek takvimde iki
   * tip render edilirse renk için kullanırız.
   */
  kind: TrainingEventKind;
  onSelectEvent?: (event: TrainingCalendarEvent) => void;
  onSelectSlot?: (slot: { start: Date; end: Date }) => void;
  /** Event alt/üst kenarından resize edilince çağrılır. */
  onEventResize?: (args: { event: TrainingCalendarEvent; start: Date; end: Date }) => void;
  /** Event body'sinden sürüklenip başka slota bırakılınca çağrılır. */
  onEventDrop?: (args: { event: TrainingCalendarEvent; start: Date; end: Date }) => void;
};

// Custom view key'lerimiz — RBC `Views` enum'unda yok, ama `views` map'ine
// herhangi bir string anahtar verilebiliyor. Toolbar etiketleri
// `messages` üzerinden çevrilir.
const ROLLING_2W_VIEW = "rolling2w" as View;


const ROLLING_MESSAGES = {
  ...trainingCalendarMessages,
  // RBC `messages[viewName]` ile view butonu etiketini çeker.
  rolling: "Hafta",
  rolling2w: "2 Hafta",
  rolling3w: "3 Hafta",
  rolling4w: "4 Hafta",
};

// 24-saat Türkçe format. RBC default `timeGutterFormat` "h:mm a" (12-saat
// AM/PM) — TR locale'de tuhaf görünüyor. `formats` Calendar prop'u
// localizer'daki `format` callback'ine düşüyor; date-fns pattern'leri
// burada kullanılıyor.
const CALENDAR_FORMATS = {
  timeGutterFormat: "HH:mm",
  eventTimeRangeFormat: () => "",
  agendaTimeFormat: "HH:mm",
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }, culture?: string, localizer?: { format: (d: Date, fmt: string, c?: string) => string }) =>
    localizer
      ? `${localizer.format(start, "HH:mm", culture)} – ${localizer.format(end, "HH:mm", culture)}`
      : "",
  selectRangeFormat: ({ start, end }: { start: Date; end: Date }, culture?: string, localizer?: { format: (d: Date, fmt: string, c?: string) => string }) =>
    localizer
      ? `${localizer.format(start, "HH:mm", culture)} – ${localizer.format(end, "HH:mm", culture)}`
      : "",
  dayFormat: "EEE d",
  dayHeaderFormat: "d MMMM yyyy, EEEE",
};

export function TrainingCalendar({
  events,
  kind,
  onSelectEvent,
  onSelectSlot,
  onEventResize,
  onEventDrop,
}: TrainingCalendarProps) {
  const [view, setView] = useState<View>(ROLLING_2W_VIEW);
  // Hafta görünümü açılışta 2 gün öncesinden başlasın — kullanıcı
  // yakın geçmişte olanı hızlıca görsün, gelecek de aynı pencerede.
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // Ders saatleri 07:00–23:00 aralığında. RBC `min`/`max` prop'ları
  // gün/hafta görünümlerinin görünür saat aralığını kısıtlar; bu
  // aralık dışındaki slotlar (07:00 öncesi, 23:00 sonrası) çizilmez.
  // `scrollToTime` da aynı başlangıca alındı ki açılışta ilk ders
  // saati ekranın üstünde olsun.
  const minTime = useMemo(() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  }, []);
  const maxTime = useMemo(() => {
    const d = new Date();
    d.setHours(23, 0, 0, 0);
    return d;
  }, []);
  const scrollToTime = minTime;

  // Hafta sonu (Cmt/Paz) sütunlarına ayrı renk: gövde için
  // `dayPropGetter` (.rbc-day-bg + .rbc-day-slot), başlık için custom
  // header component (`components.week.header`). Her iki yere
  // `training-day-weekend` class'ı düşüyor.
  const isWeekend = (d: Date) => {
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  const dayPropGetter = useMemo(
    () => (date: Date) => {
      if (isWeekend(date)) {
        const cls = date.getDay() === 0
          ? "training-day-weekend training-day-sunday"
          : "training-day-weekend training-day-saturday";
        return { className: cls };
      }
      return {};
    },
    []
  );

  const WeekHeader = useMemo(
    () => ({ date }: { date: Date; label: string; localizer: unknown }) => {
      const weekend = isWeekend(date);
      // Türkçe kısa gün adı + ay-içi tarih: "Pzt 25"
      const text = format(date, "EEE d", { locale: tr });
      const className = weekend
        ? "training-header-day training-header-day-weekend"
        : "training-header-day";
      return <span className={className}>{text}</span>;
    },
    []
  );

  const EventComponent = useMemo(
    () => ({ event }: { event: TrainingCalendarEvent }) => {
      return (
        <div className="training-event-content">
          <div className="training-event-instructor">{event.instructorName}</div>
        </div>
      );
    },
    []
  );

  const eventStyleGetter = useMemo(
    () => (event: TrainingCalendarEvent) => {
      // Renk artık ders tipine göre. Inline style kaldırıldı; CSS
      // class'ları (`.training-event`, `.training-event-teorik|uygulama`)
      // teorik=marka yeşili, uygulama=mavi olarak boyar.
      const classes = ["training-event", `training-event-${kind}`];
      if (event.external) classes.push("training-event-external");
      return { className: classes.join(" ") };
    },
    [kind]
  );

  type InteractionArgs = { event: TrainingCalendarEvent; start: Date | string; end: Date | string };
  const toDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));

  const handleResize = (args: InteractionArgs) => {
    onEventResize?.({ event: args.event, start: toDate(args.start), end: toDate(args.end) });
  };

  const handleDrop = (args: InteractionArgs) => {
    onEventDrop?.({ event: args.event, start: toDate(args.start), end: toDate(args.end) });
  };

  const calendarProps: Record<string, unknown> = {
    culture: "tr",
    components: {
      week: { header: WeekHeader },
      day: { header: WeekHeader },
      event: EventComponent,
    },
    date,
    dayPropGetter,
    defaultView: ROLLING_2W_VIEW,
    endAccessor: "end",
    eventPropGetter: eventStyleGetter,
    events,
    formats: CALENDAR_FORMATS,
    localizer: trainingLocalizer,
    messages: ROLLING_MESSAGES,
    onEventDrop: handleDrop,
    onEventResize: handleResize,
    onNavigate: setDate,
    onSelectEvent,
    onSelectSlot: (slot: { start: Date | string; end: Date | string }) =>
      onSelectSlot?.({ start: toDate(slot.start), end: toDate(slot.end) }),
    onView: setView,
    resizable: true,
    // External event'ler başka takvimden gölge olarak geliyor — burada
    // taşınmamalı/yeniden boyutlandırılmamalı.
    draggableAccessor: (event: TrainingCalendarEvent) => !event.external,
    resizableAccessor: (event: TrainingCalendarEvent) => !event.external,
    min: minTime,
    max: maxTime,
    scrollToTime,
    selectable: true,
    startAccessor: "start",
    // 30 dk slot, saat başlarında ana çizgi (timeslots=2 → her grup
    // 1 saat). Min ders 60 dk; daha hassas snap için 30 dk granülerlik.
    step: 30,
    timeslots: 2,
    style: { height: "calc(100vh - 180px)", minHeight: 480 },
    view,
    views: {
      rolling: RollingWeekView,
      rolling2w: RollingTwoWeeksView,
      rolling3w: RollingThreeWeeksView,
      rolling4w: RollingFourWeeksView,
      month: true,
      day: true,
      agenda: true,
    },
  };

  return (
    <div className="training-calendar">
      <DnDCalendar {...calendarProps} />
    </div>
  );
}
