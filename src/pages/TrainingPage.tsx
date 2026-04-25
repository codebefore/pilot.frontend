import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../lib/http";
import { useT } from "../lib/i18n";
import type { TranslationKey } from "../lib/i18n";
import { PageToolbar } from "../components/layout/PageToolbar";
import {
  NewTrainingPlanModal,
  type TrainingLessonSubmitValues,
} from "../components/modals/NewTrainingPlanModal";
import { TrainingCalendar } from "../components/training/TrainingCalendar";
import { TrainingEventDetailModal } from "../components/training/TrainingEventDetailModal";
import { TrainingFilters } from "../components/training/TrainingFilters";
import { TrainingWeekSummary } from "../components/training/TrainingWeekSummary";
import { useToast } from "../components/ui/Toast";
import {
  calendarEventToTrainingLessonRequest,
  trainingLessonToCalendarEvent,
  type TrainingCalendarEvent,
} from "../lib/training-calendar";
import { loadExternalEvents } from "../lib/training-external-storage";
import { getAreas } from "../lib/areas-api";
import { getCandidates } from "../lib/candidates-api";
import { getGroups } from "../lib/groups-api";
import { getInstructors } from "../lib/instructors-api";
import {
  createTrainingLesson,
  deleteTrainingLesson,
  getTrainingLessons,
  updateTrainingLesson,
} from "../lib/training-lessons-api";
import type {
  AreaResponse,
  CandidateResponse,
  GroupResponse,
  InstructorResponse,
  RouteResponse,
  TrainingLessonUpsertRequest,
  VehicleResponse,
} from "../lib/types";
import { getRoutes } from "../lib/routes-api";
import { getVehicles } from "../lib/vehicles-api";

type TrainingPageProps = {
  type: "teorik" | "uygulama";
};

// Backend `errorCodes` mapindeki PascalCase field adlarını
// modal'ın camelCase form alanlarına eşleştiriyoruz.
const SERVER_FIELD_MAP: Record<string, string> = {
  StartAtUtc: "startTime",
  EndAtUtc: "durationMinutes",
  InstructorId: "instructorId",
  GroupId: "groupId",
  CandidateId: "candidateId",
  VehicleId: "vehicleId",
  AreaId: "areaId",
  RouteId: "routeId",
};

const GENERAL_CODES = new Set<string>([
  "trainingLesson.validation.rowVersionRequired",
  "trainingLesson.validation.concurrencyConflict",
  "trainingLesson.validation.generic",
]);

