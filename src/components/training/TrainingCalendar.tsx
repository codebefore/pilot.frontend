import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
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
  colorForBranch,
  detectBranchFromNotes,
} from "../../lib/training-branches";
import {
  RollingFourWeeksView,
  RollingThreeWeeksView,
  RollingTwoWeeksView,
  RollingWeekView,
} from "./RollingWeekView";

// Quick-assign saat input'u — boş/ara değer yazılabilsin diye local
// text state taşıyor; geçerli pozitif tam sayı olunca parent'a iletir.
// Dışarıdan value değişirse senkron olur. Blur'da geçersiz input
// önceki değere geri döner.
function GutterDurationInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (hours: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <div className="training-gutter-quick-assign">
      <input
        className="training-gutter-quick-assign-input"
        max={8}
        min={1}
        onBlur={() => {
          const parsed = parseInt(text, 10);
          if (!Number.isFinite(parsed) || parsed < 1) {
            setText(String(value));
          }
        }}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const parsed = parseInt(next, 10);
          if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 8) {
            onChange(parsed);
          }
        }}
        type="number"
        value={text}
      />
    </div>
  );
}

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
  /**
   * Quick-assign için ders saat sayısı. Teorik takvimde gutter header'ında
   * (sol-üst boş köşe) küçük bir input olarak render edilir.
   */
  durationHours?: number;
  onDurationHoursChange?: (hours: number) => void;
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
  kind: _kind,
  onSelectEvent,
  onSelectSlot,
  onEventResize,
  onEventDrop,
  durationHours,
  onDurationHoursChange,
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

  // Quick-assign saat input'u takvimin sol-üst gutter köşesine düşüyor.
  // Hem teorik hem uygulama tarafında aynı süre kuralı geçerli (min 60
  // dk, 30 dk granülerlik) — iki sayfada da gösteriyoruz.
  const TimeGutterHeader = useMemo(
    () => () => {
      if (!onDurationHoursChange) return null;
      return (
        <GutterDurationInput
          onChange={onDurationHoursChange}
          value={durationHours ?? 1}
        />
      );
    },
    [durationHours, onDurationHoursChange]
  );

  const EventComponent = useMemo(
    () => ({ event }: { event: TrainingCalendarEvent }) => {
      const isUygulama = event.kind === "uygulama";
      // Teorik takvimde quick-assign `notes`'a branş adı yazıyor (T067'ye
      // kadar geçici) — varsa üst satırda göster. Sayfa zaten teorik
      // olduğu için "Teorik" tekrar yazmıyoruz.
      const topLine = isUygulama
        ? event.candidateName
        : event.notes?.trim() || null;
      return (
        <div className="training-event-content">
          {topLine ? (
            <div className="training-event-type">{topLine}</div>
          ) : null}
          <div className="training-event-group">
            {event.groupName.replace(/\s+\d{4}/g, "")}
          </div>
          {event.instructorName ? (
            <div className="training-event-instructor">
              {event.instructorName}
            </div>
          ) : null}
        </div>
      );
    },
    []
  );

  const eventStyleGetter = useMemo(
    () => (event: TrainingCalendarEvent) => {
      // Preview event quick-assign popover açıkken çizilen geçici slot —
      // farklı stil, etkileşim yok. Renk inline override yok, CSS'ten gelir.
      if (event.preview) {
        return { className: "training-event training-event-preview" };
      }
      // Renk öncelik sırası: branş > kind fallback. Branş şu anda
      // `notes`'tan tespit ediliyor (T067 sonrası entity'den gelecek).
      // Event'in kendi kind'ına bakıyoruz — uygulama sayfasında dimmed
      // olarak gösterilen teorik event'ler de kendi branş rengini
      // korusun (yoksa hepsi "practice" rengiyle çıkardı).
      const classes = ["training-event", `training-event-${event.kind}`];
      if (event.dimmed) classes.push("training-event-dimmed");
      const branchCode =
        event.kind === "uygulama"
          ? "practice"
          : detectBranchFromNotes(event.notes);
      const color = colorForBranch(branchCode);
      return color
        ? {
            className: classes.join(" "),
            style: {
              backgroundColor: color.bg,
              borderColor: color.border,
              color: color.fg,
            },
          }
        : { className: classes.join(" ") };
    },
    []
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
      timeGutterHeader: TimeGutterHeader,
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
    // Preview ve dimmed (görünmez eğitmenin dersi) etkileşimsiz.
    draggableAccessor: (event: TrainingCalendarEvent) =>
      !event.preview && !event.dimmed,
    resizableAccessor: (event: TrainingCalendarEvent) =>
      !event.preview && !event.dimmed,
    min: minTime,
    max: maxTime,
    scrollToTime,
    selectable: true,
    startAccessor: "start",
    // step=60 + timeslots=1 → her slot 1 saat. Min ders 60 dk olduğu
    // için drag/resize de tam saatlere snap'lenir; yarım saat fractional
    // pozisyon yok (görsel ve davranış birebir).
    step: 60,
    timeslots: 1,
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
