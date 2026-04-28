import { useMemo } from "react";

import { useT } from "../../lib/i18n";
import type { BranchHelpers } from "../../lib/training-branches";
import type {
  TrainingCalendarEvent,
  TrainingEventKind,
} from "../../lib/training-calendar";
import type {
  CandidateResponse,
  TrainingBranchDefinitionResponse,
} from "../../lib/types";

type TrainingBranchSummaryProps = {
  /** Filtre için ham event'ler (tüm sayfa eventleri — bileşen kendi
   *  filtresini groupId/candidateId üzerinden uygular). */
  events: TrainingCalendarEvent[];
  /** Diğer kind'dan ghost saatler için overlay havuzu. Teorik sayfada
   *  uygulama event'leri, uygulama sayfada teorik event'leri. */
  overlayEvents?: TrainingCalendarEvent[];
  /** Aday → grup eşlemesi (teorik özetinde grubun adaylarının
   *  uygulama saatlerini bulmak için). */
  candidates?: CandidateResponse[];
  branches: TrainingBranchDefinitionResponse[];
  branchHelpers: BranchHelpers;
  kind: TrainingEventKind;
  /** Teorik için seçili grup. Yoksa bileşen render edilmez. */
  groupId?: string;
  /** Uygulama için seçili aday. Yoksa bileşen render edilmez. */
  candidateId?: string;
};

// `event.end - event.start` saat farkı. 1 saatlik blok = 1 ders kuralı,
// ama tarihsel veri 2+ saatlik tek event tutuyor olabilir; saat olarak
// sayıyoruz (toplam yine doğru olur).
function hoursOf(event: TrainingCalendarEvent): number {
  const ms = event.end.getTime() - event.start.getTime();
  return ms / (60 * 60 * 1000);
}

export function TrainingBranchSummary({
  events,
  overlayEvents = [],
  candidates = [],
  branches,
  branchHelpers,
  kind,
  groupId,
  candidateId,
}: TrainingBranchSummaryProps) {
  const t = useT();

  // Bu sayfanın anlamlı branşları:
  //  - Teorik: practice hariç hepsi (eğitim verilen branşlar).
  //  - Uygulama: sadece practice satırı.
  const visibleBranches = useMemo(() => {
    return branches.filter((b) =>
      kind === "uygulama" ? b.code === "practice" : b.code !== "practice"
    );
  }, [branches, kind]);

  // İlgili event'leri filtrele:
  //  - Teorik: kind === teorik && groupId match.
  //  - Uygulama: kind === uygulama && candidateId match.
  const scopedEvents = useMemo(() => {
    if (kind === "teorik") {
      if (!groupId) return [];
      return events.filter(
        (e) => e.kind === "teorik" && e.groupId === groupId
      );
    }
    if (!candidateId) return [];
    return events.filter(
      (e) => e.kind === "uygulama" && e.candidateId === candidateId
    );
  }, [events, kind, groupId, candidateId]);

  // Branş code başına saat toplamı (ana sayfanın kendi kind'ı).
  const hoursByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of scopedEvents) {
      const code =
        e.kind === "uygulama"
          ? "practice"
          : e.branchCode ?? branchHelpers.detectFromNotes(e.notes);
      if (!code) continue;
      map.set(code, (map.get(code) ?? 0) + hoursOf(e));
    }
    return map;
  }, [scopedEvents, branchHelpers]);

  // Diğer kind'dan ghost saatler:
  //  - Teorik sayfada: seçili grubun adaylarının uygulama dersleri →
  //    `practice` satırı dimmed olarak yan eksene eklenir.
  //  - Uygulama sayfada: seçili adayın grubunun teorik dersleri →
  //    teorik branş başına dimmed satırlar.
  const ghostHoursByCode = useMemo(() => {
    const map = new Map<string, number>();
    if (kind === "teorik" && groupId) {
      const groupCandidateIds = new Set(
        candidates
          .filter((c) => c.currentGroup?.groupId === groupId)
          .map((c) => c.id)
      );
      for (const e of overlayEvents) {
        if (e.kind !== "uygulama") continue;
        if (!e.candidateId || !groupCandidateIds.has(e.candidateId)) continue;
        map.set("practice", (map.get("practice") ?? 0) + hoursOf(e));
      }
    } else if (kind === "uygulama" && candidateId) {
      const candidate = candidates.find((c) => c.id === candidateId);
      const candidateGroupId = candidate?.currentGroup?.groupId;
      if (candidateGroupId) {
        for (const e of overlayEvents) {
          if (e.kind !== "teorik") continue;
          if (e.groupId !== candidateGroupId) continue;
          const code =
            e.branchCode ?? branchHelpers.detectFromNotes(e.notes);
          if (!code) continue;
          map.set(code, (map.get(code) ?? 0) + hoursOf(e));
        }
      }
    }
    return map;
  }, [kind, groupId, candidateId, candidates, overlayEvents, branchHelpers]);

  // Ghost satırlar — ana özetten farklı branş code'larını ek satır olarak
  // göster. Hem code'u hem rendering için meta'yı önceden hesapla.
  const ghostBranches = useMemo(() => {
    const ownCodes = new Set(visibleBranches.map((b) => b.code));
    return Array.from(ghostHoursByCode.keys())
      .filter((code) => !ownCodes.has(code))
      .map((code) => branchHelpers.byCode(code))
      .filter((b): b is TrainingBranchDefinitionResponse => Boolean(b));
  }, [ghostHoursByCode, visibleBranches, branchHelpers]);

  const isHidden = kind === "teorik" ? !groupId : !candidateId;
  if (isHidden || visibleBranches.length === 0) return null;

  const round = (n: number) => Math.round(n * 10) / 10;

  return (
    <section className="training-branch-summary">
      <ul className="training-branch-summary-list">
        {visibleBranches.map((branch) => {
          const given = hoursByCode.get(branch.code) ?? 0;
          const target = branch.totalLessonHourLimit;
          const incomplete = target != null && given < target;
          const palette = branchHelpers.color(branch.code);
          return (
            <li className="training-branch-summary-row" key={branch.id}>
              <span
                aria-hidden="true"
                className="training-branch-summary-dot"
                style={
                  palette
                    ? { background: palette.bg, borderColor: palette.border }
                    : undefined
                }
              />
              <span className="training-branch-summary-name">{branch.name}</span>
              <span
                className={
                  incomplete
                    ? "training-branch-summary-count training-branch-summary-count-incomplete"
                    : "training-branch-summary-count"
                }
              >
                {target != null
                  ? t("training.branchSummary.fraction", {
                      given: round(given),
                      target,
                    })
                  : round(given)}
              </span>
            </li>
          );
        })}
        {ghostBranches.map((branch) => {
          const given = ghostHoursByCode.get(branch.code) ?? 0;
          const target = branch.totalLessonHourLimit;
          const palette = branchHelpers.color(branch.code);
          return (
            <li
              className="training-branch-summary-row training-branch-summary-row-ghost"
              key={`ghost-${branch.id}`}
            >
              <span
                aria-hidden="true"
                className="training-branch-summary-dot"
                style={
                  palette
                    ? { background: palette.bg, borderColor: palette.border }
                    : undefined
                }
              />
              <span className="training-branch-summary-name">{branch.name}</span>
              <span className="training-branch-summary-count">
                {target != null
                  ? t("training.branchSummary.fraction", {
                      given: round(given),
                      target,
                    })
                  : round(given)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
