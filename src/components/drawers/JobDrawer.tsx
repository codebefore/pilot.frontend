import { useEffect, useMemo, useState } from "react";

import { listMebbisJobSteps, type MebbisJobStepResponse } from "../../lib/mebbis-jobs-api";
import type { MebJob } from "../../mock/mebJobs";
import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { StatusPill } from "../ui/StatusPill";
import { StepTracker, type Step, type StepState } from "../ui/StepTracker";

const ACTIVE_STATUSES = new Set(["running", "queued"]);

type JobDrawerProps = {
  job: MebJob | null;
  onCancel: () => void;
  onClose: () => void;
};

export function JobDrawer({ job, onCancel, onClose }: JobDrawerProps) {
  const [steps, setSteps] = useState<MebbisJobStepResponse[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  useEffect(() => {
    if (!job) {
      setSteps([]);
      return;
    }

    let cancelled = false;
    setLoadingSteps(true);
    listMebbisJobSteps(job.id)
      .then((items) => {
        if (!cancelled) setSteps(items);
      })
      .catch(() => {
        if (!cancelled) setSteps([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSteps(false);
      });

    return () => {
      cancelled = true;
    };
  }, [job]);

  const trackerSteps = useMemo(() => steps.map(mapStep), [steps]);

  if (!job) return null;
  const showCancel = ACTIVE_STATUSES.has(job.status);

  return (
    <Drawer
      actions={
        <>
          {showCancel && (
            <button className="btn btn-danger" onClick={onCancel} type="button">
              İşi İptal Et
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Kapat
          </button>
        </>
      }
      onClose={onClose}
      open
      title={`MEB İşi ${job.jobNo}`}
    >
      <DrawerSection title="Genel Bilgi">
        <DrawerRow label="İş Tipi">{job.jobType}</DrawerRow>
        <DrawerRow label="Aday">
          {job.candidateName ? (
            <>
              {job.candidateName}
              <span className="job-candidate-secondary"> · {job.targetSecondary}</span>
            </>
          ) : (
            job.targetSecondary
          )}
        </DrawerRow>
        <DrawerRow label="Adım">{job.step}</DrawerRow>
        <DrawerRow label="Başlangıç">{formatFullTime(job.startedAtIso)}</DrawerRow>
        <DrawerRow label="Bitiş">
          {job.completedAtIso ? formatFullTime(job.completedAtIso) : "-"}
        </DrawerRow>
        <DrawerRow label="Süre">{formatDuration(job.startedAtIso, job.completedAtIso)}</DrawerRow>
        <DrawerRow label="Durum">
          <StatusPill status={job.status} />
        </DrawerRow>
      </DrawerSection>

      <DrawerSection title="Adımlar">
        {loadingSteps ? (
          <div className="drawer-log">Adımlar yükleniyor.</div>
        ) : trackerSteps.length > 0 ? (
          <StepTracker steps={trackerSteps} />
        ) : (
          <div className="drawer-log">Henüz adım kaydı yok.</div>
        )}
      </DrawerSection>

      {(job.errorMessage || steps.length > 0) && (
        <DrawerSection title="Kayıt Detayı">
          <div className="drawer-log">
            {job.errorMessage && (
              <div>
                <span className="err">{job.errorMessage}</span>
              </div>
            )}
            {steps.map((step) => (
              <div key={step.id}>
                <span className="ts">{formatStepTime(step.createdAtUtc)}</span>{" "}
                <span className="level">{step.status}</span> {step.stepName}
                {step.message ? ` - ${step.message}` : ""}
              </div>
            ))}
          </div>
        </DrawerSection>
      )}
    </Drawer>
  );
}

function mapStep(step: MebbisJobStepResponse): Step {
  return {
    title: stepLabel(step.stepName),
    state: stepState(step.status),
    detail: `${step.message ?? step.status} - ${formatStepTime(step.createdAtUtc)}`,
  };
}

function stepState(status: string): StepState {
  switch (status) {
    case "succeeded":
      return "done";
    case "failed":
      return "error";
    case "needs_manual_action":
      return "error";
    case "started":
      return "active";
    default:
      return "pending";
  }
}

function stepLabel(stepName: string): string {
  const labels: Record<string, string> = {
    job_leased: "İş alındı",
    job_started: "İş başladı",
    mebbis_tab_selected: "MEBBİS tabı seçildi",
    mebbis_tab_opened: "MEBBİS tabı açıldı",
    candidate_lookup_navigation: "Aday durum sayfasına gidildi",
    candidate_lookup_started: "Aday sorgusu başladı",
    lease_renewed: "Kilit yenilendi",
    candidate_lookup_completed: "Aday sorgusu tamamlandı",
    session_check_started: "Oturum kontrolü başladı",
    session_probe_completed: "Oturum kontrolü tamamlandı",
    job_succeeded: "İş tamamlandı",
    job_failed: "İş başarısız",
    job_retry_scheduled: "Eski hata kaydı",
    manual_action_required: "Manuel işlem gerekli",
    job_cancelled: "İş iptal edildi",
  };

  return labels[stepName] ?? stepName;
}

function formatStepTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFullTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "-";
  const end = endIso ? new Date(endIso) : new Date();
  if (Number.isNaN(end.getTime())) return "-";
  const ms = Math.max(0, end.getTime() - start.getTime());
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} sn`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min} dk ${remSec} sn`;
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return `${h} sa ${remMin} dk`;
}
