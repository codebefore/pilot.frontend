import { useEffect, useMemo, useState } from "react";
import { currentLocale, useT, type TranslationKey } from "../../lib/i18n";

import { listMebbisJobSteps, type MebbisJobStepResponse } from "../../lib/mebbis-jobs-api";
import type { MebJob } from "../../lib/mebbis-jobs";
import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { StatusPill } from "../ui/StatusPill";
import { StepTracker, type Step, type StepState } from "../ui/StepTracker";

const ACTIVE_STATUSES = new Set(["running", "queued"]);

type JobDrawerProps = {
  job: MebJob | null;
  canCancel?: boolean;
  onCancel: () => void;
  onClose: () => void;
};

export function JobDrawer({ job, canCancel = true, onCancel, onClose }: JobDrawerProps) {
  const t = useT();
  const [steps, setSteps] = useState<MebbisJobStepResponse[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  useEffect(() => {
    if (!job) {
      setSteps([]);
      return;
    }

    const controller = new AbortController();
    setLoadingSteps(true);
    listMebbisJobSteps(job.id, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setSteps(items);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSteps([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSteps(false);
      });

    return () => {
      controller.abort();
    };
  }, [job]);

  const trackerSteps = useMemo(() => steps.map((s) => mapStep(s, t)), [steps, t]);

  if (!job) return null;
  const showCancel = ACTIVE_STATUSES.has(job.status);

  return (
    <Drawer
      actions={
        <>
          {showCancel && (
            <button
              className="btn btn-danger"
              disabled={!canCancel}
              onClick={onCancel}
              title={!canCancel ? t("common.noPermission") : undefined}
              type="button"
            >
              {t("jobDrawer.cancelButton")}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose} type="button">
            {t("common.close")}
          </button>
        </>
      }
      onClose={onClose}
      open
      title={`${t("jobDrawer.title")} ${job.jobNo}`}
    >
      <DrawerSection title={t("jobDrawer.section.general")}>
        <DrawerRow label={t("jobDrawer.row.jobType")}>{job.jobType}</DrawerRow>
        <DrawerRow label={t("jobDrawer.row.candidate")}>
          {job.candidateName ? (
            <>
              {job.candidateName}
              <span className="job-candidate-secondary"> · {job.targetSecondary}</span>
            </>
          ) : (
            job.targetSecondary
          )}
        </DrawerRow>
        <DrawerRow label={t("jobDrawer.row.step")}>{job.step}</DrawerRow>
        <DrawerRow label={t("jobDrawer.row.startedAt")}>{formatFullTime(job.startedAtIso)}</DrawerRow>
        <DrawerRow label={t("jobDrawer.row.completedAt")}>
          {job.completedAtIso ? formatFullTime(job.completedAtIso) : "-"}
        </DrawerRow>
        <DrawerRow label={t("jobDrawer.row.duration")}>{formatDuration(job.startedAtIso, job.completedAtIso, t)}</DrawerRow>
        <DrawerRow label={t("jobDrawer.row.status")}>
          <StatusPill status={job.status} />
        </DrawerRow>
        <DrawerRow label={t("jobDrawer.row.queue")}>{formatQueuePublishStatus(job, t)}</DrawerRow>
        {job.queuePublishError && (
          <DrawerRow label={t("jobDrawer.row.queueError")}>{job.queuePublishError}</DrawerRow>
        )}
      </DrawerSection>

      <DrawerSection title={t("jobDrawer.section.steps")}>
        {loadingSteps ? (
          <div className="drawer-log">{t("jobDrawer.stepsLoading")}</div>
        ) : trackerSteps.length > 0 ? (
          <StepTracker steps={trackerSteps} />
        ) : (
          <div className="drawer-log">{t("jobDrawer.stepsEmpty")}</div>
        )}
      </DrawerSection>

      {(job.errorMessage || steps.length > 0) && (
        <DrawerSection title={t("jobDrawer.section.log")}>
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

function mapStep(step: MebbisJobStepResponse, t: (key: TranslationKey) => string): Step {
  return {
    title: stepLabel(step.stepName, t),
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

const STEP_LABEL_KEY: Record<string, TranslationKey> = {
  job_leased: "jobDrawer.step.jobLeased",
  job_started: "jobDrawer.step.jobStarted",
  mebbis_tab_selected: "jobDrawer.step.mebbisTabSelected",
  mebbis_tab_opened: "jobDrawer.step.mebbisTabOpened",
  candidate_lookup_navigation: "jobDrawer.step.candidateLookupNavigation",
  candidate_lookup_started: "jobDrawer.step.candidateLookupStarted",
  lease_renewed: "jobDrawer.step.leaseRenewed",
  candidate_lookup_completed: "jobDrawer.step.candidateLookupCompleted",
  session_check_started: "jobDrawer.step.sessionCheckStarted",
  session_probe_completed: "jobDrawer.step.sessionProbeCompleted",
  job_succeeded: "jobDrawer.step.jobSucceeded",
  job_failed: "jobDrawer.step.jobFailed",
  job_retry_scheduled: "jobDrawer.step.jobRetryScheduled",
  manual_action_required: "jobDrawer.step.manualActionRequired",
  job_cancelled: "jobDrawer.step.jobCancelled",
};

function stepLabel(stepName: string, t: (key: TranslationKey) => string): string {
  const key = STEP_LABEL_KEY[stepName];
  return key ? t(key) : stepName;
}

function formatStepTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString(currentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFullTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(currentLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatQueuePublishStatus(
  job: MebJob,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  if (job.queuePublishError) {
    return t("jobDrawer.queue.streamError", { count: job.queuePublishAttemptCount ?? 0 });
  }

  if (job.queuePublishedAtIso) {
    return t("jobDrawer.queue.streamPublished", { at: formatFullTime(job.queuePublishedAtIso) });
  }

  if (job.queuePublishLastAttemptAtIso) {
    return t("jobDrawer.queue.dbFallback", { at: formatFullTime(job.queuePublishLastAttemptAtIso) });
  }

  return t("jobDrawer.queue.dbQueue");
}

function formatDuration(
  startIso: string,
  endIso: string | null,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "-";
  const end = endIso ? new Date(endIso) : new Date();
  if (Number.isNaN(end.getTime())) return "-";
  const ms = Math.max(0, end.getTime() - start.getTime());
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return t("jobDrawer.duration.seconds", { sec });
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return t("jobDrawer.duration.minutes", { min, sec: remSec });
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return t("jobDrawer.duration.hours", { h, min: remMin });
}
