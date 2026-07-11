import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RefreshIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { PageLoadError } from "../components/ui/PageLoadError";
import { Panel } from "../components/ui/Panel";
import { PanelListSkeleton, SettingsTableSkeleton } from "../components/ui/Skeleton";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { useT } from "../lib/i18n";
import {
  getDomainEventStreamStatus,
  getInboxMessages,
  getOutboxMessages,
  getProjectionOutboxHealth,
  getProjectionOutboxMessages,
  ignoreProjectionOutboxMessage,
  retryInboxMessage,
  retryOutboxMessage,
  retryProjectionOutboxDeadLetters,
  retryProjectionOutboxMessage,
  type DomainEventStreamStatusResponse,
  type InboxMessageResponse,
  type InboxMessageStatus,
  type OutboxMessageResponse,
  type OutboxMessageStatus,
  type ProjectionOutboxHealthItemResponse,
  type ProjectionOutboxHealthStatus,
  type ProjectionOutboxHealthSummaryResponse,
} from "../lib/outbox-api";
import type { JobStatus } from "../types";

type QueueTab = "outbox" | "inbox" | "stream";

const OUTBOX_STATUS_OPTIONS: { value: "all" | OutboxMessageStatus; label: string }[] = [
  { value: "all", label: "All" /* fallback, render uses t() */ },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "dead_letter", label: "Dead-letter" },
  { value: "published", label: "Published" },
  { value: "ignored", label: "Ignored" },
];

const INBOX_STATUS_OPTIONS: { value: "all" | InboxMessageStatus; label: string }[] = [
  { value: "all", label: "All" /* fallback, render uses t() */ },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "dead_letter", label: "Dead-letter" },
  { value: "processed", label: "Processed" },
];

