import { useMemo, useState, type ComponentType } from "react";
import { Calendar, type View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

import {
  trainingCalendarMessages,
  trainingLocalizer,
  type TrainingCalendarEvent,
  type TrainingEventKind,
} from "../../lib/training-calendar";
import { colorForGroup } from "../../lib/training-calendar-palette";
import { RollingTwoWeeksView, RollingWeekView } from "./RollingWeekView";

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
};

// 24-saat Türkçe format. RBC default `timeGutterFormat` "h:mm a" (12-saat
// AM/PM) — TR locale'de tuhaf görünüyor. `formats` Calendar prop'u
// localizer'daki `format` callback'ine düşüyor; date-fns pattern'leri
// burada kullanılıyor.
const CALENDAR_FORMATS = {
  timeGutterFormat: "HH:mm",
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }, culture?: string, localizer?: { format: (d: Date, fmt: string, c?: string) => string }) =>
    localizer
      ? `${localizer.format(start, "HH:mm", culture)} – ${localizer.format(end, "HH:mm", culture)}`
      : "",
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
  // Hafta/gün görünümü açılışında 08:00'e scroll olsun (ders saatleri
  // buradan başlıyor). Bugünün 08:00'ı — tarih önemli değil, sadece
  // saat-dakika kısmı kullanılıyor.
  const scrollToTime = useMemo(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  }, []);

  const eventStyleGetter = useMemo(
    () => (event: TrainingCalendarEvent) => {
      const c = colorForGroup(event.groupName);
      const classes = ["training-event", `training-event-${kind}`];
      if (event.external) classes.push("training-event-external");
      return {
        className: classes.join(" "),
        style: {
          backgroundColor: c.bg,
          borderColor: c.border,
          color: c.fg,
        },
      };
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
    date,
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
    scrollToTime,
    selectable: true,
    startAccessor: "start",
    step: 30,
    timeslots: 1,
    style: { height: "calc(100vh - 180px)", minHeight: 480 },
    view,
    views: {
      rolling: RollingWeekView,
      rolling2w: RollingTwoWeeksView,
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
