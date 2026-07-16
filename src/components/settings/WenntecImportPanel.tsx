import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/http";
import { currentLocale, useT, type TranslationKey } from "../../lib/i18n";
import { canManageArea, canViewArea } from "../../lib/permissions";
import {
  analyzeWenntecImport,
  applyWenntecImport,
  getWenntecImportBatch,
  listWenntecImportReviewItems,
  listWenntecImportBatches,
  resolveWenntecImportReviewItem,
  type WenntecImportBatch,
  type WenntecImportSummary,
} from "../../lib/wenntec-import-api";
import { useToast } from "../ui/Toast";
import { StatusPill } from "../ui/StatusPill";

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const MIGRATION_ACCESS_REQUIRED_TITLE = "Verified migration approval is required.";

type SummaryMetric = {
  labelKey: TranslationKey;
  value: (summary: WenntecImportSummary) => number;
  money?: boolean;
};

const SUMMARY_METRICS: SummaryMetric[] = [
  { labelKey: "settings.migration.wenntec.metric.total", value: (summary) => summary.totalRows },
  { labelKey: "settings.migration.wenntec.metric.eligible", value: (summary) => summary.eligibleRows },
  { labelKey: "settings.migration.wenntec.metric.paid", value: (summary) => summary.paidCandidateAmount, money: true },
  { labelKey: "settings.migration.wenntec.metric.open", value: (summary) => summary.openCandidateAmount, money: true },
  { labelKey: "settings.migration.wenntec.metric.tracking", value: (summary) => summary.trackingCandidateAmount, money: true },
  { labelKey: "settings.migration.wenntec.metric.income", value: (summary) => summary.incomeAmount, money: true },
  { labelKey: "settings.migration.wenntec.metric.expense", value: (summary) => summary.expenseAmount, money: true },
  { labelKey: "settings.migration.wenntec.metric.matched", value: (summary) => summary.matchedCandidateRows },
  { labelKey: "settings.migration.wenntec.metric.notFound", value: (summary) => summary.candidateNotFoundRows },
  { labelKey: "settings.migration.wenntec.metric.multiple", value: (summary) => summary.multipleCandidateRows },
  { labelKey: "settings.migration.wenntec.metric.deleted", value: (summary) => summary.deletedRows },
  { labelKey: "settings.migration.wenntec.metric.zero", value: (summary) => summary.zeroAmountRows },
  { labelKey: "settings.migration.wenntec.metric.invalid", value: (summary) => summary.invalidDataRows },
  { labelKey: "settings.migration.wenntec.metric.refund", value: (summary) => summary.refundReviewRows },
];

const APPLY_METRICS: SummaryMetric[] = [
  { labelKey: "settings.migration.wenntec.metric.imported", value: (summary) => summary.importedRows },
  { labelKey: "settings.migration.wenntec.metric.movements", value: (summary) => summary.importedMovementRows },
  { labelKey: "settings.migration.wenntec.metric.payments", value: (summary) => summary.importedPaymentRows },
  { labelKey: "settings.migration.wenntec.metric.cashMovements", value: (summary) => summary.importedCashMovementRows },
  { labelKey: "settings.migration.wenntec.metric.skipped", value: (summary) => summary.skippedRows },
  { labelKey: "settings.migration.wenntec.metric.manualReview", value: (summary) => summary.manualReviewRows },
  { labelKey: "settings.migration.wenntec.metric.existingSource", value: (summary) => summary.existingSourceRows },
];

type WenntecImportPanelProps = {
  migrationAccessToken: string;
  onMigrationAccessInvalid: () => void;
};

