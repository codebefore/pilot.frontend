import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

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
import { TrainingBranchSummary } from "../components/training/TrainingBranchSummary";
import { TrainingFilters } from "../components/training/TrainingFilters";
import { QuickLessonAssignment } from "../components/training/QuickLessonAssignment";
import { QuickPracticeAssignment } from "../components/training/QuickPracticeAssignment";
import { PracticeCandidatePicker } from "../components/training/PracticeCandidatePicker";
import { useToast } from "../components/ui/Toast";
import { Modal } from "../components/ui/Modal";
import { BranchPickerPopover } from "../components/training/BranchPickerPopover";
import { PracticeEducationPopover } from "../components/training/PracticeEducationPopover";
import {
  calendarEventToTrainingLessonRequest,
  trainingLessonToCalendarEvent,
  type TrainingCalendarEvent,
} from "../lib/training-calendar";
import { getCandidates } from "../lib/candidates-api";
import { getClassrooms } from "../lib/classrooms-api";
import { getGroups } from "../lib/groups-api";
import { getInstructors } from "../lib/instructors-api";
import { getTrainingBranchDefinitions } from "../lib/training-branch-definitions-api";
import {
  clearPracticeCandidateScope,
  getPracticeCandidateScope,
  setPracticeCandidateScope,
} from "../lib/practice-candidate-scope";
import {
  createTrainingLesson,
  deleteTrainingLesson,
  deleteTrainingLessonsByCandidate,
  deleteTrainingLessonsByGroup,
  getTrainingLessons,
  updateTrainingLesson,
} from "../lib/training-lessons-api";
import type {
  CandidateResponse,
  ClassroomResponse,
  GroupResponse,
  InstructorResponse,
  PracticeEducationType,
  TrainingBranchDefinitionResponse,
  TrainingLessonUpsertRequest,
  VehicleResponse,
} from "../lib/types";
import { getVehicles } from "../lib/vehicles-api";

