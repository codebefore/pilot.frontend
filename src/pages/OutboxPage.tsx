import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RefreshIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { PageLoadError } from "../components/ui/PageLoadError";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import {
  getInboxMessages,
  getOutboxMessages,
  retryInboxMessage,
  retryOutboxMessage,
  type InboxMessageResponse,
  type InboxMessageStatus,
  type OutboxMessageResponse,
  type OutboxMessageStatus,
} from "../lib/outbox-api";
import type { JobStatus } from "../types";

type QueueTab = "outbox" | "inbox";

const OUTBOX_STATUS_OPTIONS: { value: "all" | OutboxMessageStatus; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "dead_letter", label: "Dead-letter" },
  { value: "published", label: "Published" },
];

const INBOX_STATUS_OPTIONS: { value: "all" | InboxMessageStatus; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "dead_letter", label: "Dead-letter" },
  { value: "processed", label: "Processed" },
];

export function OutboxPage() {
  const [activeTab, setActiveTab] = useState<QueueTab>("outbox");
  const [outboxStatus, setOutboxStatus] = useState<"all" | OutboxMessageStatus>("dead_letter");
  const [inboxStatus, setInboxStatus] = useState<"all" | InboxMessageStatus>("dead_letter");
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const outboxStatusParam = outboxStatus === "all" ? undefined : outboxStatus;
  const inboxStatusParam = inboxStatus === "all" ? undefined : inboxStatus;

  const outboxQuery = useQuery({
    queryKey: ["outbox", "messages", outboxStatusParam ?? "all"],
    queryFn: ({ signal }) => getOutboxMessages({ status: outboxStatusParam, limit: 100 }, signal),
    enabled: activeTab === "outbox",
  });

  const inboxQuery = useQuery({
    queryKey: ["inbox", "messages", inboxStatusParam ?? "all"],
    queryFn: ({ signal }) => getInboxMessages({ status: inboxStatusParam, limit: 100 }, signal),
    enabled: activeTab === "inbox",
  });

  const retryOutboxMutation = useMutation({
    mutationFn: retryOutboxMessage,
    onSuccess: async () => {
      showToast("Outbox mesajı tekrar kuyruğa alındı");
      await queryClient.invalidateQueries({ queryKey: ["outbox", "messages"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
    onError: () => showToast("Outbox mesajı tekrar kuyruğa alınamadı", "error"),
  });

  const retryInboxMutation = useMutation({
    mutationFn: retryInboxMessage,
    onSuccess: async () => {
      showToast("Inbox mesajı tekrar işlenebilir duruma alındı");
      await queryClient.invalidateQueries({ queryKey: ["inbox", "messages"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
    onError: () => showToast("Inbox mesajı tekrar işlenebilir duruma alınamadı", "error"),
  });

  const activeQuery = activeTab === "outbox" ? outboxQuery : inboxQuery;

  return (
    <>
      <PageToolbar
        actions={
          <button
            className="btn btn-secondary"
            disabled={activeQuery.isFetching}
            onClick={() => void activeQuery.refetch()}
            type="button"
          >
            <RefreshIcon />
            Yenile
          </button>
        }
        title="Outbox"
      />

      <Panel>
        <div className="settings-toolbar">
          <div className="filter-row">
            <button
              className={activeTab === "outbox" ? "filter-chip active" : "filter-chip"}
              onClick={() => setActiveTab("outbox")}
              type="button"
            >
              Outbox
            </button>
            <button
              className={activeTab === "inbox" ? "filter-chip active" : "filter-chip"}
              onClick={() => setActiveTab("inbox")}
              type="button"
            >
              Inbox
            </button>
          </div>
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

        {activeTab === "outbox" ? (
          <OutboxTable
            messages={outboxQuery.data?.items ?? []}
            onRetry={(id) => retryOutboxMutation.mutate(id)}
            query={outboxQuery}
            retryingId={retryOutboxMutation.isPending ? retryOutboxMutation.variables : undefined}
          />
        ) : (
          <InboxTable
            messages={inboxQuery.data?.items ?? []}
            onRetry={(id) => retryInboxMutation.mutate(id)}
            query={inboxQuery}
            retryingId={retryInboxMutation.isPending ? retryInboxMutation.variables : undefined}
          />
        )}
      </Panel>
    </>
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
  return query.isError ? (
    <PageLoadError
      description="Outbox mesajları yüklenemedi."
      onRetry={() => void query.refetch()}
      variant="card"
    />
  ) : query.isLoading ? (
    <div className="data-table-empty">Yükleniyor...</div>
  ) : messages.length === 0 ? (
    <div className="data-table-empty">Outbox mesajı yok.</div>
  ) : (
    <div className="data-table-wrap">
      <table className="data-table">
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
  return query.isError ? (
          <PageLoadError
      description="Inbox mesajları yüklenemedi."
      onRetry={() => void query.refetch()}
            variant="card"
          />
  ) : query.isLoading ? (
    <div className="data-table-empty">Yükleniyor...</div>
  ) : messages.length === 0 ? (
    <div className="data-table-empty">Inbox mesajı yok.</div>
  ) : (
    <div className="data-table-wrap">
      <table className="data-table">
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
  const canRetry = message.status === "dead_letter" || message.status === "failed";

  return (
    <tr>
      <td>
        <div className="cell-primary">{message.eventType}</div>
        <div className="cell-secondary">{message.id}</div>
      </td>
      <td>{message.sourceService}</td>
      <td>
        <div>{message.aggregateType ?? "-"}</div>
        <div className="cell-secondary">{message.aggregateId ?? "-"}</div>
      </td>
      <td>
        <StatusPill label={message.status} status={statusTone(message.status)} />
      </td>
      <td>{message.attemptCount}</td>
      <td>{formatDateTime(message.createdAtUtc)}</td>
      <td>
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
            {retrying ? "Alınıyor..." : "Retry"}
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
  const canRetry = message.status === "dead_letter" || message.status === "failed";

  return (
    <tr>
      <td>
        <div className="cell-primary">{message.eventType}</div>
        <div className="cell-secondary">{message.id}</div>
      </td>
      <td>{message.consumerName}</td>
      <td>{message.sourceService}</td>
      <td>
        <StatusPill label={message.status} status={statusTone(message.status)} />
      </td>
      <td>{message.attemptCount}</td>
      <td>{formatDateTime(message.receivedAtUtc)}</td>
      <td>
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
            {retrying ? "Alınıyor..." : "Retry"}
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
