import { useEffect, useMemo, useRef, useState } from "react";

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
import { QuickLessonAssignment } from "../components/training/QuickLessonAssignment";
import { TrainingWeekSummary } from "../components/training/TrainingWeekSummary";
import { useToast } from "../components/ui/Toast";
import { BranchPickerPopover } from "../components/training/BranchPickerPopover";
import {
  calendarEventToTrainingLessonRequest,
  trainingLessonToCalendarEvent,
  type TrainingCalendarEvent,
} from "../lib/training-calendar";
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

import { BRANCH_LABELS } from "../lib/training-branches";

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
  const [isQuickAssignLoading, setIsQuickAssignLoading] = useState(false);

  // Hızlı atama ayarları — durationHours ayrı state olarak Calendar
  // gutter input'unda canlı kontrol ediliyor.
  const [quickSettings, setQuickSettings] = useState<{
    instructorId: string;
    groupId: string;
  }>({ instructorId: "", groupId: "" });
  // Quick-assign saat sayısı sayfa yenilemesinde kaybolmasın diye
  // localStorage'a yansıtılıyor (1-8 aralığında).
  const [quickDurationHours, setQuickDurationHours] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("pilot.training.quickDuration");
      if (stored) {
        const n = parseInt(stored, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 8) return n;
      }
    } catch {
      /* ignore */
    }
    return 1;
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        "pilot.training.quickDuration",
        String(quickDurationHours)
      );
    } catch {
      /* ignore */
    }
  }, [quickDurationHours]);
  
  const [isBranchPickerOpen, setIsBranchPickerOpen] = useState(false);
  // Branş popover'ının ekran üzerindeki konumu — tıklanan slotun
  // hizasında çıksın diye son mouseup pozisyonu yakalanır. RBC
  // `onSelectSlot` mouse event'i taşımıyor; bu yüzden global listener.
  const lastClickPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      lastClickPos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mouseup", handler, true);
    return () => window.removeEventListener("mouseup", handler, true);
  }, []);

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
        setEvents(lessonResult.items.map(trainingLessonToCalendarEvent));
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
        showToast(t("training.toast.lessonsLoadFailed"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [showToast, type]);

  // Filtreler boş başlar — kullanıcı görmek istediği grup/eğitmeni
  // sidebar'dan açar. Yeni eklenen grup/eğitmen otomatik visible
  // olmaz; bu kural quick-assign akışıyla tutarlı (orada da seçim
  // temizlenince filtreler boşalıyor).
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [visibleInstructors, setVisibleInstructors] = useState<Set<string>>(
    () => new Set()
  );

  // Quick-assign'da grup DEĞİŞİRSE sidebar filter'ı sadece o gruba
  // collapse olur. Eğitmen filtresi de gruba bağlı senkronize edilir:
  // o grubun mevcut event'lerinde dersi olan eğitmenler visible olur.
  const prevQuickGroupRef = useRef<string>("");
  useEffect(() => {
    const nextId = quickSettings.groupId;
    if (nextId === prevQuickGroupRef.current) return;
    prevQuickGroupRef.current = nextId;
    if (!nextId) {
      setVisibleGroups(new Set());
      setVisibleInstructors(new Set());
      return;
    }
    const group = groups.find((g) => g.id === nextId);
    if (!group) return;
    setVisibleGroups(new Set([group.title]));
    const groupInstructorIds = new Set(
      events
        .filter((e) => e.groupId === nextId)
        .map((e) => e.instructorId)
    );
    setVisibleInstructors(groupInstructorIds);
  }, [quickSettings.groupId, groups, events]);

  // Aynı kural eğitmen için: QA'da eğitmen değişirse sidebar filter'ı
  // sadece o eğitmene collapse olur. Grup henüz seçilmediyse, eğitmenin
  // dersleri olan gruplar da otomatik visible olur (calendar boş kalmasın).
  const prevQuickInstructorRef = useRef<string>("");
  useEffect(() => {
    const nextId = quickSettings.instructorId;
    if (nextId === prevQuickInstructorRef.current) return;
    prevQuickInstructorRef.current = nextId;
    if (!nextId) {
      setVisibleGroups(new Set());
      setVisibleInstructors(new Set());
      return;
    }
    setVisibleInstructors(new Set([nextId]));
    if (!quickSettings.groupId) {
      const instructorGroupNames = new Set(
        events
          .filter((e) => e.instructorId === nextId)
          .map((e) =>
            type === "uygulama"
              ? (e.vehiclePlate || t("training.filter.noVehicle"))
              : e.groupName
          )
      );
      if (instructorGroupNames.size > 0) {
        setVisibleGroups(instructorGroupNames);
      }
    }
  }, [quickSettings.instructorId, quickSettings.groupId, events, type]);

  // Backend'den gelen event.groupName ile groups state'indeki group.title
  // genelde aynı olmalı; ama tutarsızlık olursa (legacy veri, trim farkı,
  // race) groupId üzerinden de eşleştir — visibilityCollapse `group.title`
  // yazıyor; eğer event'in groupName'i farklıysa groupId fallback yakalar.
  const groupTitleById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.title])),
    [groups]
  );

  const visibleEvents = useMemo(() => {
    // Önce grup filtresini uygula. Eğitmen visible değilse event'i
    // çıkarmak yerine `dimmed: true` ile şeffaf hayalet olarak göster —
    // kullanıcı "bu slot başka eğitmen tarafından alınmış" sinyalini
    // alsın (özellikle aynı grupta farklı eğitmen seçince).
    const filtered: TrainingCalendarEvent[] = [];
    for (const e of events) {
      let matchesGroup = false;
      if (type === "uygulama") {
        matchesGroup = visibleGroups.has(e.vehiclePlate || t("training.filter.noVehicle"));
      } else {
        if (visibleGroups.has(e.groupName)) {
          matchesGroup = true;
        } else if (e.groupId) {
          const titleFromState = groupTitleById.get(e.groupId);
          if (titleFromState && visibleGroups.has(titleFromState)) {
            matchesGroup = true;
          }
        }
      }
      if (!matchesGroup) continue;
      const instructorVisible = visibleInstructors.has(e.instructorId);
      if (instructorVisible) {
        filtered.push(e);
      } else {
        filtered.push({ ...e, dimmed: true });
      }
    }
    // Quick-assign popover açıksa seçilen aralığı görsel önizleme
    // event'i olarak ekle — kullanıcı hangi slotu işaretlediğini görür.
    if (isBranchPickerOpen && newLessonSlot) {
      const previewEnd = new Date(
        newLessonSlot.start.getTime() + quickDurationHours * 60 * 60 * 1000
      );
      filtered.push({
        id: "__preview__",
        title: "Yeni ders",
        start: newLessonSlot.start,
        end: previewEnd,
        kind: type,
        instructorId: quickSettings.instructorId || "__preview-instructor__",
        instructorName: "",
        groupId: quickSettings.groupId,
        termName: "",
        groupName: "",
        licenseClass: "",
        candidateCount: 0,
        preview: true,
      });
    }
    return filtered;
  }, [
    events,
    visibleGroups,
    visibleInstructors,
    type,
    groupTitleById,
    isBranchPickerOpen,
    newLessonSlot,
    quickDurationHours,
    quickSettings.instructorId,
    quickSettings.groupId,
  ]);

  const toggleGroup = (group: string) => {
    const willTurnOn = !visibleGroups.has(group);
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
    const matchesGroup = (e: TrainingCalendarEvent, name: string) =>
      type === "uygulama"
        ? (e.vehiclePlate || t("training.filter.noVehicle")) === name
        : e.groupName === name ||
          (e.groupId !== undefined &&
            e.groupId !== null &&
            groupTitleById.get(e.groupId) === name);
    const groupInstructorIds = events
      .filter((e) => matchesGroup(e, group))
      .map((e) => e.instructorId);
    if (groupInstructorIds.length === 0) return;
    if (willTurnOn) {
      // Açıldığında: o grubun eğitmenlerini de visible yap → calendar
      // boş kalmasın.
      setVisibleInstructors((prev) => {
        const next = new Set(prev);
        groupInstructorIds.forEach((id) => next.add(id));
        return next;
      });
      return;
    }
    // Kapatıldığında: bu grubun eğitmenlerinden sadece "başka görünür
    // grupta dersi olmayan"ları visible'dan çıkar. Eğitmen birden fazla
    // visible grupta ders veriyorsa korunur (diğer gruplar hidden olmasın).
    const otherVisibleGroups = new Set(visibleGroups);
    otherVisibleGroups.delete(group);
    setVisibleInstructors((prev) => {
      const next = new Set(prev);
      groupInstructorIds.forEach((id) => {
        const stillTeachesAnotherVisible = events.some(
          (e) =>
            e.instructorId === id &&
            !matchesGroup(e, group) &&
            (type === "uygulama"
              ? otherVisibleGroups.has(e.vehiclePlate || t("training.filter.noVehicle"))
              : Array.from(otherVisibleGroups).some((g) => matchesGroup(e, g)))
        );
        if (!stillTeachesAnotherVisible) next.delete(id);
      });
      return next;
    });
  };

  const toggleInstructor = (id: string) => {
    const willTurnOn = !visibleInstructors.has(id);
    setVisibleInstructors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    const eventGroupName = (e: TrainingCalendarEvent) =>
      type === "uygulama"
        ? (e.vehiclePlate || t("training.filter.noVehicle"))
        : e.groupName;
    const instructorGroupNames = events
      .filter((e) => e.instructorId === id)
      .map(eventGroupName);
    if (instructorGroupNames.length === 0) return;
    if (willTurnOn) {
      // Eğitmen AÇILINCA: dersleri olan gruplar da otomatik visible olur.
      setVisibleGroups((prev) => {
        const next = new Set(prev);
        instructorGroupNames.forEach((g) => next.add(g));
        return next;
      });
      return;
    }
    // KAPATILINCA: o eğitmenin gruplarından, başka görünür eğitmen tarafından
    // verilmeyenleri visible'dan çıkar.
    const otherVisibleInstructors = new Set(visibleInstructors);
    otherVisibleInstructors.delete(id);
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      instructorGroupNames.forEach((g) => {
        const stillTaughtByAnother = events.some(
          (e) =>
            eventGroupName(e) === g &&
            e.instructorId !== id &&
            otherVisibleInstructors.has(e.instructorId)
        );
        if (!stillTaughtByAnother) next.delete(g);
      });
      return next;
    });
  };

  // Sıfırla → tüm filtreler false (her şey gizli) + QA seçimleri de
  // temizlenir. Kullanıcı tekrar toggle/dropdown ile istediğini seçer.
  const resetFilters = () => {
    setVisibleGroups(new Set());
    setVisibleInstructors(new Set());
    setQuickSettings({ groupId: "", instructorId: "" });
  };

  // Bulk toggle: yalnızca filter listesinde görünen kayıtları etkiler.
  // Parent state diğer (görünmeyen) ID'leri korur.
  const setGroupsVisibility = (groupNames: string[], visible: boolean) => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      groupNames.forEach((g) => (visible ? next.add(g) : next.delete(g)));
      return next;
    });
  };

  const setInstructorsVisibility = (ids: string[], visible: boolean) => {
    setVisibleInstructors((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (visible ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const title =
    type === "teorik"
      ? t("training.page.title.teorik")
      : t("training.page.title.uygulama");

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
      return { fieldErrors: {}, generalError: t("training.toast.lessonNotSaved") };
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
      generalError =
        error.status === 409
          ? t("training.toast.fallbackConflict")
          : t("training.toast.lessonNotSaved");
    }
    return { fieldErrors, generalError };
  };

  const handleQuickAssign = async (notes: string) => {
    const { instructorId, groupId } = quickSettings;
    const durationHours = quickDurationHours;
    const startTime = newLessonSlot!.start;
    
    setIsQuickAssignLoading(true);
    let successCount = 0;
    try {
      for (let i = 0; i < durationHours; i++) {
        const lessonStart = new Date(startTime.getTime() + i * 60 * 60 * 1000);
        const lessonEnd = new Date(lessonStart.getTime() + 60 * 60 * 1000);

        const request: TrainingLessonUpsertRequest = {
          kind: "teorik",
          status: "planned",
          startAtUtc: lessonStart.toISOString(),
          endAtUtc: lessonEnd.toISOString(),
          instructorId,
          groupId,
          candidateId: null,
          vehicleId: null,
          areaId: null,
          routeId: null,
          licenseClass: null,
          notes,
        };

        const saved = await createTrainingLesson(request);
        const nextEvent = trainingLessonToCalendarEvent(saved);
        setEvents((prev) => [...prev, nextEvent]);
        successCount++;
      }
      showToast(t("training.toast.bulkAssigned", { count: successCount }));
    } catch (error) {
      console.error(error);
      const { fieldErrors, generalError } = splitApiError(error);
      // Çakışma kodları (`InstructorConflict`/`VehicleConflict`) field
      // mapping'i sebebiyle `fieldErrors`'a düşer; quick assign'da form
      // alanı yok, mesajı yansıtmak için ilk field error'a geri düş.
      const baseMsg =
        generalError ??
        Object.values(fieldErrors)[0] ??
        t("training.toast.lessonNotSaved");
      const remaining = durationHours - successCount;
      const msg =
        successCount > 0
          ? t("training.toast.partialAssigned", {
              success: successCount,
              remaining,
              message: baseMsg,
            })
          : baseMsg;
      showToast(msg);
    } finally {
      // Picker'ı her durumda kapat ve slot'u temizle — kullanıcı tekrar
      // tıklarsa önceden başarılı kayıtlarla çakışma olmasın. Yeni atama
      // için takvimden yeni slot seçmesi gerekir.
      setIsQuickAssignLoading(false);
      setNewLessonSlot(null);
      setIsBranchPickerOpen(false);
    }
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
      showToast(t("training.toast.lessonCreated"));
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
    try {
      const saved = await updateTrainingLesson(
        event.id,
        calendarEventToTrainingLessonRequest(event, overrides)
      );
      replaceEvent(trainingLessonToCalendarEvent(saved));
      showToast(t("training.toast.lessonUpdated"));
    } catch (error) {
      console.error(error);
      const { fieldErrors, generalError } = splitApiError(error);
      // Update yolunda inline form yok — tüm mesajları toast'ta birleştir.
      const merged = [
        ...Object.values(fieldErrors),
        ...(generalError ? [generalError] : []),
      ];
      showToast(merged[0] ?? t("training.toast.lessonNotSaved"));
    }
  };

  const handleDeleteEvent = async (event: TrainingCalendarEvent) => {
    try {
      await deleteTrainingLesson(event.id);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      setSelectedEvent(null);
      showToast(t("training.toast.lessonDeleted"));
    } catch (error) {
      console.error(error);
      showToast(t("training.toast.lessonNotDeleted"));
    }
  };

  const handleSelectSlot = (slot: { start: Date; end: Date }) => {
    const snappedStart = snapStart(slot.start);
    const desiredMin = (slot.end.getTime() - slot.start.getTime()) / 60000;
    const durationMin = snapDuration(desiredMin);
    const snappedEnd = new Date(snappedStart.getTime() + durationMin * 60000);
    if (!isWithinLessonHours(snappedStart, snappedEnd)) {
      showToast(t("training.toast.outsideHours"));
      return;
    }
    setNewLessonSlot({ start: snappedStart, end: snappedEnd });
    
    if (type === "uygulama") {
      setModalOpen(true);
    } else {
      // Teorik derste, eğer grup ve eğitmen seçiliyse branş seçiciyi aç
      if (quickSettings.groupId && quickSettings.instructorId) {
        setPopoverPos({
          x: lastClickPos.current.x,
          y: lastClickPos.current.y,
        });
        setIsBranchPickerOpen(true);
      } else {
        showToast(t("training.toast.selectGroupAndInstructorFirst"));
      }
    }
  };

  const handleSelectEvent = (event: TrainingCalendarEvent) => {
    setSelectedEvent(event);
  };

  // Tek kural: ders en az 60 dk. Drag/resize tam saat snap (yarım saat
  // snap kaldırıldı); takvimin step=60 grid'iyle birebir hizalı.
  const LESSON_MIN_MIN = 60;
  const SNAP_MIN = 60;
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
      showToast(t("training.toast.outsideHours"));
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
      showToast(t("training.toast.outsideHours"));
      return;
    }
    void persistEventUpdate(event, {
      startAtUtc: finalStart.toISOString(),
      endAtUtc: finalEnd.toISOString(),
    });
  };

  const selectedInstructor = useMemo(() => 
    instructors.find(i => i.id === quickSettings.instructorId),
    [instructors, quickSettings.instructorId]
  );

  const availableBranches = useMemo(() => 
    selectedInstructor?.branches.filter(b => b !== "practice") || [],
    [selectedInstructor]
  );

  return (
    <>
      <PageToolbar title={title} />

      <div className="training-layout-wrap">
        {loading ? <div className="empty-state">Dersler yükleniyor...</div> : null}
        <div style={{ padding: "0 14px" }}>
          <TrainingWeekSummary events={visibleEvents} />
        </div>
        <div className="training-layout">
          <aside className="training-filters-sidebar">
            {type === "teorik" && (
              <QuickLessonAssignment
                groupId={quickSettings.groupId}
                groups={groups}
                instructorId={quickSettings.instructorId}
                instructors={instructors}
                isLoading={isQuickAssignLoading}
                onSettingsChange={(settings) => setQuickSettings(settings)}
                selectedSlot={newLessonSlot}
              />
            )}
            <TrainingFilters
              allGroupsCatalog={groups}
              allInstructors={instructors}
              events={events}
              kind={type}
              onResetFilters={resetFilters}
              onToggleGroup={toggleGroup}
              onToggleInstructor={toggleInstructor}
              onSetGroupsVisibility={setGroupsVisibility}
              onSetInstructorsVisibility={setInstructorsVisibility}
              visibleGroups={visibleGroups}
              visibleInstructors={visibleInstructors}
            />
          </aside>
          <TrainingCalendar
            durationHours={quickDurationHours}
            events={visibleEvents}
            kind={type}
            onDurationHoursChange={setQuickDurationHours}
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

      {/* Ders konusu seçici popover — tıklanan slotun yanında çıkar
          (chat baloncuğu stili). Outside-click veya Escape ile kapanır;
          slot temizliği `handleQuickAssign`'in finally'sinde. */}
      {isBranchPickerOpen && popoverPos ? (
        <BranchPickerPopover
          availableBranches={availableBranches}
          isLoading={isQuickAssignLoading}
          onClose={() => setIsBranchPickerOpen(false)}
          onPick={(branch) => void handleQuickAssign(BRANCH_LABELS[branch])}
          pos={popoverPos}
          slotInfo={
            newLessonSlot
              ? (() => {
                  const fmt = (d: Date) =>
                    d.toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  const end = new Date(
                    newLessonSlot.start.getTime() +
                      quickDurationHours * 60 * 60 * 1000
                  );
                  return t("training.popover.titleWithSlot", {
                    start: fmt(newLessonSlot.start),
                    end: fmt(end),
                    hours: quickDurationHours,
                  });
                })()
              : null
          }
        />
      ) : null}

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
