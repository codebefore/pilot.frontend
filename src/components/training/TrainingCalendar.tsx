import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, type CalendarProps, type View } from "react-big-calendar";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import dragAndDropAddon from "react-big-calendar/lib/addons/dragAndDrop";

import {
  getTrainingCalendarMessages,
  trainingLocalizer,
  type TrainingCalendarEvent,
  type TrainingEventKind,
} from "../../lib/training-calendar";
import { useLanguage } from "../../lib/i18n";
import type { BranchHelpers } from "../../lib/training-branches";
import { ClassroomIcon, UserIcon, VehicleIcon } from "../icons";
import {
  RollingFourWeeksView,
  RollingThreeWeeksView,
  RollingTwoWeeksView,
  RollingWeekView,
} from "./RollingWeekView";

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

type DragAndDropAddon =
  | typeof dragAndDropAddon
  | { default?: typeof dragAndDropAddon | { default?: typeof dragAndDropAddon } };

function resolveDragAndDrop(addon: DragAndDropAddon): typeof dragAndDropAddon {
  if (typeof addon === "function") return addon;
  if (addon.default && typeof addon.default === "function") return addon.default;
  if (
    addon.default &&
    typeof addon.default === "object" &&
    "default" in addon.default &&
    typeof addon.default.default === "function"
  ) {
    return addon.default.default;
  }
  throw new TypeError("react-big-calendar dragAndDrop addon could not be loaded.");
}

const withDragAndDrop = resolveDragAndDrop(dragAndDropAddon as DragAndDropAddon);

// RBC DnD HOC ile Calendar'ı sar — resize/drop callback'leri aktif olur.
// @types'ın `Event` base tipi bizim TrainingCalendarEvent için gevşek;
// HOC girişini loose tipe, çıkışını da tüm prop'ları serbest kabul eden
// ComponentType'a düşürüyoruz (RBC runtime'da prop'ları takip ediyor).
const DnDCalendar = withDragAndDrop(
  Calendar as unknown as ComponentType<CalendarProps>,
) as unknown as ComponentType<Record<string, unknown>>;

type TrainingCalendarProps = {
  events: TrainingCalendarEvent[];
  /**
   * Takvim sadece aynı tip etkinlikleri (teorik veya uygulama) gösterir,
   * ama event objesi zaten `kind` taşıyor — gelecekte tek takvimde iki
   * tip render edilirse renk için kullanırız.
   */
  kind: TrainingEventKind;
  /** Branş katalogundan türetilen renk/label/notes-detect helper'ı. */
  branchHelpers: BranchHelpers;
  simulatorVehicleIds?: Set<string>;
  onSelectEvent?: (event: TrainingCalendarEvent) => void;
  onSelectSlot?: (slot: { start: Date; end: Date }) => void;
  /** Event alt/üst kenarından resize edilince çağrılır. */
  onEventResize?: (args: { event: TrainingCalendarEvent; start: Date; end: Date }) => void;
  /** Event body'sinden sürüklenip başka slota bırakılınca çağrılır. */
  onEventDrop?: (args: { event: TrainingCalendarEvent; start: Date; end: Date }) => void;
  durationHours?: number;
  onDurationHoursChange?: (hours: number) => void;
  /** Parent'tan zorlanan navigasyon — değer değiştiğinde takvim o
   *  tarihe odaklanır. QA'da grup/aday seçilince kullanılır. */
  focusDate?: Date | null;
  /** Import gibi açık bir aksiyon sonrası saat eksenini de ilgili saate kaydırır. */
  focusScrollTime?: Date | null;
  /** Bu tarihten önceki günler "disabled" (filigran) olarak gösterilir.
   *  Backend zaten beforeGroupStartDate ile reddediyor; UI ipucu için. */
  disabledBeforeDate?: Date | null;
  readOnly?: boolean;
  initialView?: View;
};