import { buildBranchHelpers } from "../lib/training-branches";

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
  ClassroomId: "classroomId",
  RouteId: "routeId",
  BranchCode: "branchCode",
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
  // Uygulama sayfasında, seçili adayın grubunun teorik dersleri "ghost"
  // (dimmed) event olarak takvimde gösterilir — kullanıcı çakışmayı
  // görsel olarak fark etsin diye. Sadece type === "uygulama"'da dolar.
  const [theoryEventsForOverlay, setTheoryEventsForOverlay] = useState<
    TrainingCalendarEvent[]
  >([]);
  // Simetrik: teorik sayfasında, seçili grubun adaylarının uygulama
  // dersleri ghost event olarak gösterilir. Sadece type === "teorik"'te.
  const [practiceEventsForOverlay, setPracticeEventsForOverlay] = useState<
    TrainingCalendarEvent[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState<InstructorResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [vehicles, setVehicles] = useState<VehicleResponse[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomResponse[]>([]);
  // Branş kataloğu DB'den geliyor (Ayarlar > Tanımlar > Branşlar). Renk,
  // toplam saat limiti ve label hepsi burada — popover/calendar/summary
  // bu listeyi kullanır, hardcoded sabit kullanılmaz.
  const [branches, setBranches] = useState<TrainingBranchDefinitionResponse[]>(
    []
  );
  const [selectedEvent, setSelectedEvent] = useState<TrainingCalendarEvent | null>(null);
  const [isQuickAssignLoading, setIsQuickAssignLoading] = useState(false);
  const [bulkDeleteGroup, setBulkDeleteGroup] = useState<GroupResponse | null>(null);
  const [bulkDeleteCandidate, setBulkDeleteCandidate] = useState<CandidateResponse | null>(null);
  const [isBulkDeleteLoading, setIsBulkDeleteLoading] = useState(false);
  // Adaylar sayfasından bulk yönlendirme ile gelinen aday kümesi.
  // localStorage kalıcı; her yeni yönlendirme önceki scope'u override
  // eder. Boş array → scope yok, tüm aktif adaylar listelenir.
  const [practiceCandidateScope, setPracticeCandidateScopeState] = useState<
    string[]
  >(() => (type === "uygulama" ? getPracticeCandidateScope() : []));

  // Hızlı atama ayarları. Süre artık takvimde drag ile seçilen slot'tan
  // türetiliyor (newLessonSlot.end - start). N saatlik blok = N adet
  // 1 saatlik ayrı ders olarak yaratılır (handleQuickAssign loop).
  const [quickSettings, setQuickSettings] = useState<{
    instructorId: string;
    groupId: string;
    classroomId: string;
    candidateId: string;
    vehicleId: string;
  }>({ instructorId: "", groupId: "", classroomId: "", candidateId: "", vehicleId: "" });

  const [searchParams, setSearchParams] = useSearchParams();

  // Uygulama sayfasına `?candidateId=...` ile gelinmişse o adayı QA'da
  // initial seçili yap. Scope (localStorage'da) zaten CandidatesPage
  // bulk handler'ı tarafından yazıldı; burada sadece QA seçimini set
  // edip query param'ı temizliyoruz.
  useEffect(() => {
    if (type !== "uygulama") return;
    const incomingId = searchParams.get("candidateId");
    if (!incomingId) return;
    setQuickSettings((prev) => ({ ...prev, candidateId: incomingId }));
    // Scope'ta yoksa (direkt link senaryosu) tek-aday scope kur.
    setPracticeCandidateScopeState((prev) => {
      if (prev.length > 0 && prev.includes(incomingId)) return prev;
      if (prev.length > 0) return prev;
      const next = [incomingId];
      setPracticeCandidateScope(next);
      return next;
    });
    // Param'ı temizle ki refresh'te tekrar tetiklenmesin.
    const next = new URLSearchParams(searchParams);
    next.delete("candidateId");
    setSearchParams(next, { replace: true });
  }, [type, searchParams, setSearchParams]);

  const clearPracticeScope = () => {
    setPracticeCandidateScopeState([]);
    clearPracticeCandidateScope();
  };

  const [isBranchPickerOpen, setIsBranchPickerOpen] = useState(false);
  // Uygulama akışında slot tıklayınca eğitim türü popover'ı açılır;
  // seçim yapılınca yakalanan derived id'lerle handleQuickAssignPractice
  // çağrılır. Closure güncel kalsın diye `useRef` ile tutuyoruz.
  const [practicePopoverPos, setPracticePopoverPos] = useState<
    { x: number; y: number } | null
  >(null);
  const pendingPracticeAssignment = useRef<{
    instructorId: string;
    vehicleId: string;
  } | null>(null);
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
      getTrainingBranchDefinitions(
        { activity: "active", pageSize: 100 },
        controller.signal
      ),
      getClassrooms({ activity: "active", pageSize: 100 }, controller.signal),
    ])
      .then(
        ([
          lessonResult,
          instructorResult,
          groupResult,
          candidateResult,
          vehicleResult,
          branchResult,
          classroomResult,
        ]) => {
          setEvents(lessonResult.items.map(trainingLessonToCalendarEvent));
          setInstructors(instructorResult.items);
          setGroups(groupResult.items);
          setCandidates(candidateResult.items);
          setVehicles(vehicleResult.items);
          setBranches(branchResult.items);
          setClassrooms(classroomResult.items);
        }
      )
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

  // Uygulama sayfasında, çakışma görünürlüğü için ek olarak teorik
  // dersleri de çek (overlay havuzu). `quickSettings.candidateId` set
  // edildiğinde, o adayın grubuna ait teorik dersler dimmed event
  // olarak takvimde gösterilir.
  useEffect(() => {
    if (type !== "uygulama") {
      setTheoryEventsForOverlay([]);
      return;
    }
    const controller = new AbortController();
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 90);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setDate(now.getDate() + 180);
    to.setHours(23, 59, 59, 999);
    getTrainingLessons(
      {
        kind: "teorik",
        fromUtc: from.toISOString(),
        toUtc: to.toISOString(),
      },
      controller.signal
    )
      .then((result) => {
        setTheoryEventsForOverlay(
          result.items.map(trainingLessonToCalendarEvent)
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
      });
    return () => controller.abort();
  }, [type]);

  // Simetrik: teorik sayfasında, çakışma görünürlüğü için uygulama
  // dersleri de çek. Grup seçilince o grubun adaylarının uygulama
  // dersleri dimmed gösterilir.
  useEffect(() => {
    if (type !== "teorik") {
      setPracticeEventsForOverlay([]);
      return;
    }
    const controller = new AbortController();
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 90);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setDate(now.getDate() + 180);
    to.setHours(23, 59, 59, 999);
    getTrainingLessons(
      {
        kind: "uygulama",
        fromUtc: from.toISOString(),
        toUtc: to.toISOString(),
      },
      controller.signal
    )
      .then((result) => {
        setPracticeEventsForOverlay(
          result.items.map(trainingLessonToCalendarEvent)
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
      });
    return () => controller.abort();
  }, [type]);

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

  // Quick-assign'da grup DEĞİŞİRSE sidebar grup filtresini o gruba
  // daraltır. Eğitmen filtresine artık dokunulmaz — kullanıcı slot
  // tıklamadan önce manuel olarak tek eğitmeni işaretlesin (tek
  // eğitmen kuralı handleSelectSlot'ta zorlanır).
  const prevQuickGroupRef = useRef<string>("");
  useEffect(() => {
    const nextId = quickSettings.groupId;
    if (nextId === prevQuickGroupRef.current) return;
    prevQuickGroupRef.current = nextId;
    if (!nextId) {
      setVisibleGroups(new Set());
      return;
    }
    const group = groups.find((g) => g.id === nextId);
    if (!group) return;
    setVisibleGroups(new Set([group.title]));
  }, [quickSettings.groupId, groups]);

  // QA'da eğitmen seçimi sidebar filter'ını ETKİLEMEZ. Eğitmen filtresi
  // sadece slot tıklarken (tek eğitmen seçili kuralı) anlamlı. QA'da
  // eğitmen alanı uygulama tarafında ders oluşturma payload'ı için
  // kullanılır; kullanıcı sidebar'da görmek istediği eğitmenleri
  // manuel toggle eder.

  // Aday seçimi sidebar filter state'ini ETKİLEMEZ — teorik tarafta
  // grup seçince eğitmen filter'ına dokunmadığımız gibi, uygulama'da
  // da aday seçince araç/eğitmen filter'larına dokunulmaz. Görünürlük
  // visibleEvents tarafında "aday seçiliyse filter yok say" kuralıyla
  // sağlanır. Filter listeleri yalnızca slot tıklarken anlamlı.

  // Backend'den gelen event.groupName ile groups state'indeki group.title
  // genelde aynı olmalı; ama tutarsızlık olursa groupId üzerinden de eşleştir.
  const groupTitleById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.title])),
    [groups]
  );
  const branchHelpers = useMemo(() => buildBranchHelpers(branches), [branches]);

  // QA seçimi takvimi otomatik bir tarihe odaklar:
  //  - Teorik: seçili grubun startDate'i; seçim yoksa bugün.
  //  - Uygulama: seçili adayın ilk uygulama dersi varsa onun start'ı,
  //    yoksa bugün.
  // Not: "bugün" her useMemo çalışmasında yeni Date olur — referans
  // değişimi TrainingCalendar effect'ini tetiklerse manuel navigate
  // bozulur. O yüzden "bugün" durumunda null dönüp, takvim tarafındaki
  // useEffect null'ı no-op olarak ele alıyor.
  const focusDate = useMemo<Date | null>(() => {
    if (type === "teorik") {
      if (!quickSettings.groupId) return new Date();
      const group = groups.find((g) => g.id === quickSettings.groupId);
      if (!group?.startDate) return new Date();
      return new Date(group.startDate);
    }
    if (!quickSettings.candidateId) return new Date();
    const earliest = events
      .filter(
        (e) => e.kind === "uygulama" && e.candidateId === quickSettings.candidateId
      )
      .reduce<Date | null>(
        (acc, e) => (acc && acc < e.start ? acc : e.start),
        null
      );
    return earliest ?? new Date();
  }, [
    type,
    quickSettings.groupId,
    quickSettings.candidateId,
    groups,
    events,
  ]);

  // Teorik tarafta: seçili grubun startDate'inden önceki günler takvimde
  // filigranlı (disabled) gösterilir. Sadece bilgi amaçlı; backend zaten
  // `beforeGroupStartDate` ile reddediyor.
  const disabledBeforeDate = useMemo<Date | null>(() => {
    if (type !== "teorik") return null;
    if (!quickSettings.groupId) return null;
    const group = groups.find((g) => g.id === quickSettings.groupId);
    if (!group?.startDate) return null;
    return new Date(group.startDate);
  }, [type, quickSettings.groupId, groups]);

  const visibleEvents = useMemo(() => {
    // Görünürlük kuralı:
    //  - Teorik: grup seçili → o gruba ait tüm dersler eğitmen
    //    filtresinden bağımsız tam görünür. Grup seçili değil ama
    //    eğitmen(ler) seçili → o eğitmen(ler)in tüm dersleri görünür.
    //  - Uygulama: aday seçili → o adayın tüm dersleri araç/eğitmen
    //    filtresinden bağımsız tam görünür. Aday seçili değilse araç
    //    (visibleGroups = plaka set) ve eğitmen filtreleri OR olarak
    //    çalışır — işaretli olan eksenden gelen tüm dersler görünür.
    const filtered: TrainingCalendarEvent[] = [];
    for (const e of events) {
      if (type === "uygulama") {
        const focusedCandidate = quickSettings.candidateId;
        if (focusedCandidate) {
          if (e.candidateId === focusedCandidate) filtered.push(e);
          continue;
        }
        const plate = e.vehiclePlate || t("training.filter.noVehicle");
        const vehicleMatches = visibleGroups.has(plate);
        const instructorMatches = visibleInstructors.has(e.instructorId);
        if (vehicleMatches || instructorMatches) filtered.push(e);
        continue;
      }
      // Teorik
      const groupSelected = visibleGroups.size > 0;
      if (groupSelected) {
        let matchesGroup = false;
        if (visibleGroups.has(e.groupName)) {
          matchesGroup = true;
        } else if (e.groupId) {
          const titleFromState = groupTitleById.get(e.groupId);
          if (titleFromState && visibleGroups.has(titleFromState)) {
            matchesGroup = true;
          }
        }
        if (matchesGroup) filtered.push(e);
        continue;
      }
      // Grup seçili değil → eğitmen ekseni: işaretli eğitmen(ler)in
      // dersleri görünür.
      if (visibleInstructors.has(e.instructorId)) filtered.push(e);
    }
    // Quick-assign popover açıksa seçilen aralığı görsel önizleme
    // event'i olarak ekle — kullanıcı hangi slotu işaretlediğini görür.
    if (isBranchPickerOpen && newLessonSlot) {
      filtered.push({
        id: "__preview__",
        title: "Yeni ders",
        start: newLessonSlot.start,
        end: newLessonSlot.end,
        kind: type,
        instructorId: quickSettings.instructorId || "__preview-instructor__",
        instructorName: "",
        groupId: quickSettings.groupId,
        termName: "",
        groupName: "",
        licenseClass: "",
        candidateCount: 0,
        branchCode: null,
        preview: true,
      });
    }
    // Uygulama tarafında: seçili adayın grubunun teorik dersleri
    // hayalet (dimmed) olarak takvime enjekte edilir. Aday/uygulama ders
    // bağlamındaki çakışmayı görsel olarak gösterir; etkileşim devre
    // dışı (dimmed event) kalır.
    if (type === "uygulama" && quickSettings.candidateId) {
      const selectedCandidate = candidates.find(
        (c) => c.id === quickSettings.candidateId
      );
      const candidateGroupId = selectedCandidate?.currentGroup?.groupId;
      if (candidateGroupId) {
        for (const e of theoryEventsForOverlay) {
          if (e.groupId === candidateGroupId) {
            filtered.push({ ...e, dimmed: true });
          }
        }
      }
    }
    // Simetrik: teorik tarafında, seçili grubun adaylarının uygulama
    // dersleri hayalet olarak gösterilir. Aday'ın uygulama derslerinin
    // saatine teorik ders koyulamayacağı için kullanıcı önceden görsün.
    if (type === "teorik" && quickSettings.groupId) {
      const groupCandidateIds = new Set(
        candidates
          .filter((c) => c.currentGroup?.groupId === quickSettings.groupId)
          .map((c) => c.id)
      );
      if (groupCandidateIds.size > 0) {
        for (const e of practiceEventsForOverlay) {
          if (e.candidateId && groupCandidateIds.has(e.candidateId)) {
            filtered.push({ ...e, dimmed: true });
          }
        }
      }
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
    quickSettings.instructorId,
    quickSettings.groupId,
    quickSettings.candidateId,
    candidates,
    theoryEventsForOverlay,
    practiceEventsForOverlay,
    t,
  ]);

  // Eğitmen toggle sadece kendi görünürlüğünü değiştirir; grup/araç
  // ekseni görünürlüğüne dokunulmaz. Eğitmen filtresi takvim
  // görüntüsünü etkilemez (visibleEvents teorik tarafta eğitmen
  // filtresini yok sayar) — sadece slot tıklarken "tek eğitmen seçili"
  // kuralını taşır.
  const toggleInstructor = (id: string) => {
    setVisibleInstructors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Uygulama'da plaka (visibleGroups Set'inde plaka tutuluyor) toggle.
  const toggleGroup = (plate: string) => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(plate)) next.delete(plate);
      else next.add(plate);
      return next;
    });
  };

  // Sıfırla → tüm filtreler false (her şey gizli) + QA seçimleri de
  // temizlenir. Kullanıcı tekrar toggle/dropdown ile istediğini seçer.
  const resetFilters = () => {
    setVisibleGroups(new Set());
    setVisibleInstructors(new Set());
    setQuickSettings({ groupId: "", instructorId: "", classroomId: "", candidateId: "", vehicleId: "" });
  };

  // Bulk toggle: yalnızca filter listesinde görünen kayıtları etkiler.
  // Parent state diğer (görünmeyen) ID'leri korur.
  const setGroupsVisibility = (plates: string[], visible: boolean) => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      plates.forEach((p) => (visible ? next.add(p) : next.delete(p)));
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
      classroomId: values.type === "teorik" ? values.classroomId || null : null,
      routeId: null,
      branchCode: values.type === "teorik" ? values.branchCode || null : null,
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

  const handleQuickAssign = async (branch: string) => {
    const { instructorId, groupId, classroomId } = quickSettings;
    const startTime = newLessonSlot!.start;
    // Süre takvimden seçilen slot'tan türetiliyor — drag ile 4 saat
    // seçildiyse 4 adet 1 saatlik ders oluşturulur. En az 1 saat.
    const totalMs = newLessonSlot!.end.getTime() - startTime.getTime();
    const durationHours = Math.max(1, Math.round(totalMs / (60 * 60 * 1000)));
    const notes = branchHelpers.label(branch) ?? branch;

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
          classroomId,
          routeId: null,
          branchCode: branch,
          licenseClass: null,
          notes,
        };

        const saved = await createTrainingLesson(request);
        const nextEvent = trainingLessonToCalendarEvent(saved);
        setEvents((prev) => [...prev, nextEvent]);
        successCount++;
      }
      // Yeni dersler takvimde anında görünsün diye sidebar filter'ına
      // grubun adı ve eğitmeni eklenir (kullanıcı manuel kapatmış
      // olabilirdi).
      if (successCount > 0) {
        const groupTitle = groups.find((g) => g.id === groupId)?.title;
        if (groupTitle) {
          setVisibleGroups((prev) => {
            if (prev.has(groupTitle)) return prev;
            const next = new Set(prev);
            next.add(groupTitle);
            return next;
          });
        }
        setVisibleInstructors((prev) => {
          if (prev.has(instructorId)) return prev;
          const next = new Set(prev);
          next.add(instructorId);
          return next;
        });
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

  const handleQuickAssignPractice = async (
    practiceEducationType: PracticeEducationType,
    override?: {
      instructorId?: string;
      vehicleId?: string;
    }
  ) => {
    const candidateId = quickSettings.candidateId;
    const instructorId = override?.instructorId ?? quickSettings.instructorId;
    const vehicleId = override?.vehicleId ?? quickSettings.vehicleId;
    const startTime = newLessonSlot!.start;
    const totalMs = newLessonSlot!.end.getTime() - startTime.getTime();
    const durationHours = Math.max(1, Math.round(totalMs / (60 * 60 * 1000)));
    const candidate = candidates.find((c) => c.id === candidateId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    setIsQuickAssignLoading(true);
    let successCount = 0;
    try {
      for (let i = 0; i < durationHours; i++) {
        const lessonStart = new Date(startTime.getTime() + i * 60 * 60 * 1000);
        const lessonEnd = new Date(lessonStart.getTime() + 60 * 60 * 1000);

        const request: TrainingLessonUpsertRequest = {
          kind: "uygulama",
          status: "planned",
          startAtUtc: lessonStart.toISOString(),
          endAtUtc: lessonEnd.toISOString(),
          instructorId,
          groupId: null,
          candidateId,
          vehicleId,
          classroomId: null,
          routeId: null,
          branchCode: null,
          licenseClass: candidate?.licenseClass ?? null,
          practiceEducationType,
          notes: null,
        };

        const saved = await createTrainingLesson(request);
        const nextEvent = trainingLessonToCalendarEvent(saved);
        setEvents((prev) => [...prev, nextEvent]);
        successCount++;
      }
      // Yeni oluşturulan dersler takvimde anında görünsün diye sidebar
      // filter'larına araç plakası ve eğitmeni otomatik visible yap.
      if (successCount > 0) {
        if (vehicle) {
          setVisibleGroups((prev) => {
            if (prev.has(vehicle.plateNumber)) return prev;
            const next = new Set(prev);
            next.add(vehicle.plateNumber);
            return next;
          });
        }
        setVisibleInstructors((prev) => {
          if (prev.has(instructorId)) return prev;
          const next = new Set(prev);
          next.add(instructorId);
          return next;
        });
      }
      showToast(t("training.toast.bulkAssigned", { count: successCount }));
    } catch (error) {
      console.error(error);
      const { fieldErrors, generalError } = splitApiError(error);
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
      setIsQuickAssignLoading(false);
      setNewLessonSlot(null);
      setPracticePopoverPos(null);
      pendingPracticeAssignment.current = null;
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
      // Uygulama'da branş seçimi yok (`practice` tek branş). Aday QA
      // dropdown'ından seçilir; eğitmen ve araç sidebar filtresinden
      // türetilir — ikisinin de tam olarak 1 işaretli olması gerekir.
      const { candidateId } = quickSettings;
      if (!candidateId) {
        showToast(t("training.toast.selectCandidateFirst"));
        return;
      }
      if (visibleInstructors.size !== 1) {
        showToast(t("training.toast.selectExactlyOneInstructor"));
        return;
      }
      if (visibleGroups.size !== 1) {
        showToast(t("training.toast.selectExactlyOneVehicle"));
        return;
      }
      const derivedInstructorId = visibleInstructors.values().next().value;
      const derivedPlate = visibleGroups.values().next().value;
      if (!derivedInstructorId || !derivedPlate) {
        showToast(t("training.toast.selectCandidateFirst"));
        return;
      }
      // Plaka → vehicle.id eşle. Plaka boşsa "araç yok" özel etiketi
      // (oluşturmaya izin verme).
      const derivedVehicle = vehicles.find(
        (v) => v.plateNumber === derivedPlate
      );
      if (!derivedVehicle) {
        showToast(t("training.toast.selectExactlyOneVehicle"));
        return;
      }
      // Aday'ın grubunun teorik dersi planlanan aralıkla çakışıyorsa
      // backend zaten reddeder; ama kullanıcı dene-fail döngüsü görmesin
      // diye burada da blokla.
      const candidate = candidates.find((c) => c.id === candidateId);
      const candidateGroupId = candidate?.currentGroup?.groupId;
      if (candidateGroupId) {
        const blockEndMs = snappedEnd.getTime();
        const conflict = theoryEventsForOverlay.some((te) => {
          if (te.groupId !== candidateGroupId) return false;
          const teStart = te.start.getTime();
          const teEnd = te.end.getTime();
          return teStart < blockEndMs && teEnd > snappedStart.getTime();
        });
        if (conflict) {
          showToast(t("training.toast.candidateTheoryConflict"));
          return;
        }
      }
      // setState async — derived değerleri hem state'e (sonradan kullanım
      // için) hem de pendingPracticeAssignment ref'ine yazıyoruz; popover
      // seçildiğinde ref'i okuyup handleQuickAssignPractice'i çağırırız.
      setQuickSettings((prev) => ({
        ...prev,
        instructorId: derivedInstructorId,
        vehicleId: derivedVehicle.id,
      }));
      pendingPracticeAssignment.current = {
        instructorId: derivedInstructorId,
        vehicleId: derivedVehicle.id,
      };
      setPracticePopoverPos({
        x: lastClickPos.current.x,
        y: lastClickPos.current.y,
      });
      return;
    }

    // Teorik akış: grup QA dropdown'ından, eğitmen ise sidebar
    // filtresinden türetilir. Tam olarak 1 eğitmen visible olmalı —
    // 0 ise hiç seçim yok, 2+ ise hangi eğitmenle ders açacağı belirsiz.
    if (!quickSettings.groupId) {
      showToast(t("training.toast.selectGroupAndInstructorFirst"));
      return;
    }
    if (!quickSettings.classroomId) {
      showToast(t("training.toast.selectClassroomFirst"));
      return;
    }
    if (visibleInstructors.size !== 1) {
      showToast(t("training.toast.selectExactlyOneInstructor"));
      return;
    }
    const derivedInstructorId = visibleInstructors.values().next().value;
    if (!derivedInstructorId) {
      showToast(t("training.toast.selectExactlyOneInstructor"));
      return;
    }
    // Grup başlangıç tarihinden önceye ders atanamaz (backend de
    // beforeGroupStartDate ile reddediyor; UI'da request'i kesip toast).
    if (disabledBeforeDate) {
      const cutoff = new Date(disabledBeforeDate);
      cutoff.setHours(0, 0, 0, 0);
      if (snappedStart.getTime() < cutoff.getTime()) {
        const yyyy = cutoff.getFullYear();
        const mm = String(cutoff.getMonth() + 1).padStart(2, "0");
        const dd = String(cutoff.getDate()).padStart(2, "0");
        showToast(
          t("trainingLesson.validation.beforeGroupStartDate", {
            groupStartDate: `${yyyy}-${mm}-${dd}`,
          })
        );
        return;
      }
    }
    // Çakışma blok: planlanan blok aralığında (snappedStart + N saat)
    // grubun adaylarından herhangi biri uygulama dersi alıyorsa popover
    // açma, toast ile uyar. Backend de aynı kontrolü yapıyor; burası
    // dene-fail döngüsünü kullanıcıya yaşatmamak için.
    const groupCandidateIds = new Set(
      candidates
        .filter((c) => c.currentGroup?.groupId === quickSettings.groupId)
        .map((c) => c.id)
    );
    if (groupCandidateIds.size > 0) {
      const blockEndMs = snappedEnd.getTime();
      const conflict = practiceEventsForOverlay.some((pe) => {
        if (!pe.candidateId || !groupCandidateIds.has(pe.candidateId)) return false;
        const peStart = pe.start.getTime();
        const peEnd = pe.end.getTime();
        return peStart < blockEndMs && peEnd > snappedStart.getTime();
      });
      if (conflict) {
        showToast(t("training.toast.groupPracticeConflict"));
        return;
      }
    }
    // Aşağıdaki create akışı `quickSettings.instructorId`'yi okuyor;
    // setState async olduğu için aynı render'da görünmez. Override'ı
    // anında yaz ve popover'ı aç — handleQuickAssign closure'ını
    // tetikleyen branş seçimi sırasında doğru değer state'te olur.
    setQuickSettings((prev) => ({ ...prev, instructorId: derivedInstructorId }));
    setPopoverPos({
      x: lastClickPos.current.x,
      y: lastClickPos.current.y,
    });
    setIsBranchPickerOpen(true);
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

  const showBackToCandidateList =
    type === "uygulama" && Boolean(quickSettings.candidateId);
  const selectedGroupLessonCount = useMemo(() => {
    if (type !== "teorik" || !quickSettings.groupId) return 0;
    return events.filter(
      (event) => event.kind === "teorik" && event.groupId === quickSettings.groupId
    ).length;
  }, [events, quickSettings.groupId, type]);
  const selectedTheoryGroup = useMemo(
    () =>
      type === "teorik" && quickSettings.groupId
        ? groups.find((group) => group.id === quickSettings.groupId) ?? null
        : null,
    [groups, quickSettings.groupId, type]
  );
  const selectedPracticeCandidate = useMemo(
    () =>
      type === "uygulama" && quickSettings.candidateId
        ? candidates.find((candidate) => candidate.id === quickSettings.candidateId) ?? null
        : null,
    [candidates, quickSettings.candidateId, type]
  );
  const selectedCandidateLessonCount = useMemo(() => {
    if (type !== "uygulama" || !quickSettings.candidateId) return 0;
    return events.filter(
      (event) => event.kind === "uygulama" && event.candidateId === quickSettings.candidateId
    ).length;
  }, [events, quickSettings.candidateId, type]);
  const bulkDeleteGroupLessonCount = useMemo(() => {
    if (!bulkDeleteGroup) return 0;
    return events.filter(
      (event) => event.kind === "teorik" && event.groupId === bulkDeleteGroup.id
    ).length;
  }, [bulkDeleteGroup, events]);

  const handleBulkDeleteGroupLessons = async () => {
    if (!bulkDeleteGroup) return;
    setIsBulkDeleteLoading(true);
    try {
      const result = await deleteTrainingLessonsByGroup(bulkDeleteGroup.id);
      setEvents((prev) =>
        prev.filter(
          (event) => !(event.kind === "teorik" && event.groupId === bulkDeleteGroup.id)
        )
      );
      setSelectedEvent(null);
      setBulkDeleteGroup(null);
      showToast(
        t("training.toast.bulkLessonsDeleted", {
          count: result.deletedCount,
        })
      );
    } catch (error) {
      console.error(error);
      showToast(t("training.toast.bulkLessonsNotDeleted"));
    } finally {
      setIsBulkDeleteLoading(false);
    }
  };

  const handleBulkDeleteCandidateLessons = async () => {
    if (!bulkDeleteCandidate) return;
    setIsBulkDeleteLoading(true);
    try {
      const result = await deleteTrainingLessonsByCandidate(bulkDeleteCandidate.id);
      setEvents((prev) =>
        prev.filter(
          (event) => !(event.kind === "uygulama" && event.candidateId === bulkDeleteCandidate.id)
        )
      );
      setSelectedEvent(null);
      setBulkDeleteCandidate(null);
      showToast(
        t("training.toast.bulkLessonsDeleted", {
          count: result.deletedCount,
        })
      );
    } catch (error) {
      console.error(error);
      showToast(t("training.toast.bulkLessonsNotDeleted"));
    } finally {
      setIsBulkDeleteLoading(false);
    }
  };

  return (
    <>
      <PageToolbar
        actions={
          showBackToCandidateList || selectedTheoryGroup || selectedPracticeCandidate ? (
            <>
              {selectedTheoryGroup ? (
                <>
                  <span className="candidate-bulk-count">
                    {t("training.quick.deleteGroupLessonsHint", {
                      count: selectedGroupLessonCount,
                    })}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={isQuickAssignLoading || isBulkDeleteLoading || selectedGroupLessonCount === 0}
                    onClick={() => setBulkDeleteGroup(selectedTheoryGroup)}
                    type="button"
                  >
                    {t("training.quick.deleteGroupLessons")}
                  </button>
                </>
              ) : null}
              {selectedPracticeCandidate ? (
                <>
                  <span className="candidate-bulk-count">
                    {t("training.quick.deleteGroupLessonsHint", {
                      count: selectedCandidateLessonCount,
                    })}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={isQuickAssignLoading || isBulkDeleteLoading || selectedCandidateLessonCount === 0}
                    onClick={() => setBulkDeleteCandidate(selectedPracticeCandidate)}
                    type="button"
                  >
                    {t("training.quick.deleteCandidateLessons")}
                  </button>
                </>
              ) : null}
              {showBackToCandidateList ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setQuickSettings((prev) => ({ ...prev, candidateId: "" }))
                  }
                  type="button"
                >
                  {t("training.picker.backToList")}
                </button>
              ) : null}
            </>
          ) : undefined
        }
        title={title}
      />

      <div className="training-layout-wrap">
        {loading ? <div className="empty-state">Dersler yükleniyor...</div> : null}
        <div className="training-layout">
          <aside className="training-filters-sidebar">
          {type === "teorik" ? (
	              <QuickLessonAssignment
	                classrooms={classrooms}
	                classroomId={quickSettings.classroomId}
	                groupId={quickSettings.groupId}
	                groups={groups}
                isLoading={isQuickAssignLoading || isBulkDeleteLoading}
                onSettingsChange={(settings) =>
                  setQuickSettings((prev) => ({ ...prev, ...settings }))
                }
              />
            ) : (
              <QuickPracticeAssignment
                candidateId={quickSettings.candidateId}
                candidates={candidates}
                isLoading={isQuickAssignLoading}
                onClearScope={clearPracticeScope}
                onSettingsChange={(settings) =>
                  setQuickSettings((prev) => ({ ...prev, ...settings }))
                }
                scopedCandidateIds={practiceCandidateScope}
              />
            )}
            <TrainingBranchSummary
              branches={branches}
              branchHelpers={branchHelpers}
              candidateId={quickSettings.candidateId || undefined}
              candidates={candidates}
              events={events}
              groupId={quickSettings.groupId || undefined}
              kind={type}
              overlayEvents={
                type === "teorik"
                  ? practiceEventsForOverlay
                  : theoryEventsForOverlay
              }
            />
            <TrainingFilters
              allInstructors={instructors}
              allVehiclesCatalog={vehicles}
              events={events}
              kind={type}
              onResetFilters={resetFilters}
              onSetGroupsVisibility={setGroupsVisibility}
              onSetInstructorsVisibility={setInstructorsVisibility}
              onToggleGroup={toggleGroup}
              onToggleInstructor={toggleInstructor}
              visibleGroups={visibleGroups}
              visibleInstructors={visibleInstructors}
            />
          </aside>
          {type === "uygulama" && !quickSettings.candidateId ? (
            <PracticeCandidatePicker
              events={events}
              onClearScope={clearPracticeScope}
              onPick={(id) =>
                setQuickSettings((prev) => ({ ...prev, candidateId: id }))
              }
              scopedCandidateIds={practiceCandidateScope}
            />
          ) : (
            <div className="training-calendar-wrap">
              <TrainingCalendar
                branchHelpers={branchHelpers}
                disabledBeforeDate={disabledBeforeDate}
                events={visibleEvents}
                focusDate={focusDate}
                kind={type}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
              />
            </div>
          )}
        </div>
      </div>

	        <NewTrainingPlanModal
	        branches={branches}
	        defaultType={type}
        initialSlot={newLessonSlot}
        instructors={instructors}
        groups={groups}
        candidates={candidates}
        vehicles={vehicles}
        classrooms={classrooms}
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

      <Modal
        footer={
          <>
                <button
                  className="btn btn-secondary"
                  disabled={isBulkDeleteLoading}
                  onClick={() => setBulkDeleteGroup(null)}
                  type="button"
                >
              {t("training.bulkDelete.cancel")}
            </button>
            <button
              className="btn btn-danger"
              disabled={isBulkDeleteLoading}
              onClick={() => void handleBulkDeleteGroupLessons()}
              type="button"
            >
              {isBulkDeleteLoading
                ? t("training.bulkDelete.deleting")
                : t("training.bulkDelete.confirm")}
            </button>
          </>
        }
        onClose={() => {
          if (!isBulkDeleteLoading) setBulkDeleteGroup(null);
        }}
        open={bulkDeleteGroup !== null}
        title={t("training.bulkDelete.title")}
      >
        <div className="training-bulk-delete-body">
          <p>
            {t("training.bulkDelete.message", {
              group: bulkDeleteGroup?.title ?? "",
              count: bulkDeleteGroupLessonCount,
            })}
          </p>
          <p className="training-bulk-delete-warning">
            {t("training.bulkDelete.warning")}
          </p>
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={isBulkDeleteLoading}
              onClick={() => setBulkDeleteCandidate(null)}
              type="button"
            >
              {t("training.bulkDelete.cancel")}
            </button>
            <button
              className="btn btn-danger"
              disabled={isBulkDeleteLoading}
              onClick={() => void handleBulkDeleteCandidateLessons()}
              type="button"
            >
              {isBulkDeleteLoading
                ? t("training.bulkDelete.deleting")
                : t("training.bulkDelete.confirm")}
            </button>
          </>
        }
        onClose={() => {
          if (!isBulkDeleteLoading) setBulkDeleteCandidate(null);
        }}
        open={bulkDeleteCandidate !== null}
        title={t("training.bulkDelete.candidateTitle")}
      >
        <div className="training-bulk-delete-body">
          <p>
            {t("training.bulkDelete.candidateMessage", {
              candidate: bulkDeleteCandidate
                ? `${bulkDeleteCandidate.firstName} ${bulkDeleteCandidate.lastName}`.trim()
                : "",
              count: selectedCandidateLessonCount,
            })}
          </p>
          <p className="training-bulk-delete-warning">
            {t("training.bulkDelete.warning")}
          </p>
        </div>
      </Modal>

      {/* Ders konusu seçici popover — tıklanan slotun yanında çıkar
          (chat baloncuğu stili). Outside-click veya Escape ile kapanır;
          slot temizliği `handleQuickAssign`'in finally'sinde. */}
      {isBranchPickerOpen && popoverPos ? (
        <BranchPickerPopover
          availableBranches={availableBranches}
          branchHelpers={branchHelpers}
          isLoading={isQuickAssignLoading}
          onClose={() => setIsBranchPickerOpen(false)}
          onPick={(branch) => void handleQuickAssign(branch)}
          pos={popoverPos}
          slotInfo={
            newLessonSlot
              ? (() => {
                  const fmt = (d: Date) =>
                    d.toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  const totalMs =
                    newLessonSlot.end.getTime() - newLessonSlot.start.getTime();
                  const hours = Math.max(
                    1,
                    Math.round(totalMs / (60 * 60 * 1000))
                  );
                  return t("training.popover.titleWithSlot", {
                    start: fmt(newLessonSlot.start),
                    end: fmt(newLessonSlot.end),
                    hours,
                  });
                })()
              : null
          }
        />
      ) : null}

      {practicePopoverPos ? (
        <PracticeEducationPopover
          isLoading={isQuickAssignLoading}
          onClose={() => {
            setPracticePopoverPos(null);
            pendingPracticeAssignment.current = null;
          }}
          onPick={(educationType) => {
            const pending = pendingPracticeAssignment.current;
            if (!pending) {
              setPracticePopoverPos(null);
              return;
            }
            void handleQuickAssignPractice(educationType, pending);
          }}
          pos={practicePopoverPos}
          slotInfo={
            newLessonSlot
              ? (() => {
                  const fmt = (d: Date) =>
                    d.toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  const totalMs =
                    newLessonSlot.end.getTime() - newLessonSlot.start.getTime();
                  const hours = Math.max(
                    1,
                    Math.round(totalMs / (60 * 60 * 1000))
                  );
                  return t("training.popover.titleWithSlot", {
                    start: fmt(newLessonSlot.start),
                    end: fmt(newLessonSlot.end),
                    hours,
                  });
                })()
              : null
          }
        />
      ) : null}

      <TrainingEventDetailModal
        classrooms={classrooms}
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
        onClassroomChange={async (eventId, classroomId) => {
          const event = events.find((item) => item.id === eventId);
          if (!event || event.kind !== "teorik") return;
          await persistEventUpdate(event, { classroomId });
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