export function TrainingPage({ type }: TrainingPageProps) {
  const { showToast } = useToast();
  const t = useT();
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [serverGeneralError, setServerGeneralError] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [newLessonSlot, setNewLessonSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [events, setEvents] = useState<TrainingCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState<InstructorResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [vehicles, setVehicles] = useState<VehicleResponse[]>([]);
  const [areas, setAreas] = useState<AreaResponse[]>([]);
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TrainingCalendarEvent | null>(null);
  const [showExternal, setShowExternal] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 90);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setDate(now.getDate() + 180);
    to.setHours(23, 59, 59, 999);

    setLoading(true);
    Promise.all([
      getTrainingLessons(
        {
          kind: type,
          fromUtc: from.toISOString(),
          toUtc: to.toISOString(),
        },
        controller.signal
      ),
      getInstructors({ activity: "active", page: 1, pageSize: 100 }, controller.signal),
      getGroups({ page: 1, pageSize: 100 }, controller.signal),
      getCandidates({ page: 1, pageSize: 100 }, controller.signal),
      getVehicles({ activity: "active", page: 1, pageSize: 100 }, controller.signal),
      getAreas({ activity: "active", page: 1, pageSize: 100 }, controller.signal),
      getRoutes({ activity: "active", page: 1, pageSize: 100 }, controller.signal),
    ])
      .then(([lessonResult, instructorResult, groupResult, candidateResult, vehicleResult, areaResult, routeResult]) => {
        // Backend event'leri + localStorage'dan gelen external gölgeler.
        // External'lar backend desteği gelene kadar frontend-only; kind'a
        // göre ayrı seed (teorik/uygulama). Eğitmen ID'si backend
        // kataloğundaki ilk N eğitmene bağlanıyor ki filter "Hasan'ı
        // kapat → external Hasan'ı da gizle" mantığı çalışsın.
        const externals = loadExternalEvents(type, instructorResult.items);
        setEvents([
          ...lessonResult.items.map(trainingLessonToCalendarEvent),
          ...externals,
        ]);
        setInstructors(instructorResult.items);
        setGroups(groupResult.items);
        setCandidates(candidateResult.items);
        setVehicles(vehicleResult.items);
        setAreas(areaResult.items.filter((area) => area.areaType === "classroom"));
        setRoutes(
          routeResult.items.filter(
            (route) => route.usageType === "practice" || route.usageType === "practice_and_exam"
          )
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setEvents([]);
        showToast("Eğitim dersleri yüklenemedi");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [showToast, type]);

  // Filtreler — başlangıçta hepsi görünür. Set tipinde tutuyoruz; toggle
  // O(1) ve memoize edilmiş `visibleEvents` `useMemo` ile yeniden
  // hesaplanıyor.
  //
  // Grup listesi sadece internal (bu takvime ait) event'lerden türetiliyor
  // — external "Direksiyon Slot" / "Bakım" gibi başka takvim
  // kavramlarını filter dropdown'unda göstermek karışıklık yaratırdı.
  // Eğitmen listesi ise her ikisini kapsıyor (aynı eğitmen iki takvimde
  // olabilir, kullanıcı Hasan'ı kapatırsa external Hasan da gitmeli).
  const allGroups = useMemo(
    () =>
      Array.from(
        new Set(events.filter((e) => !e.external).map((e) => e.groupName))
      ),
    [events]
  );
  const allInstructorIds = useMemo(
    () => Array.from(new Set(events.map((e) => e.instructorId))),
    [events]
  );
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    () => new Set(allGroups)
  );
  const [visibleInstructors, setVisibleInstructors] = useState<Set<string>>(
    () => new Set(allInstructorIds)
  );

  // Yeni grup/eğitmen eklendikçe varsayılan olarak görünür yapalım,
  // aksi halde kullanıcı yeni eklediği bir kaydı bulamaz.
  useEffect(() => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      let changed = false;
      allGroups.forEach((g) => {
        if (!next.has(g)) {
          next.add(g);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [allGroups]);
  useEffect(() => {
    setVisibleInstructors((prev) => {
      const next = new Set(prev);
      let changed = false;
      allInstructorIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [allInstructorIds]);

  const visibleEvents = useMemo(
    () =>
      events.filter((e) => {
        // Toolbar toggle external'ları tamamen kapatır.
        if (e.external && !showExternal) return false;
        // Eğitmen filtresi her zaman uygulanır (internal + external).
        if (!visibleInstructors.has(e.instructorId)) return false;
        // External event'ler grup filtresinden muaf — gölge olarak hep
        // görünür kalır.
        if (e.external) return true;
        return visibleGroups.has(e.groupName);
      }),
    [events, visibleGroups, visibleInstructors, showExternal]
  );

  const toggleGroup = (group: string) => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const toggleInstructor = (id: string) => {
    setVisibleInstructors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setVisibleGroups(new Set(allGroups));
    setVisibleInstructors(new Set(allInstructorIds));
  };

  const showAllGroups = () => {
    setVisibleGroups(new Set(allGroups));
  };

  const hideAllGroups = () => {
    setVisibleGroups(new Set());
  };

  const showAllInstructors = () => {
    setVisibleInstructors(new Set(allInstructorIds));
  };

  const hideAllInstructors = () => {
    setVisibleInstructors(new Set());
  };

  const title = type === "teorik" ? "Teorik Eğitim Planı" : "Uygulama Eğitim Planı";

  const replaceEvent = (nextEvent: TrainingCalendarEvent) => {
    setEvents((prev) =>
      prev.map((event) => (event.id === nextEvent.id ? nextEvent : event))
    );
    setSelectedEvent((prev) => (prev?.id === nextEvent.id ? nextEvent : prev));
  };

  const buildCreateRequest = (
    values: TrainingLessonSubmitValues
  ): TrainingLessonUpsertRequest => {
    const start = new Date(`${values.date}T${values.startTime}:00`);
    const end = new Date(start.getTime() + values.durationMinutes * 60 * 1000);
    const candidate = candidates.find((item) => item.id === values.candidateId);

    return {
      kind: values.type,
      status: values.status,
      startAtUtc: start.toISOString(),
      endAtUtc: end.toISOString(),
      instructorId: values.instructorId,
      groupId: values.type === "teorik" ? values.groupId || null : null,
      candidateId: values.type === "uygulama" ? values.candidateId || null : null,
      vehicleId: values.type === "uygulama" ? values.vehicleId || null : null,
      areaId: values.type === "teorik" ? values.areaId || null : null,
      routeId: values.type === "uygulama" ? values.routeId || null : null,
      licenseClass: values.type === "uygulama" ? candidate?.licenseClass ?? null : null,
      notes: values.notes?.trim() || null,
    };
  };

  // ApiError'daki `validationErrorCodes`u i18n üzerinden çevirip
  // {field -> mesaj} ve genel mesaj olarak ikiye böler. Modal field
  // mesajları input altına, general mesaj form üstüne renderlar.
  const splitApiError = (error: unknown): {
    fieldErrors: Record<string, string>;
    generalError?: string;
  } => {
    if (!(error instanceof ApiError)) {
      return { fieldErrors: {}, generalError: "Ders kaydedilemedi" };
    }
    const fieldErrors: Record<string, string> = {};
    let generalError: string | undefined;
    const codes = error.validationErrorCodes ?? {};
    for (const [serverField, fieldErrs] of Object.entries(codes)) {
      const first = fieldErrs[0];
      if (!first) continue;
      const message = t(first.code as TranslationKey, first.params);
      const formField = SERVER_FIELD_MAP[serverField];
      if (formField) {
        fieldErrors[formField] = message;
      } else if (GENERAL_CODES.has(first.code) || serverField === "RowVersion") {
        generalError ??= message;
      } else {
        generalError ??= message;
      }
    }
    if (!Object.keys(fieldErrors).length && !generalError) {
      generalError = error.status === 409
        ? "Aynı saat için eğitmen veya araç çakışması var"
        : "Ders kaydedilemedi";
    }
    return { fieldErrors, generalError };
  };

  const handleCreateLesson = async (values: TrainingLessonSubmitValues) => {
    setServerFieldErrors({});
    setServerGeneralError(undefined);
    try {
      const saved = await createTrainingLesson(buildCreateRequest(values));
      const nextEvent = trainingLessonToCalendarEvent(saved);
      setEvents((prev) => [...prev, nextEvent]);
      setModalOpen(false);
      setNewLessonSlot(null);
      showToast("Ders oluşturuldu");
    } catch (error) {
      console.error(error);
      const { fieldErrors, generalError } = splitApiError(error);
      setServerFieldErrors(fieldErrors);
      setServerGeneralError(generalError);
      // Field-level mesaj inline gösterilecek; toast yalnızca genel
      // mesaj varsa görünür durumda kalır.
      if (Object.keys(fieldErrors).length === 0 && generalError) {
        showToast(generalError);
      }
    }
  };

  const persistEventUpdate = async (
    event: TrainingCalendarEvent,
    overrides: Partial<TrainingLessonUpsertRequest>
  ) => {
    if (event.external) return;
    try {
      const saved = await updateTrainingLesson(
        event.id,
        calendarEventToTrainingLessonRequest(event, overrides)
      );
      replaceEvent(trainingLessonToCalendarEvent(saved));
      showToast("Ders güncellendi");
    } catch (error) {
      console.error(error);
      const { fieldErrors, generalError } = splitApiError(error);
      // Update yolunda inline form yok — tüm mesajları toast'ta birleştir.
      const merged = [
        ...Object.values(fieldErrors),
        ...(generalError ? [generalError] : []),
      ];
      showToast(merged[0] ?? "Ders kaydedilemedi");
    }
  };

  const handleDeleteEvent = async (event: TrainingCalendarEvent) => {
    if (event.external) return;
    try {
      await deleteTrainingLesson(event.id);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      setSelectedEvent(null);
      showToast("Ders silindi");
    } catch (error) {
      console.error(error);
      showToast("Ders silinemedi");
    }
  };

  const handleSelectSlot = (slot: { start: Date; end: Date }) => {
    const snappedStart = snapStart(slot.start);
    const desiredMin = (slot.end.getTime() - slot.start.getTime()) / 60000;
    const durationMin = snapDuration(desiredMin);
    const snappedEnd = new Date(snappedStart.getTime() + durationMin * 60000);
    if (!isWithinLessonHours(snappedStart, snappedEnd)) {
      showToast("Ders 07:00-23:00 aralığında olmalı");
      return;
    }
    setNewLessonSlot({ start: snappedStart, end: snappedEnd });
    setModalOpen(true);
  };

  const handleSelectEvent = (event: TrainingCalendarEvent) => {
    setSelectedEvent(event);
  };

  // Tek kural: ders en az 60 dk. Drag/resize 30 dk granülerlikle
  // snap'lenir; yarım saatlik kayma görsel grid'le hizalanır.
  const LESSON_MIN_MIN = 60;
  const SNAP_MIN = 30;
  const LESSON_HOURS_START = 7;
  const LESSON_HOURS_END = 23;

  const snapStart = (d: Date) => {
    const s = new Date(d);
    const minutes = Math.round(s.getMinutes() / SNAP_MIN) * SNAP_MIN;
    s.setMinutes(0, 0, 0);
    s.setMinutes(minutes);
    return s;
  };

  const snapDuration = (durationMin: number) => {
    const snapped = Math.round(durationMin / SNAP_MIN) * SNAP_MIN;
    return Math.max(LESSON_MIN_MIN, snapped);
  };

  const isWithinLessonHours = (start: Date, end: Date) => {
    if (start.toDateString() !== end.toDateString()) return false;
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    return startHour >= LESSON_HOURS_START && endHour <= LESSON_HOURS_END;
  };

  const handleEventResize = ({
    event,
    start,
    end,
  }: {
    event: TrainingCalendarEvent;
    start: Date;
    end: Date;
  }) => {
    // Kullanıcı hangi kenarı çekti? `event.start` değiştiyse üst kenar.
    const topChanged = start.getTime() !== event.start.getTime();
    let finalStart: Date;
    let finalEnd: Date;
    if (topChanged) {
      finalEnd = event.end;
      const desiredStart = snapStart(start);
      const durationMin = snapDuration(
        (finalEnd.getTime() - desiredStart.getTime()) / 60000
      );
      finalStart = new Date(finalEnd.getTime() - durationMin * 60000);
    } else {
      finalStart = event.start;
      const durationMin = snapDuration(
        (end.getTime() - finalStart.getTime()) / 60000
      );
      finalEnd = new Date(finalStart.getTime() + durationMin * 60000);
    }
    if (!isWithinLessonHours(finalStart, finalEnd)) {
      showToast("Ders 07:00-23:00 aralığında olmalı");
      return;
    }
    void persistEventUpdate(event, {
      startAtUtc: finalStart.toISOString(),
      endAtUtc: finalEnd.toISOString(),
    });
  };

  const handleEventDrop = ({
    event,
    start,
  }: {
    event: TrainingCalendarEvent;
    start: Date;
    end: Date;
  }) => {
    const finalStart = snapStart(start);
    const durationMs = event.end.getTime() - event.start.getTime();
    const finalEnd = new Date(finalStart.getTime() + durationMs);
    if (!isWithinLessonHours(finalStart, finalEnd)) {
      showToast("Ders 07:00-23:00 aralığında olmalı");
      return;
    }
    void persistEventUpdate(event, {
      startAtUtc: finalStart.toISOString(),
      endAtUtc: finalEnd.toISOString(),
    });
  };

  return (
    <>
      <PageToolbar
        actions={
          <>
            <label className="switch-toggle" title="Diğer takvimlerden gelen kayıtları gölge olarak göster">
              <input
                checked={showExternal}
                onChange={(e) => setShowExternal(e.target.checked)}
                type="checkbox"
              />
              <span className="switch-toggle-control" />
              <span>Diğer takvimleri göster</span>
            </label>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setNewLessonSlot(null);
                setModalOpen(true);
              }}
              type="button"
            >
              Yeni Plan
            </button>
          </>
        }
        title={title}
      />

      <div className="training-layout-wrap">
        {loading ? <div className="empty-state">Dersler yükleniyor...</div> : null}
        <div style={{ padding: "0 14px" }}>
          <TrainingWeekSummary events={visibleEvents} />
        </div>
        <div className="training-layout">
          <TrainingFilters
            events={events}
            kind={type}
            onResetFilters={resetFilters}
            onToggleGroup={toggleGroup}
            onToggleInstructor={toggleInstructor}
            onShowAllGroups={showAllGroups}
            onHideAllGroups={hideAllGroups}
            onShowAllInstructors={showAllInstructors}
            onHideAllInstructors={hideAllInstructors}
            visibleGroups={visibleGroups}
            visibleInstructors={visibleInstructors}
          />
          <TrainingCalendar
            events={visibleEvents}
            kind={type}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
          />
        </div>
      </div>

      <NewTrainingPlanModal
        defaultType={type}
        initialSlot={newLessonSlot}
        instructors={instructors}
        groups={groups}
        candidates={candidates}
        vehicles={vehicles}
        areas={areas}
        routes={routes}
        onClose={() => {
          setModalOpen(false);
          setNewLessonSlot(null);
          setServerFieldErrors({});
          setServerGeneralError(undefined);
        }}
        onSubmit={(values) => void handleCreateLesson(values)}
        open={modalOpen}
        serverFieldErrors={serverFieldErrors}
        serverGeneralError={serverGeneralError}
      />

      <TrainingEventDetailModal
        event={selectedEvent}
        instructors={instructors.map((instructor) => ({
          id: instructor.id,
          name: `${instructor.firstName} ${instructor.lastName}`,
        }))}
        onClose={() => setSelectedEvent(null)}
        onDelete={handleDeleteEvent}
        onInstructorChange={(eventId, instructorId) => {
          const event = events.find((item) => item.id === eventId);
          if (!event) return;
          void persistEventUpdate(event, { instructorId });
        }}
        onNotesChange={async (eventId, notes) => {
          const event = events.find((item) => item.id === eventId);
          if (!event) return;
          await persistEventUpdate(event, { notes: notes.trim() || null });
        }}
        onStatusChange={async (eventId, status) => {
          const event = events.find((item) => item.id === eventId);
          if (!event) return;
          await persistEventUpdate(event, { status });
        }}
      />
    </>
  );
}
