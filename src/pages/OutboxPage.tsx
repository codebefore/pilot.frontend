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
  retryInboxMessage,
  retryOutboxMessage,
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
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const outboxStatusParam = outboxStatus === "all" ? undefined : outboxStatus;
  const inboxStatusParam = inboxStatus === "all" ? undefined : inboxStatus;

  const outboxQuery = useQuery({
    queryKey: ["outbox", "messages", outboxStatusParam ?? "all"],
    queryFn: () => getOutboxMessages({ status: outboxStatusParam, limit: 100 }),
    enabled: activeTab === "outbox",
  });

  const outboxHealthQuery = useQuery({
    queryKey: ["outbox", "health"],
    queryFn: () => getProjectionOutboxHealth(),
    enabled: activeTab === "outbox",
  });

  const inboxQuery = useQuery({
    queryKey: ["inbox", "messages", inboxStatusParam ?? "all"],
    queryFn: () => getInboxMessages({ status: inboxStatusParam, limit: 100 }),
    enabled: activeTab === "inbox",
  });

  const streamStatusQuery = useQuery({
    queryKey: ["domain-events", "stream-status"],
    queryFn: () => getDomainEventStreamStatus(),
    enabled: activeTab === "stream",
  });

  const retryOutboxMutation = useMutation({
    mutationFn: retryOutboxMessage,
    onSuccess: async () => {
      showToast(t("outbox.toast.outboxRequeued"));
      await queryClient.invalidateQueries({ queryKey: ["outbox", "messages"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
    onError: () => showToast(t("outbox.toast.outboxRequeueFailed"), "error"),
  });

  const retryInboxMutation = useMutation({
    mutationFn: retryInboxMessage,
    onSuccess: async () => {
      showToast(t("outbox.toast.inboxRequeued"));
      await queryClient.invalidateQueries({ queryKey: ["inbox", "messages"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
    onError: () => showToast(t("outbox.toast.inboxRequeueFailed"), "error"),
  });

  const activeQuery =
    activeTab === "outbox" ? outboxQuery : activeTab === "inbox" ? inboxQuery : streamStatusQuery;
  const isRefreshing = activeQuery.isFetching || (activeTab === "outbox" && outboxHealthQuery.isFetching);

  return (
    <>
      <PageToolbar
        actions={
          <button
            className="btn btn-secondary"
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
              <ProjectionOutboxHealth query={outboxHealthQuery} />
              <OutboxTable
                messages={outboxQuery.data?.items ?? []}
                onRetry={(id) => retryOutboxMutation.mutate(id)}
                query={outboxQuery}
                retryingId={retryOutboxMutation.isPending ? retryOutboxMutation.variables : undefined}
              />
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
    </>
  );
}

function ProjectionOutboxHealth({
  query,
}: {
  query: ReturnType<typeof useQuery<ProjectionOutboxHealthSummaryResponse>>;
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
          <ProjectionOutboxHealthItem item={item} key={item.service} />
        ))}
      </div>
    </div>
  );
}

function ProjectionOutboxHealthItem({ item }: { item: ProjectionOutboxHealthItemResponse }) {
  const totalOpen = item.pendingCount + item.failedCount + item.deadLetterCount;
  return (
    <div className={`projection-health-item ${projectionHealthTone(item.status)}`}>
      <div className="projection-health-item-head">
        <span>{item.service.replace("pilot-", "")}</span>
        <StatusPill label={item.status} status={projectionStatusPillTone(item.status)} />
      </div>
      <div className="projection-health-item-metrics">
        <span>Open {totalOpen}</span>
        <span>Due {item.dueCount}</span>
        <span>Dead {item.deadLetterCount}</span>
      </div>
      {item.error ? (
        <div className="projection-health-item-error" title={item.error}>
          {item.error}
        </div>
      ) : null}
    </div>
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
  messages,
  onRetry,
  query,
  retryingId,
}: {
  messages: OutboxMessageResponse[];
  onRetry: (id: string) => void;
  query: ReturnType<typeof useQuery<{ items: OutboxMessageResponse[] }>>;
  retryingId?: string;
}) {
  const t = useT();
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
              retrying={retryingId === message.id}
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
  onRetry,
  retrying,
}: {
  message: OutboxMessageResponse;
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
