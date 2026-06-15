import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { ApiError } from "../lib/http";
import { useAuth } from "../lib/auth";
import { useT, currentLocale } from "../lib/i18n";
import type { TranslationKey } from "../lib/i18n";
import { PageToolbar } from "../components/layout/PageToolbar";
import { MebIcon } from "../components/icons";
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
import { PageSkeleton } from "../components/ui/Skeleton";
import {
  calendarEventToTrainingLessonRequest,
  trainingLessonToCalendarEvent,
  type TrainingCalendarEvent,
} from "../lib/training-calendar";
import { getCandidates, getCandidateById } from "../lib/candidates-api";
import { getGroupById, getGroups } from "../lib/groups-api";
import { getInstructors } from "../lib/instructors-api";
import { candidateKeys } from "../lib/queries/use-candidates";
import { groupKeys } from "../lib/queries/use-groups";
import {
  createTheoryScheduleImportJob,
  createTheoryScheduleSyncJob,
  getMebbisJob,
} from "../lib/mebbis-jobs-api";
import { getTrainingBranchDefinitions } from "../lib/training-branch-definitions-api";
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
  GroupResponse,
  InstructorResponse,
  PracticeEducationType,
  TrainingBranchDefinitionResponse,
  TrainingLessonUpsertRequest,
  VehicleResponse,
} from "../lib/types";
import { getVehicles } from "../lib/vehicles-api";
import { canManageArea } from "../lib/permissions";

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
  BranchCode: "branchCode",
};

const GENERAL_CODES = new Set<string>([
  "trainingLesson.validation.rowVersionRequired",
  "trainingLesson.validation.concurrencyConflict",
  "trainingLesson.validation.generic",
]);