// Custom view key'lerimiz — RBC `Views` enum'unda yok, ama `views` map'ine
// herhangi bir string anahtar verilebiliyor. Toolbar etiketleri
// `messages` üzerinden çevrilir.
const ROLLING_2W_VIEW = "rolling2w" as View;


const ROLLING_LABELS_TR = {
  rolling: "Hafta",
  rolling2w: "2 Hafta",
  rolling3w: "3 Hafta",
  rolling4w: "4 Hafta",
};

const ROLLING_LABELS_EN = {
  rolling: "Week",
  rolling2w: "2 Weeks",
  rolling3w: "3 Weeks",
  rolling4w: "4 Weeks",
};

function getRollingMessages(lang: "tr" | "en") {
  return {
    ...getTrainingCalendarMessages(lang),
    ...(lang === "en" ? ROLLING_LABELS_EN : ROLLING_LABELS_TR),
  };
}

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

type HoverPopoverState = {
  event: TrainingCalendarEvent;
  top: number;
  left: number;
};

function formatCalendarTimeRange(start: Date, end: Date): string {
  return `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;
}

function buildEventPopoverRows(event: TrainingCalendarEvent): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Saat", value: formatCalendarTimeRange(event.start, event.end) },
  ];

  if (event.kind === "uygulama") {
    rows.unshift(
      { label: "Aday", value: event.candidateName?.trim() || "-" },
      { label: "Araç plakası", value: event.vehiclePlate?.trim() || event.groupName || "-" },
      { label: "Eğitmen", value: event.instructorName || "-" }
    );
  } else {
    rows.unshift(
      { label: "Dönem", value: event.termName || "-" },
      { label: "Grup", value: event.groupName || "-" },
      { label: "Eğitmen", value: event.instructorName || "-" }
    );
    if (event.location) {
      rows.push({ label: "Derslik", value: event.location });
    }
    if (event.candidateCount > 0) {
      rows.push({ label: "Aday sayısı", value: String(event.candidateCount) });
    }
  }

  if (event.licenseClass && event.licenseClass !== "-") {
    rows.push({ label: "Sınıf", value: event.licenseClass });
  }
  if (event.notes?.trim()) {
    rows.push({ label: event.kind === "teorik" ? "Ders" : "Not", value: event.notes.trim() });
  }

  return rows;
}

function TrainingEventHoverPopover({ event, top, left }: HoverPopoverState) {
  const title = event.kind === "uygulama" ? "Direksiyon eğitimi" : "Teorik eğitim";
  const rows = buildEventPopoverRows(event);

  return createPortal(
    <div
      className="training-event-hover-popover"
      role="tooltip"
      style={{ top, left }}
    >
      <div className="training-event-hover-title">{title}</div>
      <div className="training-event-hover-list">
        {rows.map((row) => (
          <div className="training-event-hover-row" key={`${row.label}:${row.value}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

export function TrainingCalendar({
  events,
  kind: _kind,
  branchHelpers,
  simulatorVehicleIds,
  onSelectEvent,
  onSelectSlot,
  onEventResize,
  onEventDrop,
  durationHours,
  onDurationHoursChange,
  focusDate,
  focusScrollTime,
  disabledBeforeDate,
  readOnly = false,
  initialView = ROLLING_2W_VIEW,
}: TrainingCalendarProps) {
  const { lang } = useLanguage();
  const [view, setView] = useState<View>(initialView);
  const [hoverPopover, setHoverPopover] = useState<HoverPopoverState | null>(null);
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
  // Açılışta ilk ders saati ekranın üstünde olsun. Import sonrası parent
  // focusScrollTime verirse sadece saat ekseni o değere taşınır.
  const [scrollToTime, setScrollToTime] = useState<Date>(minTime);

  // Parent'tan focusDate gelince takvimi o tarihe götür. Pencere "2 gün
  // önceden başla" kuralına sadık kalsın diye 2 gün geri çekiyoruz.
  useEffect(() => {
    if (!focusDate) return;
    const d = new Date(focusDate);
    d.setDate(d.getDate() - 2);
    d.setHours(0, 0, 0, 0);
    setDate(d);
  }, [focusDate]);

  useEffect(() => {
    if (!focusScrollTime) {
      setScrollToTime(minTime);
      return;
    }

    const minMinutes = minTime.getHours() * 60 + minTime.getMinutes();
    const maxMinutes = maxTime.getHours() * 60 + maxTime.getMinutes();
    const focusMinutes = focusScrollTime.getHours() * 60 + focusScrollTime.getMinutes();
    const clampedMinutes = Math.min(Math.max(focusMinutes, minMinutes), maxMinutes);
    const d = new Date();
    d.setHours(Math.floor(clampedMinutes / 60), clampedMinutes % 60, 0, 0);
    setScrollToTime(d);
  }, [focusScrollTime, maxTime, minTime]);

  // Hafta sonu (Cmt/Paz) sütunlarına ayrı renk: gövde için
  // `dayPropGetter` (.rbc-day-bg + .rbc-day-slot), başlık için custom
  // header component (`components.week.header`). Her iki yere
  // `training-day-weekend` class'ı düşüyor.
  const isWeekend = (d: Date) => {
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  // Disabled cutoff (grup startDate öncesi). Günün başlangıcına
  // normalize edip karşılaştırıyoruz; saat farkı yanlış güne kaydırmasın.
  const disabledCutoffMs = useMemo(() => {
    if (!disabledBeforeDate) return null;
    const d = new Date(disabledBeforeDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [disabledBeforeDate]);

  const dayPropGetter = useMemo(
    () => (date: Date) => {
      const classes: string[] = [];
      if (isWeekend(date)) {
        classes.push(
          date.getDay() === 0
            ? "training-day-weekend training-day-sunday"
            : "training-day-weekend training-day-saturday"
        );
      }
      if (disabledCutoffMs != null) {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        if (dayStart.getTime() < disabledCutoffMs) {
          classes.push("training-day-disabled");
        }
      }
      return classes.length > 0 ? { className: classes.join(" ") } : {};
    },
    [disabledCutoffMs]
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

  const showEventPopover = (event: TrainingCalendarEvent, target: HTMLElement) => {
    if (event.preview || event.busyMarker) return;
    const rect = target.getBoundingClientRect();
    const width = 260;
    const padding = 12;
    const left = Math.max(
      padding,
      Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - padding)
    );
    const top = Math.max(
      padding,
      Math.min(rect.bottom + 8, window.innerHeight - 240)
    );
    setHoverPopover({ event, top, left });
  };

  const hideEventPopover = () => setHoverPopover(null);

  const EventComponent = useMemo(
    () => ({ event }: { event: TrainingCalendarEvent }) => {
      const BusyIcons = () => {
        const reasons = event.busyReasons ?? [];
        const hasInstructor = reasons.includes("instructor");
        const hasClassroom = reasons.includes("classroom");
        const hasVehicle = reasons.includes("vehicle");
        return (
          <div className="training-event-busy-icons" aria-hidden="true">
            {hasInstructor ? (
              <span className="training-event-busy-icon">
                <UserIcon size={14} stroke={2.4} />
              </span>
            ) : null}
            {hasClassroom ? (
              <span className="training-event-busy-icon">
                <ClassroomIcon size={14} stroke={2.4} />
              </span>
            ) : null}
            {hasVehicle ? (
              <span className="training-event-busy-icon">
                <VehicleIcon size={14} stroke={2.4} />
              </span>
            ) : null}
          </div>
        );
      };
      if (event.busyMarker && event.busyReasons?.length) {
        return (
          <div className="training-event-content training-event-busy-content">
            <BusyIcons />
          </div>
        );
      }
      const isUygulama = event.kind === "uygulama";
      if (event.displayLessonNumber) {
        return (
          <div
            className="training-event-content training-event-lesson-number"
            onMouseEnter={(mouseEvent: ReactMouseEvent<HTMLDivElement>) =>
              showEventPopover(event, mouseEvent.currentTarget)
            }
            onMouseLeave={hideEventPopover}
          >
            {event.busyReasons?.length ? <BusyIcons /> : null}
            <span>{event.displayLessonNumber}</span>
          </div>
        );
      }
      // Teorik takvimde quick-assign `notes`'a branş adı yazıyor (T067'ye
      // kadar geçici) — varsa üst satırda göster. Sayfa zaten teorik
      // olduğu için "Teorik" tekrar yazmıyoruz.
      const topLine = isUygulama
        ? event.candidateName
        : event.notes?.trim() || null;
      return (
        <div
          className="training-event-content"
          onMouseEnter={(mouseEvent: ReactMouseEvent<HTMLDivElement>) =>
            showEventPopover(event, mouseEvent.currentTarget)
          }
          onMouseLeave={hideEventPopover}
        >
          {event.busyReasons?.length ? <BusyIcons /> : null}
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
      if (event.busyMarker && event.busyReasons?.length) {
        return {
          className: "training-event training-event-busy",
          style: {
            zIndex: 100,
            pointerEvents: "none",
            overflow: "visible",
          },
        };
      }
      // Renk öncelik sırası: branş > kind fallback. Branş şu anda
      // `notes`'tan tespit ediliyor (T067 sonrası entity'den gelecek).
      // Event'in kendi kind'ına bakıyoruz — uygulama sayfasında dimmed
      // olarak gösterilen teorik event'ler de kendi branş rengini
      // korusun (yoksa hepsi "practice" rengiyle çıkardı).
      const classes = ["training-event", `training-event-${event.kind}`];
      if (event.dimmed) classes.push("training-event-dimmed");
      if (
        event.kind === "uygulama" &&
        event.vehicleId &&
        simulatorVehicleIds?.has(event.vehicleId)
      ) {
        classes.push("training-event-simulator");
        return {
          className: classes.join(" "),
          style: {
            backgroundColor: "#53c3e9",
            borderColor: "#2aa6cf",
            color: "var(--white)",
          },
        };
      }
      const branchCode =
        event.kind === "uygulama"
          ? "practice"
          : event.branchCode ?? branchHelpers.detectFromNotes(event.notes);
      const color = branchHelpers.color(branchCode);
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
    [branchHelpers, simulatorVehicleIds]
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
    defaultView: initialView,
    endAccessor: "end",
    eventPropGetter: eventStyleGetter,
    events,
    formats: CALENDAR_FORMATS,
    localizer: trainingLocalizer,
    messages: getRollingMessages(lang),
    onEventDrop: readOnly ? undefined : handleDrop,
    onEventResize: readOnly ? undefined : handleResize,
    onNavigate: setDate,
    onSelectEvent,
    onSelectSlot: (slot: { start: Date | string; end: Date | string }) =>
      onSelectSlot?.({ start: toDate(slot.start), end: toDate(slot.end) }),
    onView: setView,
    resizable: !readOnly,
    // Preview, busy ve dimmed event'ler etkileşimsiz.
    draggableAccessor: (event: TrainingCalendarEvent) =>
      !readOnly && !event.preview && !event.dimmed && !event.busyMarker,
    resizableAccessor: (event: TrainingCalendarEvent) =>
      !readOnly && !event.preview && !event.dimmed && !event.busyMarker,
    min: minTime,
    max: maxTime,
    scrollToTime,
    selectable: !readOnly,
    startAccessor: "start",
    // step=60 + timeslots=1 → her slot 1 saat. Min ders 60 dk olduğu
    // için drag/resize de tam saatlere snap'lenir; yarım saat fractional
    // pozisyon yok (görsel ve davranış birebir).
    step: 60,
    timeslots: 1,
    tooltipAccessor: () => "",
    style: { height: "100%", minHeight: 0 },
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
      {hoverPopover ? <TrainingEventHoverPopover {...hoverPopover} /> : null}
    </div>
  );
}