export function WenntecImportPanel({
  migrationAccessToken,
  onMigrationAccessInvalid,
}: WenntecImportPanelProps) {
  const t = useT();
  const { showToast } = useToast();
  const { activeInstitution, user, permissions } = useAuth();
  const queryClient = useQueryClient();
  const canView = canViewArea(user, permissions, "payments");
  const canUpload = canManageArea(user, permissions, "payments");
  const [file, setFile] = useState<File | null>(null);
  const [latestBatch, setLatestBatch] = useState<WenntecImportBatch | null>(null);
  const historyQueryKey = useMemo(
    () => [
      "finance",
      "imports",
      "wenntec",
      activeInstitution?.id ?? "no-institution",
    ] as const,
    [activeInstitution?.id],
  );
  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    queryFn: ({ signal }) => listWenntecImportBatches(migrationAccessToken, signal),
    enabled: canView,
    refetchInterval: (query) =>
      (latestBatch && isActiveBatch(latestBatch.status)) ||
      query.state.data?.some((batch) => isActiveBatch(batch.status))
        ? 2_000
        : false,
  });
  const detailQuery = useQuery({
    queryKey: [...historyQueryKey, "detail", latestBatch?.id ?? "none"],
    queryFn: ({ signal }) => getWenntecImportBatch(latestBatch!.id, migrationAccessToken, signal),
    enabled: canView && latestBatch !== null && isActiveBatch(latestBatch.status),
    refetchInterval: (query) =>
      query.state.data && isActiveBatch(query.state.data.status) ? 2_000 : false,
  });
  const analyzeMutation = useMutation({
    mutationFn: (sourceFile: File) => analyzeWenntecImport(sourceFile, migrationAccessToken),
    onSuccess: (batch) => {
      setLatestBatch(batch);
      void queryClient.invalidateQueries({ queryKey: historyQueryKey });
      showToast(t("settings.migration.wenntec.uploaded"));
    },
    onError: (error) => {
      console.error(error);
      if (isMigrationAccessError(error)) {
        onMigrationAccessInvalid();
      }
      const message = error instanceof ApiError
        ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
          error.problemTitle ??
          t("settings.migration.wenntec.failed")
        : t("settings.migration.wenntec.failed");
      showToast(message, "error");
    },
  });
  const applyMutation = useMutation({
    mutationFn: (batchId: string) => applyWenntecImport(batchId, migrationAccessToken),
    onSuccess: (batch) => {
      setLatestBatch(batch);
      void queryClient.invalidateQueries({ queryKey: historyQueryKey });
      showToast(t("settings.migration.wenntec.applyQueued"));
    },
    onError: (error) => {
      console.error(error);
      if (isMigrationAccessError(error)) {
        onMigrationAccessInvalid();
      }
      const message = error instanceof ApiError
        ? error.problemTitle ?? t("settings.migration.wenntec.applyFailed")
        : t("settings.migration.wenntec.applyFailed");
      showToast(message, "error");
    },
  });

  useEffect(() => {
    if (isMigrationAccessError(historyQuery.error) || isMigrationAccessError(detailQuery.error)) {
      onMigrationAccessInvalid();
    }
  }, [detailQuery.error, historyQuery.error, onMigrationAccessInvalid]);

  useEffect(() => {
    if (!latestBatch) {
      return;
    }

    const refreshedBatch = historyQuery.data?.find((batch) => batch.id === latestBatch.id);
    if (refreshedBatch && refreshedBatch.updatedAtUtc !== latestBatch.updatedAtUtc) {
      setLatestBatch(refreshedBatch);
    }
  }, [historyQuery.data, latestBatch]);

  useEffect(() => {
    const refreshedBatch = detailQuery.data;
    if (
      !refreshedBatch ||
      (refreshedBatch.updatedAtUtc === latestBatch?.updatedAtUtc &&
        refreshedBatch.status === latestBatch?.status)
    ) {
      return;
    }

    setLatestBatch(refreshedBatch);
    if (!isActiveBatch(refreshedBatch.status)) {
      void queryClient.invalidateQueries({ queryKey: historyQueryKey });
    }
  }, [detailQuery.data, historyQueryKey, latestBatch?.status, latestBatch?.updatedAtUtc, queryClient]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      showToast(t("settings.migration.wenntec.fileRequired"), "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showToast(t("settings.migration.wenntec.fileTooLarge"), "error");
      return;
    }
    analyzeMutation.mutate(file);
  };

  const visibleBatch = latestBatch ?? historyQuery.data?.[0] ?? null;
  const handleApply = (batchId: string) => {
    applyMutation.mutate(batchId);
  };

  return (
    <>
      <section className="settings-surface">
        <div className="settings-surface-header">
          <h2 className="settings-surface-title">{t("settings.migration.wenntec.title")}</h2>
        </div>
        <div className="settings-surface-body">
          <div className="settings-info-list">
            <div className="settings-info-item">
              <div>
                <div className="settings-info-title">{t("settings.migration.wenntec.infoTitle")}</div>
                <div className="settings-info-note">{t("settings.migration.wenntec.infoDescription")}</div>
              </div>
            </div>
          </div>

          {!canUpload ? (
            <div className="settings-info-note">{t("settings.migration.wenntec.permissionRequired")}</div>
          ) : (
            <form className="settings-form wenntec-upload-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="wenntec-sql-file">
                  {t("settings.migration.wenntec.fileLabel")}
                </label>
                <input
                  accept=".sql,application/sql,text/plain"
                  className="form-input"
                  disabled={analyzeMutation.isPending}
                  id="wenntec-sql-file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <span className="settings-info-note">{t("settings.migration.wenntec.fileHint")}</span>
              </div>
              <div className="settings-form-actions">
                <button className="btn btn-primary" disabled={!file || analyzeMutation.isPending} type="submit">
                  {analyzeMutation.isPending
                    ? t("settings.migration.wenntec.analyzing")
                    : t("settings.migration.wenntec.analyze")}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {visibleBatch ? (
        <WenntecAnalysisSummary
          batch={visibleBatch}
          canApply={canUpload}
          isApplyPending={applyMutation.isPending}
          migrationAccessToken={migrationAccessToken}
          onMigrationAccessInvalid={onMigrationAccessInvalid}
          onApply={handleApply}
        />
      ) : null}

      {canView && (historyQuery.data?.length ?? 0) > 0 ? (
        <section className="settings-surface">
          <div className="settings-surface-header">
            <h2 className="settings-surface-title">{t("settings.migration.wenntec.history")}</h2>
          </div>
          <div className="settings-surface-body">
            <div className="settings-module-list">
              {historyQuery.data?.map((batch) => (
                <button
                  className="wenntec-history-item"
                  key={batch.id}
                  onClick={() => setLatestBatch(batch)}
                  type="button"
                >
                  <span>
                    <strong>{batch.sourceFileName}</strong>
                    <small>{formatDateTime(batch.createdAtUtc)}</small>
                  </span>
                  <span>{formatHistoryStatus(batch, t)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function isMigrationAccessError(error: unknown): error is ApiError {
  return error instanceof ApiError &&
    error.status === 403 &&
    error.problemTitle === MIGRATION_ACCESS_REQUIRED_TITLE;
}

function isActiveBatch(status: string): boolean {
  return status === "queued" || status === "processing" || status === "apply_queued" || status === "applying" || status === "finalizing";
}

function WenntecAnalysisSummary({
  batch,
  canApply,
  isApplyPending,
  migrationAccessToken,
  onMigrationAccessInvalid,
  onApply,
}: {
  batch: WenntecImportBatch;
  canApply: boolean;
  isApplyPending: boolean;
  migrationAccessToken: string;
  onMigrationAccessInvalid: () => void;
  onApply: (batchId: string) => void;
}) {
  const t = useT();
  const [applyConfirmationOpen, setApplyConfirmationOpen] = useState(false);
  const status = getBatchStatusPresentation(batch.status, t);
  const hasAnalysis = ["analyzed", "apply_queued", "applying", "finalizing", "completed", "completed_with_review", "apply_failed"].includes(batch.status);
  const hasApplyResult = batch.status === "completed" || batch.status === "completed_with_review";
  const missingCashRegisters = batch.summary.missingCashRegisters ?? [];
  const hasMissingCashRegisters = missingCashRegisters.length > 0;
  return (
    <section className="settings-surface">
      <div className="settings-surface-header">
        <div>
          <h2 className="settings-surface-title">{t("settings.migration.wenntec.summary")}</h2>
          <div className="settings-info-note">
            {batch.sourceFileName} · {formatFileSize(batch.fileSizeBytes)} · {batch.fileSha256.slice(0, 12)}…
          </div>
        </div>
        <StatusPill label={status.label} status={status.pill} />
      </div>
      <div className="settings-surface-body">
        {hasAnalysis ? (
          <>
            <div className="settings-summary-grid">
              {SUMMARY_METRICS.map((metric) => (
                <div className="settings-summary-card" key={metric.labelKey}>
                  <span className="settings-summary-label">{t(metric.labelKey)}</span>
                  <strong className="settings-summary-value">
                    {metric.money
                      ? formatCurrency(metric.value(batch.summary))
                      : formatNumber(metric.value(batch.summary))}
                  </strong>
                </div>
              ))}
            </div>
            {hasMissingCashRegisters ? (
              <div className="settings-form-helper error" role="alert">
                {t("settings.migration.wenntec.missingCashRegisters")}: {missingCashRegisters.join(", ")}
              </div>
            ) : null}
            {hasApplyResult ? (
              <>
                <h3 className="settings-surface-title">{t("settings.migration.wenntec.applyResult")}</h3>
                <div className="settings-summary-grid">
                  {APPLY_METRICS.map((metric) => (
                    <div className="settings-summary-card" key={metric.labelKey}>
                      <span className="settings-summary-label">{t(metric.labelKey)}</span>
                      <strong className="settings-summary-value">{formatNumber(metric.value(batch.summary))}</strong>
                    </div>
                  ))}
                </div>
                <div className="settings-info-note">{t("settings.migration.wenntec.appliedMessage")}</div>
                {batch.appliedByName ? (
                  <div className="settings-info-note">
                    {t("settings.migration.wenntec.appliedBy")}: {batch.appliedByName}
                  </div>
                ) : null}
                {batch.applyRequestedAtUtc ? (
                  <div className="settings-info-note">
                    {t("settings.migration.wenntec.appliedAt")}: {formatDateTime(batch.applyRequestedAtUtc)}
                  </div>
                ) : null}
                {batch.status === "completed_with_review" ? (
                  <WenntecReviewItems
                    batchId={batch.id}
                    migrationAccessToken={migrationAccessToken}
                    onMigrationAccessInvalid={onMigrationAccessInvalid}
                  />
                ) : null}
              </>
            ) : batch.status === "apply_queued" || batch.status === "applying" || batch.status === "finalizing" ? (
              <div className="settings-info-note">
                {batch.status === "finalizing"
                  ? t("settings.migration.wenntec.finalizingMessage")
                  : t("settings.migration.wenntec.applyingMessage")}
              </div>
            ) : (
              <>
                <div className="settings-info-note">
                  {batch.status === "apply_failed"
                    ? batch.errorMessage ?? t("settings.migration.wenntec.applyFailed")
                    : t("settings.migration.wenntec.dryRunOnly")}
                </div>
                {canApply ? (
                  <div className="settings-form-actions wenntec-confirm-popover-anchor">
                    <button
                      className="btn btn-primary"
                      disabled={isApplyPending}
                      onClick={() => setApplyConfirmationOpen(true)}
                      type="button"
                    >
                      {isApplyPending
                        ? t("settings.migration.wenntec.applyQueuing")
                        : t("settings.migration.wenntec.apply")}
                    </button>
                    {applyConfirmationOpen ? (
                      <WenntecConfirmPopover
                        confirmLabel={t("settings.migration.wenntec.applyConfirmAction")}
                        message={t("settings.migration.wenntec.applyConfirm")}
                        onCancel={() => setApplyConfirmationOpen(false)}
                        onConfirm={() => {
                          setApplyConfirmationOpen(false);
                          onApply(batch.id);
                        }}
                        pending={isApplyPending}
                        title={t("settings.migration.wenntec.applyConfirmTitle")}
                      />
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : (
          <div className="settings-info-note">
            {batch.status === "failed"
              ? batch.errorMessage ?? t("settings.migration.wenntec.failed")
              : batch.status === "processing"
                ? t("settings.migration.wenntec.processingMessage")
                : t("settings.migration.wenntec.queuedMessage")}
          </div>
        )}
      </div>
    </section>
  );
}

function getBatchStatusPresentation(
  status: string,
  t: ReturnType<typeof useT>
): { label: string; pill: "queued" | "running" | "success" | "failed" } {
  switch (status) {
    case "queued":
      return { label: t("settings.migration.wenntec.queued"), pill: "queued" };
    case "processing":
      return { label: t("settings.migration.wenntec.processing"), pill: "running" };
    case "failed":
      return { label: t("settings.migration.wenntec.failedStatus"), pill: "failed" };
    case "apply_queued":
      return { label: t("settings.migration.wenntec.applyQueuedStatus"), pill: "queued" };
    case "applying":
      return { label: t("settings.migration.wenntec.applying"), pill: "running" };
    case "finalizing":
      return { label: t("settings.migration.wenntec.finalizing"), pill: "running" };
    case "apply_failed":
      return { label: t("settings.migration.wenntec.applyFailedStatus"), pill: "failed" };
    case "completed":
      return { label: t("settings.migration.wenntec.completed"), pill: "success" };
    case "completed_with_review":
      return { label: t("settings.migration.wenntec.completedWithReview"), pill: "success" };
    default:
      return { label: t("settings.migration.wenntec.analyzed"), pill: "success" };
  }
}

function WenntecReviewItems({
  batchId,
  migrationAccessToken,
  onMigrationAccessInvalid,
}: {
  batchId: string;
  migrationAccessToken: string;
  onMigrationAccessInvalid: () => void;
}) {
  const t = useT();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [skipConfirmationItemId, setSkipConfirmationItemId] = useState<string | null>(null);
  const queryKey = ["finance", "imports", "wenntec", batchId, "review-items"] as const;
  const itemsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => listWenntecImportReviewItems(batchId, migrationAccessToken, signal),
  });
  const resolutionMutation = useMutation({
    mutationFn: ({ itemId, action }: { itemId: string; action: "retry" | "skip" }) =>
      resolveWenntecImportReviewItem(batchId, itemId, action, migrationAccessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance", "imports", "wenntec"] });
      void queryClient.invalidateQueries({ queryKey });
      showToast(t("settings.migration.wenntec.review.updated"));
    },
    onError: (error) => {
      if (isMigrationAccessError(error)) {
        onMigrationAccessInvalid();
      }
      showToast(
        error instanceof ApiError
          ? error.problemTitle ?? t("settings.migration.wenntec.review.failed")
          : t("settings.migration.wenntec.review.failed"),
        "error"
      );
    },
  });
  useEffect(() => {
    if (isMigrationAccessError(itemsQuery.error)) {
      onMigrationAccessInvalid();
    }
  }, [itemsQuery.error, onMigrationAccessInvalid]);

  if (itemsQuery.isLoading) {
    return <div className="settings-info-note">{t("settings.migration.wenntec.review.loading")}</div>;
  }
  if (itemsQuery.error) {
    return <div className="settings-info-note">{t("settings.migration.wenntec.review.failed")}</div>;
  }

  return (
    <div className="settings-info-list">
      <h3 className="settings-surface-title">{t("settings.migration.wenntec.review.title")}</h3>
      {itemsQuery.data?.map((item) => {
        const canRetry = item.status === "candidate_not_found" || item.status === "multiple_candidates_found";
        return (
          <div className="settings-info-item" key={item.id}>
            <div>
              <div className="settings-info-title">
                #{item.sourceKey} · {item.maskedNationalId ?? "***"}
              </div>
              <div className="settings-info-note">{item.reason ?? item.status}</div>
            </div>
            <div className="settings-form-actions">
              {canRetry ? (
                <button
                  className="btn btn-secondary"
                  disabled={resolutionMutation.isPending}
                  onClick={() => resolutionMutation.mutate({ itemId: item.id, action: "retry" })}
                  type="button"
                >
                  {t("settings.migration.wenntec.review.retry")}
                </button>
              ) : null}
              <div className="wenntec-confirm-popover-anchor">
                <button
                  className="btn btn-secondary"
                  disabled={resolutionMutation.isPending}
                  onClick={() => setSkipConfirmationItemId(item.id)}
                  type="button"
                >
                  {t("settings.migration.wenntec.review.skip")}
                </button>
                {skipConfirmationItemId === item.id ? (
                  <WenntecConfirmPopover
                    confirmLabel={t("settings.migration.wenntec.review.skip")}
                    message={t("settings.migration.wenntec.review.skipConfirm")}
                    onCancel={() => setSkipConfirmationItemId(null)}
                    onConfirm={() => {
                      setSkipConfirmationItemId(null);
                      resolutionMutation.mutate({ itemId: item.id, action: "skip" });
                    }}
                    pending={resolutionMutation.isPending}
                    title={t("settings.migration.wenntec.review.skipConfirmTitle")}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WenntecConfirmPopover({
  title,
  message,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    const timer = window.setTimeout(() => document.addEventListener("mousedown", handlePointerDown), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onCancel]);

  return (
    <div className="wenntec-confirm-popover" ref={popoverRef} role="alertdialog">
      <div className="wenntec-confirm-popover-title">{title}</div>
      <p className="wenntec-confirm-popover-message">{message}</p>
      <div className="wenntec-confirm-popover-actions">
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={onCancel} type="button">
          {t("common.cancel")}
        </button>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={onConfirm} type="button">
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function formatHistoryStatus(batch: WenntecImportBatch, t: ReturnType<typeof useT>): string {
  if (batch.status === "analyzed") {
    return `${formatNumber(batch.summary.totalRows)} ${t("settings.migration.wenntec.rows")}`;
  }

  return getBatchStatusPresentation(batch.status, t).label;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(currentLocale(), { style: "currency", currency: "TRY" }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(currentLocale()).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(currentLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatFileSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString(currentLocale(), { maximumFractionDigits: 1 })} MB`;
}