type ActiveMebbisTrainingJob = {
  groupId: string;
  jobType: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getMebbisImportExpectedLessonCount(resultJson: string | null): number | null {
  if (!resultJson) return null;
  try {
    const result = JSON.parse(resultJson) as {
      importedLessonCount?: unknown;
      updatedLessonCount?: unknown;
      rows?: unknown;
    };
    if (Array.isArray(result.rows)) return result.rows.length;
    const importedLessonCount =
      typeof result.importedLessonCount === "number" ? result.importedLessonCount : 0;
    const updatedLessonCount =
      typeof result.updatedLessonCount === "number" ? result.updatedLessonCount : 0;
    const totalChanged = importedLessonCount + updatedLessonCount;
    if (totalChanged > 0) return totalChanged;
  } catch {
    return null;
  }
  return null;
}

function notifyMebbisJobQueued(jobId: string, jobType: string): void {
  const delays = [0, 250, 1000, 2500];
  for (const delay of delays) {
    window.setTimeout(() => {
      window.postMessage(
        {
          type: "pilot:mebbis-job-queued",
          jobId,
          jobType,
        },
        window.location.origin
      );
    }, delay);
  }
}

export function TrainingPage({ type }: TrainingPageProps) {
  const { showToast } = useToast();
  const t = useT();
  const { user, permissions } = useAuth();
  const canManageTraining = canManageArea(user, permissions, "training");
  const canManageMebJobs = canManageArea(user, permissions, "mebjobs");
  const noPermissionTitle = t("common.noPermission");
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [serverGeneralError, setServerGeneralError] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [newLessonSlot, setNewLessonSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [events, setEvents] = useState<TrainingCalendarEvent[]>([]);
  // Overlay events (ghost rendering for cross-cutting conflict visibility).
  // Uygulama page → theory overlay, teorik page → practice overlay.
  // Date range is a fixed ±90/180-day window around now; recomputed only on
  // type change so React Query caches it correctly across re-renders.
  const overlayWindow = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 90);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setDate(now.getDate() + 180);
    to.setHours(23, 59, 59, 999);
    return { fromUtc: from.toISOString(), toUtc: to.toISOString() };
  }, [type]);

  const theoryOverlayQuery = useQuery({
    queryKey: ["training", "lessons", "overlay", "teorik", overlayWindow],
    queryFn: ({ signal }) => getTrainingLessons({ kind: "teorik", ...overlayWindow }, signal),
    enabled: type === "uygulama",
  });
  const theoryEventsForOverlay = useMemo<TrainingCalendarEvent[]>(
    () =>
      type === "uygulama"
        ? theoryOverlayQuery.data?.items.map(trainingLessonToCalendarEvent) ?? []
        : [],
    [type, theoryOverlayQuery.data]
  );

  const practiceOverlayQuery = useQuery({
    queryKey: ["training", "lessons", "overlay", "uygulama", overlayWindow],
    queryFn: ({ signal }) => getTrainingLessons({ kind: "uygulama", ...overlayWindow }, signal),
    enabled: type === "teorik",
  });
  const practiceEventsForOverlay = useMemo<TrainingCalendarEvent[]>(
    () =>
      type === "teorik"
        ? practiceOverlayQuery.data?.items.map(trainingLessonToCalendarEvent) ?? []
        : [],
    [type, practiceOverlayQuery.data]
  );
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const queryClient = useQueryClient();
  const invalidateTrainingLessons = () => {
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "groups"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: groupKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const instructorsQuery = useQuery({
    queryKey: ["training", "instructors"],
    queryFn: ({ signal }) => getInstructors({ activity: "active", page: 1, pageSize: 100 }, signal),
  });
  const instructors: InstructorResponse[] = instructorsQuery.data?.items ?? [];

  const groupsQuery = useQuery({
    queryKey: ["training", "groups"],
    queryFn: ({ signal }) => getGroups({ page: 1, pageSize: 100 }, signal),
  });
  const groups: GroupResponse[] = groupsQuery.data?.items ?? [];

  const vehiclesQuery = useQuery({
    queryKey: ["training", "vehicles"],
    queryFn: ({ signal }) => getVehicles({ activity: "active", page: 1, pageSize: 100 }, signal),
  });
  const vehicles: VehicleResponse[] = vehiclesQuery.data?.items ?? [];

  // Branş kataloğu DB'den geliyor (Ayarlar > Tanımlar > Branşlar). Renk,
  // toplam saat limiti ve label hepsi burada — popover/calendar/summary
  // bu listeyi kullanır, hardcoded sabit kullanılmaz.
  const branchesQuery = useQuery({
    queryKey: ["training", "branches"],
    queryFn: ({ signal }) => getTrainingBranchDefinitions({ activity: "active", pageSize: 100 }, signal),
  });
  const branches: TrainingBranchDefinitionResponse[] = branchesQuery.data?.items ?? [];
  const [selectedEvent, setSelectedEvent] = useState<TrainingCalendarEvent | null>(null);
  const [isQuickAssignLoading, setIsQuickAssignLoading] = useState(false);
  const [isMebbisTransferLoading, setIsMebbisTransferLoading] = useState(false);
  const [isMebbisImportLoading, setIsMebbisImportLoading] = useState(false);
  const [mebbisImportedFocusDate, setMebbisImportedFocusDate] = useState<Date | null>(null);
  const [bulkDeleteGroup, setBulkDeleteGroup] = useState<GroupResponse | null>(null);
  const [bulkDeleteCandidate, setBulkDeleteCandidate] = useState<CandidateResponse | null>(null);
  const [isBulkDeleteLoading, setIsBulkDeleteLoading] = useState(false);
  // Hızlı atama ayarları. Süre artık takvimde drag ile seçilen slot'tan
  // türetiliyor (newLessonSlot.end - start). N saatlik blok = N adet
  // 1 saatlik ayrı ders olarak yaratılır (handleQuickAssign loop).
  const [quickSettings, setQuickSettings] = useState<{
    instructorId: string;
    groupId: string;
    candidateId: string;
    vehicleId: string;
  }>({ instructorId: "", groupId: "", candidateId: "", vehicleId: "" });

  const [searchParams, setSearchParams] = useSearchParams();

  // Aday detayından `?assignCandidateId=...` ile gelinirse tek-aday
  // ders atama intent'i açıkça başlatılır. Direkt sayfa girişinde hiçbir
  // aday otomatik seçilmez.
  useEffect(() => {
    if (type !== "uygulama") return;
    const incomingId = searchParams.get("assignCandidateId");
    if (!incomingId) return;
    setQuickSettings((prev) => ({ ...prev, candidateId: incomingId }));
    // Param'ı temizle ki refresh'te tekrar tetiklenmesin.
    const next = new URLSearchParams(searchParams);
    next.delete("assignCandidateId");
    setSearchParams(next, { replace: true });
  }, [type, searchParams, setSearchParams]);

  // assignCandidateId ile gelen veya picker aksiyonundan seçilen aday,
  // TrainingPage'in genel candidates sayfasında olmayabilir. Sidebar ve
  // overlay hesapları boş kalmasın diye eksik adayı detail endpoint'inden
  // tekil olarak merge ederiz.
  useEffect(() => {
    if (type !== "uygulama") return;
    if (!quickSettings.candidateId) return;
    const known = new Set(candidates.map((c) => c.id));
    if (known.has(quickSettings.candidateId)) return;
    const controller = new AbortController();
    getCandidateById(quickSettings.candidateId, controller.signal)
      .catch(() => null)
      .then((candidate) => {
      if (controller.signal.aborted) return;
      if (!candidate) return;
      setCandidates((prev) => {
        const have = new Set(prev.map((c) => c.id));
        return have.has(candidate.id) ? prev : [...prev, candidate];
      });
    });
    return () => controller.abort();
  }, [type, quickSettings.candidateId, candidates]);

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
  const mebbisPollTimersRef = useRef<number[]>([]);
  const mebbisPollingJobIdsRef = useRef<Set<string>>(new Set());
  const mebbisPollControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [activeMebbisTrainingJobs, setActiveMebbisTrainingJobs] = useState<
    Record<string, ActiveMebbisTrainingJob>
  >({});
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      lastClickPos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mouseup", handler, true);
    return () => window.removeEventListener("mouseup", handler, true);
  }, []);

  useEffect(() => {
    return () => {
      for (const timerId of mebbisPollTimersRef.current) {
        window.clearTimeout(timerId);
      }
      for (const controller of mebbisPollControllersRef.current.values()) {
        controller.abort();
      }
      mebbisPollTimersRef.current = [];
      mebbisPollControllersRef.current.clear();
      mebbisPollingJobIdsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    Promise.all([
      getTrainingLessons(
        {
          kind: type,
          fromUtc: overlayWindow.fromUtc,
          toUtc: overlayWindow.toUtc,
        },
        controller.signal
      ),
      type === "teorik"
        ? getCandidates({ page: 1, pageSize: 100 }, controller.signal)
        : Promise.resolve(null),
    ])
      .then(([lessonResult, candidateResult]) => {
        setEvents(lessonResult.items.map(trainingLessonToCalendarEvent));
        if (candidateResult) {
          setCandidates(candidateResult.items);
        }
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
  }, [overlayWindow, showToast, t, type]);

  // Uygulama sayfasında, çakışma görünürlüğü için ek olarak teorik
  // dersleri de çek (overlay havuzu). `quickSettings.candidateId` set
  // edildiğinde, o adayın grubuna ait teorik dersler dimmed event
  // olarak takvimde gösterilir.

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
    if (!nextId) {
      prevQuickGroupRef.current = "";
      setVisibleGroups(new Set());
      setMebbisImportedFocusDate(null);
      return;
    }
    const group = groups.find((g) => g.id === nextId);
    if (!group) return;
    if (nextId === prevQuickGroupRef.current) {
      return;
    }
    prevQuickGroupRef.current = nextId;
    setMebbisImportedFocusDate(null);
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
  const groupTermIdById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.term.id])),
    [groups]
  );
  const visibleTheoryTermIds = useMemo(() => {
    if (type !== "teorik" || visibleGroups.size === 0) return new Set<string>();
    return new Set(
      groups
        .filter((group) => visibleGroups.has(group.title))
        .map((group) => group.term.id)
    );
  }, [groups, type, visibleGroups]);
  const visibleTheoryLessonGroupKey = useMemo(() => {
    if (type !== "teorik" || visibleGroups.size === 0) return "";
    const selectedTermIds = new Set(
      groups
        .filter((group) => visibleGroups.has(group.title))
        .map((group) => group.term.id)
    );
    if (selectedTermIds.size === 0) return "";
    return groups
      .filter((group) => selectedTermIds.has(group.term.id))
      .map((group) => group.id)
      .sort()
      .join("|");
  }, [groups, type, visibleGroups]);
  const branchHelpers = useMemo(() => buildBranchHelpers(branches), [branches]);

  useEffect(() => {
    if (type !== "teorik" || !visibleTheoryLessonGroupKey) return;

    const controller = new AbortController();
    const groupIds = visibleTheoryLessonGroupKey.split("|").filter(Boolean);

    fetchTheoryLessonsForGroupIds(groupIds, controller.signal)
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        showToast(t("training.toast.lessonsLoadFailed"));
      });

    return () => controller.abort();
  }, [showToast, t, type, visibleTheoryLessonGroupKey]);

  function fetchTheoryLessonsForGroupIds(
    groupIds: string[],
    signal?: AbortSignal
  ): Promise<TrainingCalendarEvent[]> {
    const uniqueGroupIds = [...new Set(groupIds.filter(Boolean))];
    if (uniqueGroupIds.length === 0) return Promise.resolve([]);

    return Promise.all(
      uniqueGroupIds.map((groupId) =>
        getTrainingLessons({ kind: "teorik", groupId }, signal)
      )
    ).then((results) => {
      const groupEvents = results.flatMap((result) =>
        result.items.map(trainingLessonToCalendarEvent)
      );
      setEvents((current) => {
        const next = new Map(current.map((event) => [event.id, event]));
        for (const event of groupEvents) {
          next.set(event.id, event);
        }
        return Array.from(next.values()).sort(
          (a, b) => a.start.getTime() - b.start.getTime()
        );
      });
      return groupEvents;
    });
  }

  async function refreshTheoryLessonsAfterMebbisImport(
    groupId: string,
    updatedGroup?: GroupResponse,
    expectedLessonCount?: number | null
  ): Promise<void> {
    if (type !== "teorik") return;
    const group = updatedGroup ?? groups.find((item) => item.id === groupId);
    const groupIds = group
      ? (() => {
          const groupsInTerm = groups.filter((item) => item.term.id === group.term.id);
          return groupsInTerm.some((item) => item.id === group.id)
            ? groupsInTerm.map((item) => item.id)
            : [...groupsInTerm.map((item) => item.id), group.id];
        })()
      : [groupId];

    let importedEvents: TrainingCalendarEvent[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (attempt > 0 || expectedLessonCount) {
        await delay(attempt === 0 ? 1000 : 1500);
      }

      importedEvents = await fetchTheoryLessonsForGroupIds(groupIds);
      const groupEvents = importedEvents.filter((event) => event.groupId === groupId);
      if (!expectedLessonCount || groupEvents.length >= expectedLessonCount) {
        break;
      }
    }

    const firstImportedEvent = importedEvents
      .filter((event) => event.groupId === groupId)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    setMebbisImportedFocusDate(firstImportedEvent?.start ?? null);
  }

  // QA seçimi takvimi otomatik bir tarihe odaklar:
  //  - Teorik: seçili grubun startDate'i; seçim yoksa bugün.
  //  - Uygulama: seçili adayın ilk uygulama dersi varsa onun start'ı,
  //    yoksa bugün.
  // Not: "bugün" her useMemo çalışmasında yeni Date olur — referans
  // değişimi TrainingCalendar effect'ini tetiklerse manuel navigate
  // bozulur. O yüzden "bugün" durumunda null dönüp, takvim tarafındaki
  // useEffect null'ı no-op olarak ele alıyor.
  const focusDate = useMemo<Date | null>(() => {
    if (type === "teorik" && mebbisImportedFocusDate) {
      return mebbisImportedFocusDate;
    }
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
    mebbisImportedFocusDate,
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
          const termIdFromState = groupTermIdById.get(e.groupId);
          if (termIdFromState && visibleTheoryTermIds.has(termIdFromState)) {
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
        title: t("training.preview.newLesson"),
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
    groupTermIdById,
    visibleTheoryTermIds,
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
    setQuickSettings({ groupId: "", instructorId: "", candidateId: "", vehicleId: "" });
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
      classroomId: null,
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
    if (!canManageTraining || !newLessonSlot) return;
    const { instructorId, groupId } = quickSettings;
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
          classroomId: null,
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
      invalidateTrainingLessons();
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
    if (!canManageTraining || !newLessonSlot) return;
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
      invalidateTrainingLessons();
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
    if (!canManageTraining) return;
    setServerFieldErrors({});
    setServerGeneralError(undefined);
    try {
      const saved = await createTrainingLesson(buildCreateRequest(values));
      const nextEvent = trainingLessonToCalendarEvent(saved);
      setEvents((prev) => [...prev, nextEvent]);
      setModalOpen(false);
      setNewLessonSlot(null);
      invalidateTrainingLessons();
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
    if (!canManageTraining) return;
    try {
      const saved = await updateTrainingLesson(
        event.id,
        calendarEventToTrainingLessonRequest(event, overrides)
      );
      replaceEvent(trainingLessonToCalendarEvent(saved));
      invalidateTrainingLessons();
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
    if (!canManageTraining) return;
    try {
      await deleteTrainingLesson(event.id);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      setSelectedEvent(null);
      invalidateTrainingLessons();
      showToast(t("training.toast.lessonDeleted"));
    } catch (error) {
      console.error(error);
      showToast(t("training.toast.lessonNotDeleted"));
    }
  };

  const handleSelectSlot = (slot: { start: Date; end: Date }) => {
    if (!canManageTraining) return;
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
    if (!canManageTraining) return;
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
    if (!canManageTraining) return;
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

  const refreshGroupAfterMebbisTransfer = async (
    groupId: string,
    expectedMebStatus?: string
  ) => {
    let updatedGroup = await getGroupById(groupId);
    for (let attempt = 0; expectedMebStatus && attempt < 8; attempt += 1) {
      if (updatedGroup.mebStatus?.trim().toLowerCase() === expectedMebStatus) {
        break;
      }
      await delay(1500);
      updatedGroup = await getGroupById(groupId);
    }
    queryClient.setQueryData<typeof groupsQuery.data>(
      ["training", "groups"],
      (current) =>
        current
          ? {
              ...current,
              items: current.items.map((group) =>
                group.id === groupId ? updatedGroup : group
              ),
            }
          : current
    );
    return updatedGroup;
  };

  const finishMebbisJobPoll = (jobId: string) => {
    mebbisPollControllersRef.current.get(jobId)?.abort();
    mebbisPollControllersRef.current.delete(jobId);
    mebbisPollingJobIdsRef.current.delete(jobId);
    setActiveMebbisTrainingJobs((current) => {
      if (!(jobId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[jobId];
      return next;
    });
  };

  const scheduleMebbisJobPoll = (
    jobId: string,
    groupId: string,
    jobType: string,
    startedAt = Date.now()
  ) => {
    if (mebbisPollingJobIdsRef.current.has(jobId)) {
      return;
    }

    mebbisPollingJobIdsRef.current.add(jobId);
    setActiveMebbisTrainingJobs((current) => ({
      ...current,
      [jobId]: { groupId, jobType },
    }));
    queueMebbisJobPoll(jobId, groupId, startedAt);
  };

  const queueMebbisJobPoll = (jobId: string, groupId: string, startedAt: number) => {
    const timerId = window.setTimeout(async () => {
      mebbisPollTimersRef.current = mebbisPollTimersRef.current.filter((id) => id !== timerId);
      const controller = new AbortController();
      mebbisPollControllersRef.current.set(jobId, controller);
      try {
        const job = await getMebbisJob(jobId, controller.signal);
        mebbisPollControllersRef.current.delete(jobId);
        if (job.status === "succeeded") {
          const updatedGroup = await refreshGroupAfterMebbisTransfer(
            groupId,
            job.jobType === "theory_schedule_sync" ? "sent" : undefined
          );
          if (job.jobType === "theory_schedule_import") {
            await refreshTheoryLessonsAfterMebbisImport(
              groupId,
              updatedGroup,
              getMebbisImportExpectedLessonCount(job.resultJson)
            );
          }
          invalidateTrainingLessons();
          void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          finishMebbisJobPoll(jobId);
          showToast(t(
            job.jobType === "theory_schedule_import"
              ? "training.toast.mebbisImportCompleted"
              : "training.toast.mebbisTransferCompleted"
          ));
          return;
        }

        if (["failed", "needs_manual_action", "cancelled"].includes(job.status)) {
          void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          finishMebbisJobPoll(jobId);
          showToast(t("training.toast.mebbisTransferNeedsManualAction"));
          return;
        }

        if (Date.now() - startedAt < 30 * 60 * 1000) {
          queueMebbisJobPoll(jobId, groupId, startedAt);
          return;
        }

        finishMebbisJobPoll(jobId);
        showToast(t("training.toast.mebbisTransferStillRunning"));
      } catch (error) {
        mebbisPollControllersRef.current.delete(jobId);
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error(error);
        if (Date.now() - startedAt < 30 * 60 * 1000) {
          queueMebbisJobPoll(jobId, groupId, startedAt);
          return;
        }

        finishMebbisJobPoll(jobId);
        showToast(t("training.toast.mebbisTransferStillRunning"));
      }
    }, 5000);

    mebbisPollTimersRef.current.push(timerId);
  };

  const handleCreateTheoryScheduleSyncJob = async () => {
    if (!canManageMebJobs) return;
    if (!selectedTheoryGroup) {
      showToast(t("training.toast.selectGroupForMebbisTransfer"));
      return;
    }

    setIsMebbisTransferLoading(true);
    try {
      const job = await createTheoryScheduleSyncJob(selectedTheoryGroup.id);
      notifyMebbisJobQueued(job.id, job.jobType);
      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showToast(t("training.toast.mebbisTransferQueued"));
      scheduleMebbisJobPoll(job.id, selectedTheoryGroup.id, job.jobType);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("training.toast.mebbisTransferFailed")
          : t("training.toast.mebbisTransferFailed");
      showToast(message);
    } finally {
      setIsMebbisTransferLoading(false);
    }
  };

  const handleCreateTheoryScheduleImportJob = async () => {
    if (!canManageMebJobs) return;
    if (!selectedTheoryGroup) {
      showToast(t("training.toast.selectGroupForMebbisImport"));
      return;
    }

    setIsMebbisImportLoading(true);
    try {
      const job = await createTheoryScheduleImportJob(selectedTheoryGroup.id);
      notifyMebbisJobQueued(job.id, job.jobType);
      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showToast(t("training.toast.mebbisImportQueued"));
      scheduleMebbisJobPoll(job.id, selectedTheoryGroup.id, job.jobType);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("training.toast.mebbisImportFailed")
          : t("training.toast.mebbisImportFailed");
      showToast(message);
    } finally {
      setIsMebbisImportLoading(false);
    }
  };

  const handleBulkDeleteGroupLessons = async () => {
    if (!canManageTraining) return;
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
      invalidateTrainingLessons();
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
    if (!canManageTraining) return;
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
      invalidateTrainingLessons();
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

  const activeMebbisImportJob = Object.values(activeMebbisTrainingJobs).find(
    (job) => job.jobType === "theory_schedule_import"
  );
  const activeMebbisTransferJob = Object.values(activeMebbisTrainingJobs).find(
    (job) => job.jobType === "theory_schedule_sync"
  );
  const activeMebbisStatusGroupId =
    activeMebbisImportJob?.groupId ?? activeMebbisTransferJob?.groupId ?? null;
  const activeMebbisStatusGroup = activeMebbisStatusGroupId
    ? groups.find((group) => group.id === activeMebbisStatusGroupId)
    : null;
  const activeMebbisStatusMessage = activeMebbisImportJob
    ? t("training.mebbis.importRunning", {
        group: activeMebbisStatusGroup?.title ?? "",
      })
    : activeMebbisTransferJob
      ? t("training.mebbis.transferRunning", {
          group: activeMebbisStatusGroup?.title ?? "",
        })
      : null;

  return (
    <>
      <PageToolbar
        actions={
          type === "teorik" || showBackToCandidateList || selectedTheoryGroup || selectedPracticeCandidate ? (
            <>
              {type === "teorik" ? (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={
                    !canManageMebJobs ||
                    !selectedTheoryGroup ||
                    isQuickAssignLoading ||
                    isBulkDeleteLoading ||
                    isMebbisTransferLoading ||
                    isMebbisImportLoading
                  }
                  onClick={handleCreateTheoryScheduleSyncJob}
                  title={!canManageMebJobs ? noPermissionTitle : undefined}
                  type="button"
                >
                  <MebIcon size={14} />
                  {isMebbisTransferLoading
                    ? t("training.mebbis.transferQueuing")
                    : t("training.mebbis.transfer")}
                </button>
              ) : null}
              {type === "teorik" ? (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={
                    !canManageMebJobs ||
                    !selectedTheoryGroup ||
                    isQuickAssignLoading ||
                    isBulkDeleteLoading ||
                    isMebbisTransferLoading ||
                    isMebbisImportLoading
                  }
                  onClick={handleCreateTheoryScheduleImportJob}
                  title={!canManageMebJobs ? noPermissionTitle : undefined}
                  type="button"
                >
                  <MebIcon size={14} />
                  {isMebbisImportLoading
                    ? t("training.mebbis.importQueuing")
                    : t("training.mebbis.import")}
                </button>
              ) : null}
              {selectedTheoryGroup ? (
                <>
                  <span className="candidate-bulk-count">
                    {t("training.quick.deleteGroupLessonsHint", {
                      count: selectedGroupLessonCount,
                    })}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={!canManageTraining || isQuickAssignLoading || isBulkDeleteLoading || selectedGroupLessonCount === 0}
                    onClick={() => {
                      if (!canManageTraining) return;
                      setBulkDeleteGroup(selectedTheoryGroup);
                    }}
                    title={!canManageTraining ? noPermissionTitle : undefined}
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
                    disabled={!canManageTraining || isQuickAssignLoading || isBulkDeleteLoading || selectedCandidateLessonCount === 0}
                    onClick={() => {
                      if (!canManageTraining) return;
                      setBulkDeleteCandidate(selectedPracticeCandidate);
                    }}
                    title={!canManageTraining ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {t("training.quick.deleteCandidateLessons")}
                  </button>
                </>
              ) : null}
              {showBackToCandidateList ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setQuickSettings((prev) => ({ ...prev, candidateId: "" }));
                  }}
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
        {type === "teorik" && activeMebbisStatusMessage ? (
          <div className="training-mebbis-status" role="status" aria-live="polite">
            <MebIcon size={16} />
            <span>{activeMebbisStatusMessage}</span>
          </div>
        ) : null}
        {loading ? (
          <PageSkeleton />
        ) : (
          <div className="training-layout">
            <aside className="training-filters-sidebar">
              {type === "teorik" ? (
                <QuickLessonAssignment
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
                  onSettingsChange={(settings) =>
                    setQuickSettings((prev) => ({ ...prev, ...settings }))
                  }
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
                onAssign={(id) => {
                  setQuickSettings((prev) => ({ ...prev, candidateId: id }));
                }}
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
                  readOnly={!canManageTraining}
                />
              </div>
            )}
          </div>
        )}
      </div>

	        <NewTrainingPlanModal
	        branches={branches}
	        canManage={canManageTraining}
	        defaultType={type}
        initialSlot={newLessonSlot}
        instructors={instructors}
        groups={groups}
        candidates={candidates}
	        vehicles={vehicles}
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
              disabled={isBulkDeleteLoading || !canManageTraining}
              onClick={() => void handleBulkDeleteGroupLessons()}
              title={!canManageTraining ? noPermissionTitle : undefined}
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
              disabled={isBulkDeleteLoading || !canManageTraining}
              onClick={() => void handleBulkDeleteCandidateLessons()}
              title={!canManageTraining ? noPermissionTitle : undefined}
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
          onPick={(branch) => {
            if (!canManageTraining) return;
            void handleQuickAssign(branch);
          }}
          pos={popoverPos}
          slotInfo={
            newLessonSlot
              ? (() => {
                  const fmt = (d: Date) =>
                    d.toLocaleTimeString(currentLocale(), {
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
            if (!canManageTraining) return;
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
                    d.toLocaleTimeString(currentLocale(), {
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
        readOnly={!canManageTraining}
      />
    </>
  );
}