export function OutboxPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<QueueTab>("outbox");
  const [outboxStatus, setOutboxStatus] = useState<"all" | OutboxMessageStatus>("dead_letter");
  const [inboxStatus, setInboxStatus] = useState<"all" | InboxMessageStatus>("dead_letter");
  const [selectedProjectionService, setSelectedProjectionService] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const outboxStatusParam = outboxStatus === "all" ? undefined : outboxStatus;
  const inboxStatusParam = inboxStatus === "all" ? undefined : inboxStatus;

  const outboxQuery = useQuery({
    queryKey: ["outbox", "messages", outboxStatusParam ?? "all"],
    queryFn: ({ signal }) => getOutboxMessages({ status: outboxStatusParam, limit: 100 }, signal),
    enabled: activeTab === "outbox",
  });

  const outboxHealthQuery = useQuery({
    queryKey: ["outbox", "health"],
    queryFn: ({ signal }) => getProjectionOutboxHealth(signal),
    enabled: activeTab === "outbox",
  });

  const projectionMessagesQuery = useQuery({
    queryKey: ["outbox", "projection-messages", selectedProjectionService, outboxStatusParam ?? "all"],
    queryFn: ({ signal }) =>
      getProjectionOutboxMessages(
        selectedProjectionService ?? "",
        { status: outboxStatusParam, limit: 100 },
        signal
      ),
    enabled: activeTab === "outbox" && selectedProjectionService !== null,
  });

  const inboxQuery = useQuery({
    queryKey: ["inbox", "messages", inboxStatusParam ?? "all"],
    queryFn: ({ signal }) => getInboxMessages({ status: inboxStatusParam, limit: 100 }, signal),
    enabled: activeTab === "inbox",
  });

  const streamStatusQuery = useQuery({
    queryKey: ["domain-events", "stream-status"],
    queryFn: ({ signal }) => getDomainEventStreamStatus(signal),
    enabled: activeTab === "stream",
  });

  const retryOutboxMutation = useMutation({
    mutationFn: retryOutboxMessage,
    onSuccess: async () => {
      showToast(t("outbox.toast.outboxRequeued"));
      await queryClient.invalidateQueries({ queryKey: ["outbox", "messages"] });
      await queryClient.invalidateQueries({ queryKey: ["outbox", "health"] });
      await queryClient.invalidateQueries({ queryKey: ["domain-events", "stream-status"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
    onError: () => showToast(t("outbox.toast.outboxRequeueFailed"), "error"),
  });

  const retryInboxMutation = useMutation({
    mutationFn: retryInboxMessage,
    onSuccess: async () => {
      showToast(t("outbox.toast.inboxRequeued"));
      await queryClient.invalidateQueries({ queryKey: ["inbox", "messages"] });
      await queryClient.invalidateQueries({ queryKey: ["domain-events", "stream-status"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
    onError: () => showToast(t("outbox.toast.inboxRequeueFailed"), "error"),
  });

  const retryProjectionMutation = useMutation({
    mutationFn: retryProjectionOutboxMessage,
    onSuccess: async () => {
      showToast(t("outbox.toast.outboxRequeued"));
      await queryClient.invalidateQueries({ queryKey: ["outbox", "projection-messages"] });
      await queryClient.invalidateQueries({ queryKey: ["outbox", "health"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
    onError: () => showToast(t("outbox.toast.outboxRequeueFailed"), "error"),
  });

  const ignoreProjectionMutation = useMutation({
    mutationFn: ignoreProjectionOutboxMessage,
    onSuccess: async () => {
      showToast("Projection outbox mesajı ignore edildi");
      await queryClient.invalidateQueries({ queryKey: ["outbox", "projection-messages"] });
      await queryClient.invalidateQueries({ queryKey: ["outbox", "health"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
    onError: () => showToast("Projection outbox mesajı ignore edilemedi", "error"),
  });

  const retryProjectionDeadLettersMutation = useMutation({
    mutationFn: retryProjectionOutboxDeadLetters,
    onSuccess: async () => {
      showToast(t("outbox.toast.outboxRequeued"));
      await queryClient.invalidateQueries({ queryKey: ["outbox", "projection-messages"] });
      await queryClient.invalidateQueries({ queryKey: ["outbox", "health"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
    onError: () => showToast(t("outbox.toast.outboxRequeueFailed"), "error"),
  });

  const activeQuery =
    activeTab === "outbox"
      ? selectedProjectionService
        ? projectionMessagesQuery
        : outboxQuery
      : activeTab === "inbox"
        ? inboxQuery
        : streamStatusQuery;
  const isRefreshing = activeQuery.isFetching || (activeTab === "outbox" && outboxHealthQuery.isFetching);

  return (
    <div className="outbox-route">
      <PageToolbar
        actions={
          <button
            className="btn btn-secondary btn-sm"
            disabled={isRefreshing}
            onClick={() => {
              void activeQuery.refetch();
              if (activeTab === "outbox") {
                void outboxHealthQuery.refetch();
              }
            }}
            type="button"
          >
            <RefreshIcon />
            Yenile
          </button>
        }
        title="Outbox"
      />

      <Panel>
        <div className="outbox-page">
          <div className="page-tabs outbox-tabs" role="tablist" aria-label="Outbox views">
            {[
              { value: "outbox", label: "Outbox" },
              { value: "inbox", label: "Inbox" },
              { value: "stream", label: "Stream" },
            ].map((tab) => (
              <button
                aria-selected={activeTab === tab.value}
                className={activeTab === tab.value ? "page-tab active" : "page-tab"}
                key={tab.value}
                onClick={() => setActiveTab(tab.value as QueueTab)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "stream" ? null : (
            <div className="settings-toolbar outbox-toolbar">
              <div className="filter-row">
                {(activeTab === "outbox" ? OUTBOX_STATUS_OPTIONS : INBOX_STATUS_OPTIONS).map((option) => (
                  <button
                    className={
                      (activeTab === "outbox" ? outboxStatus : inboxStatus) === option.value
                        ? "filter-chip active"
                        : "filter-chip"
                    }
                    key={option.value}
                    onClick={() => {
                      if (activeTab === "outbox") {
                        setOutboxStatus(option.value as "all" | OutboxMessageStatus);
                      } else {
                        setInboxStatus(option.value as "all" | InboxMessageStatus);
                      }
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "outbox" ? (
            <>
              <ProjectionOutboxHealth
                onSelect={(service) => setSelectedProjectionService((current) => (current === service ? null : service))}
                query={outboxHealthQuery}
                selectedService={selectedProjectionService}
              />
              {selectedProjectionService ? (
                <OutboxTable
                  actionLabel={`${selectedProjectionService.replace("pilot-", "")} Projection`}
                  ignoringId={
                    ignoreProjectionMutation.isPending
                      ? `${ignoreProjectionMutation.variables.service}:${ignoreProjectionMutation.variables.id}`
                      : undefined
                  }
                  messages={projectionMessagesQuery.data?.items ?? []}
                  onIgnore={(id) => ignoreProjectionMutation.mutate({ service: selectedProjectionService, id })}
                  onRetry={(id) => retryProjectionMutation.mutate({ service: selectedProjectionService, id })}
                  onRetryEventType={(eventType) =>
                    retryProjectionDeadLettersMutation.mutate({ service: selectedProjectionService, eventType })
                  }
                  query={projectionMessagesQuery}
                  retryingId={
                    retryProjectionMutation.isPending
                      ? `${retryProjectionMutation.variables.service}:${retryProjectionMutation.variables.id}`
                      : undefined
                  }
                  selectedService={selectedProjectionService}
                />
              ) : (
                <OutboxTable
                  messages={outboxQuery.data?.items ?? []}
                  onRetry={(id) => retryOutboxMutation.mutate(id)}
                  query={outboxQuery}
                  retryingId={retryOutboxMutation.isPending ? retryOutboxMutation.variables : undefined}
                />
              )}
            </>
          ) : activeTab === "inbox" ? (
            <InboxTable
              messages={inboxQuery.data?.items ?? []}
              onRetry={(id) => retryInboxMutation.mutate(id)}
              query={inboxQuery}
              retryingId={retryInboxMutation.isPending ? retryInboxMutation.variables : undefined}
            />
          ) : (
            <DomainEventStreamStatus query={streamStatusQuery} />
          )}
        </div>
      </Panel>
    </div>
  );
}

function ProjectionOutboxHealth({
  onSelect,
  query,
  selectedService,
}: {
  onSelect: (service: string) => void;
  query: ReturnType<typeof useQuery<ProjectionOutboxHealthSummaryResponse>>;
  selectedService: string | null;
}) {
  if (query.isError) {
    return (
      <PageLoadError
        description="Projection outbox durumu okunamadı."
        onRetry={() => void query.refetch()}
        variant="card"
      />
    );
  }

  if (query.isLoading) {
    return <PanelListSkeleton rows={2} />;
  }

  if (!query.data) {
    return null;
  }

  return (
    <div className={`queue-health-band projection-health ${projectionHealthTone(query.data.status)}`}>
      <div className="queue-health-main">
        <div className="queue-health-title">Projection Outbox</div>
        <div className="queue-health-message">{query.data.message}</div>
      </div>
      <div className="projection-health-grid">
        {query.data.items.map((item) => (
          <ProjectionOutboxHealthItem
            item={item}
            key={item.service}
            onSelect={onSelect}
            selected={selectedService === item.service}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectionOutboxHealthItem({
  item,
  onSelect,
  selected,
}: {
  item: ProjectionOutboxHealthItemResponse;
  onSelect: (service: string) => void;
  selected: boolean;
}) {
  const totalOpen = item.pendingCount + item.failedCount + item.deadLetterCount;
  const age = item.oldestDueAtUtc ? formatRelativeAge(item.oldestDueAtUtc) : "-";
  return (
    <button
      className={`projection-health-item projection-health-button ${projectionHealthTone(item.status)}${selected ? " active" : ""}`}
      onClick={() => onSelect(item.service)}
      type="button"
    >
      <div className="projection-health-item-head">
        <span>{item.service.replace("pilot-", "")}</span>
        <StatusPill label={item.status} status={projectionStatusPillTone(item.status)} />
      </div>
      <div className="projection-health-item-metrics">
        <span>Open {totalOpen}</span>
        <span>Due {item.dueCount}</span>
        <span>Dead {item.deadLetterCount}</span>
      </div>
      <div className="projection-health-item-metrics projection-health-item-secondary">
        <span>Oldest {age}</span>
        <span>Last {item.lastPublishedAtUtc ? formatDateTime(item.lastPublishedAtUtc) : "-"}</span>
      </div>
      {item.error ? (
        <div className="projection-health-item-error" title={item.error}>
          {item.error}
        </div>
      ) : null}
    </button>
  );
}

function DomainEventStreamStatus({
  query,
}: {
  query: ReturnType<typeof useQuery<DomainEventStreamStatusResponse>>;
}) {
  const t = useT();
  if (query.isError) {
    return (
      <PageLoadError
        description={t("outbox.streamStatusError")}
        onRetry={() => void query.refetch()}
        variant="card"
      />
    );
  }

  if (query.isLoading) {
    return <PanelListSkeleton rows={3} />;
  }

  if (!query.data) {
    return <div className="data-table-empty">{t("outbox.streamNotFound")}</div>;
  }

  const status = query.data;
  const tone = streamHealthTone(status.status);
  return (
    <div className={`queue-health-band ${tone}`}>
      <div className="queue-health-main">
        <div className="queue-health-title">Domain Event Stream</div>
        <div className="queue-health-meta">
          {status.streamName} / {status.consumerGroupName}
        </div>
        <div className="queue-health-message">{status.message}</div>
        {status.redisError ? (
          <div className="queue-health-error" title={status.redisError}>
            {status.redisError}
          </div>
        ) : null}
      </div>
      <div className="queue-health-metrics">
        <span>{t("outbox.status.label")}: {status.enabled ? t("outbox.status.active") : t("outbox.status.disabled")}</span>
        <span>Stream: {status.streamCount}</span>
        <span>Pending: {formatNullableNumber(status.pendingMessageCount)}</span>
        <span>Consumer: {formatNullableNumber(status.consumerCount)}</span>
        <span>Lowest: {status.lowestPendingMessageId ?? "-"}</span>
        <span>Highest: {status.highestPendingMessageId ?? "-"}</span>
      </div>
    </div>
  );
}

function OutboxTable({
  actionLabel,
  ignoringId,
  messages,
  onIgnore,
  onRetry,
  onRetryEventType,
  query,
  retryingId,
  selectedService,
}: {
  actionLabel?: string;
  ignoringId?: string;
  messages: OutboxMessageResponse[];
  onIgnore?: (id: string) => void;
  onRetry: (id: string) => void;
  onRetryEventType?: (eventType: string) => void;
  query: ReturnType<typeof useQuery<{ items: OutboxMessageResponse[] }>>;
  retryingId?: string;
  selectedService?: string;
}) {
  const t = useT();
  const eventTypeCounts = summarizeEventTypes(messages);
  return query.isError ? (
    <PageLoadError
      description={t("outbox.outboxError")}
      onRetry={() => void query.refetch()}
      variant="card"
    />
  ) : query.isLoading ? (
    <div className="data-table-wrap outbox-table-wrap">
      <table className="data-table outbox-table">
        <tbody>
          <SettingsTableSkeleton columns={[180, 90, 120, 72, 60, 110, 160, 64]} rows={5} />
        </tbody>
      </table>
    </div>
  ) : messages.length === 0 ? (
    <div className="data-table-empty">{t("outbox.outboxEmpty")}</div>
  ) : (
    <div className="data-table-wrap outbox-table-wrap">
      {actionLabel ? (
        <div className="outbox-detail-heading">
          <span>{actionLabel}</span>
          {eventTypeCounts.length ? (
            <div className="outbox-event-type-summary" aria-label="Event type distribution">
              {eventTypeCounts.map((item) => (
                <span key={item.eventType}>
                  {item.eventType} {item.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <table className="data-table outbox-table">
        <colgroup>
          <col className="outbox-col-event" />
          <col className="outbox-col-service" />
          <col className="outbox-col-aggregate" />
          <col className="outbox-col-status" />
          <col className="outbox-col-attempt" />
          <col className="outbox-col-date" />
          <col className="outbox-col-error" />
          <col className="outbox-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th>Event</th>
            <th>Servis</th>
            <th>Aggregate</th>
            <th>Durum</th>
            <th>Deneme</th>
            <th>Oluşturma</th>
            <th>Son Hata</th>
            <th aria-label="Aksiyonlar" />
          </tr>
        </thead>
        <tbody>
          {messages.map((message) => (
            <OutboxRow
              key={message.id}
              message={message}
              onRetry={onRetry}
              onIgnore={onIgnore}
              onRetryEventType={onRetryEventType}
              ignoring={ignoringId === (selectedService ? `${selectedService}:${message.id}` : message.id)}
              retrying={retryingId === (selectedService ? `${selectedService}:${message.id}` : message.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InboxTable({
  messages,
  onRetry,
  query,
  retryingId,
}: {
  messages: InboxMessageResponse[];
  onRetry: (id: string) => void;
  query: ReturnType<typeof useQuery<{ items: InboxMessageResponse[] }>>;
  retryingId?: string;
}) {
  const t = useT();
  return query.isError ? (
    <PageLoadError
      description={t("outbox.inboxError")}
      onRetry={() => void query.refetch()}
      variant="card"
    />
  ) : query.isLoading ? (
    <div className="data-table-wrap outbox-table-wrap">
      <table className="data-table outbox-table">
        <tbody>
          <SettingsTableSkeleton columns={[180, 120, 90, 72, 60, 110, 160, 64]} rows={5} />
        </tbody>
      </table>
    </div>
  ) : messages.length === 0 ? (
    <div className="data-table-empty">{t("outbox.inboxEmpty")}</div>
  ) : (
    <div className="data-table-wrap outbox-table-wrap">
      <table className="data-table outbox-table">
        <colgroup>
          <col className="outbox-col-event" />
          <col className="outbox-col-consumer" />
          <col className="outbox-col-service" />
          <col className="outbox-col-status" />
          <col className="outbox-col-attempt" />
          <col className="outbox-col-date" />
          <col className="outbox-col-error" />
          <col className="outbox-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th>Event</th>
            <th>Consumer</th>
            <th>Servis</th>
            <th>Durum</th>
            <th>Deneme</th>
            <th>Alınma</th>
            <th>Son Hata</th>
            <th aria-label="Aksiyonlar" />
          </tr>
        </thead>
        <tbody>
          {messages.map((message) => (
            <InboxRow
              key={message.id}
              message={message}
              onRetry={onRetry}
              retrying={retryingId === message.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutboxRow({
  message,
  ignoring,
  onRetry,
  onIgnore,
  onRetryEventType,
  retrying,
}: {
  message: OutboxMessageResponse;
  ignoring: boolean;
  onRetry: (id: string) => void;
  onIgnore?: (id: string) => void;
  onRetryEventType?: (eventType: string) => void;
  retrying: boolean;
}) {
  const t = useT();
  const canRetry = message.status === "dead_letter" || message.status === "failed";
  const canIgnore = Boolean(onIgnore) && message.status === "dead_letter";
  const canRetryEventType = Boolean(onRetryEventType) && message.status === "dead_letter";
  const lastError = parseProjectionLastError(message.lastError);
  const isRetrying = retrying;

  return (
    <tr>
      <td className="outbox-cell-identity">
        <div className="cell-primary">{message.eventType}</div>
        <div className="cell-secondary">{message.id}</div>
      </td>
      <td className="outbox-cell-nowrap">{message.sourceService}</td>
      <td className="outbox-cell-identity">
        <div>{message.aggregateType ?? "-"}</div>
        <div className="cell-secondary">{message.aggregateId ?? "-"}</div>
      </td>
      <td>
        <StatusPill label={message.status} status={statusTone(message.status)} />
      </td>
      <td className="outbox-cell-number">{message.attemptCount}</td>
      <td className="outbox-cell-date">{formatDateTime(message.createdAtUtc)}</td>
      <td className="outbox-cell-error">
        <span title={message.lastError ?? undefined}>
          {lastError ? (
            <>
              <strong>{lastError.errorClass}</strong>
              {lastError.statusCode ? ` ${lastError.statusCode}` : ""}
              {lastError.target ? ` ${lastError.target}` : message.targetService ? ` ${message.targetService}` : ""}
              {lastError.message ? ` - ${lastError.message}` : ""}
            </>
          ) : (
            message.lastError ?? "-"
          )}
        </span>
      </td>
      <td className="table-actions">
        {canRetry ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={isRetrying}
            onClick={() => onRetry(message.id)}
            type="button"
          >
            {isRetrying ? t("outbox.retrying") : "Retry"}
          </button>
        ) : null}
        {canRetryEventType ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={isRetrying}
            onClick={() => onRetryEventType?.(message.eventType)}
            type="button"
          >
            Type
          </button>
        ) : null}
        {canIgnore ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={ignoring}
            onClick={() => onIgnore?.(message.id)}
            type="button"
          >
            {ignoring ? "..." : "Ignore"}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function InboxRow({
  message,
  onRetry,
  retrying,
}: {
  message: InboxMessageResponse;
  onRetry: (id: string) => void;
  retrying: boolean;
}) {
  const t = useT();
  const canRetry = message.status === "dead_letter" || message.status === "failed";

  return (
    <tr>
      <td className="outbox-cell-identity">
        <div className="cell-primary">{message.eventType}</div>
        <div className="cell-secondary">{message.id}</div>
      </td>
      <td className="outbox-cell-nowrap">{message.consumerName}</td>
      <td className="outbox-cell-nowrap">{message.sourceService}</td>
      <td>
        <StatusPill label={message.status} status={statusTone(message.status)} />
      </td>
      <td className="outbox-cell-number">{message.attemptCount}</td>
      <td className="outbox-cell-date">{formatDateTime(message.receivedAtUtc)}</td>
      <td className="outbox-cell-error">
        <span title={message.lastError ?? undefined}>{message.lastError ?? "-"}</span>
      </td>
      <td className="table-actions">
        {canRetry ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={retrying}
            onClick={() => onRetry(message.id)}
            type="button"
          >
            {retrying ? t("outbox.retrying") : "Retry"}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function statusTone(status: OutboxMessageStatus | InboxMessageStatus): JobStatus {
  switch (status) {
    case "published":
    case "processed":
    case "ignored":
      return "success";
    case "pending":
    case "processing":
      return "queued";
    case "failed":
      return "warning";
    case "dead_letter":
      return "failed";
  }
}

function streamHealthTone(status: DomainEventStreamStatusResponse["status"]) {
  switch (status) {
    case "healthy":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
  }
}

function projectionHealthTone(status: ProjectionOutboxHealthSummaryResponse["status"] | ProjectionOutboxHealthStatus) {
  switch (status) {
    case "healthy":
      return "success";
    case "warning":
    case "disabled":
    case "unreachable":
      return "warning";
    case "danger":
      return "danger";
  }
}

function projectionStatusPillTone(status: ProjectionOutboxHealthStatus): JobStatus {
  switch (status) {
    case "healthy":
      return "success";
    case "warning":
    case "disabled":
    case "unreachable":
      return "warning";
    case "danger":
      return "failed";
  }
}

function formatNullableNumber(value: number | null) {
  return value === null ? "-" : value.toLocaleString("tr-TR");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeAge(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatDateTime(value);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "<1 dk";
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa`;
  return `${Math.floor(hours / 24)} gun`;
}

function parseProjectionLastError(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.schema !== "projection-dispatch-error.v1" && parsed.schema !== "projection-dispatch-ignore.v1") {
      return null;
    }

    const targetService = typeof parsed.targetService === "string" ? parsed.targetService : "";
    const targetPath = typeof parsed.targetPath === "string" ? parsed.targetPath : "";
    return {
      errorClass: typeof parsed.class === "string" ? parsed.class : "unknown",
      statusCode: typeof parsed.statusCode === "number" ? parsed.statusCode : null,
      target: [targetService, targetPath].filter(Boolean).join(" "),
      message: typeof parsed.message === "string" ? parsed.message : "",
    };
  } catch {
    return null;
  }
}

function summarizeEventTypes(messages: OutboxMessageResponse[]) {
  const counts = new Map<string, number>();
  for (const message of messages) {
    counts.set(message.eventType, (counts.get(message.eventType) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((left, right) => right.count - left.count || left.eventType.localeCompare(right.eventType))
    .slice(0, 5);
}
