import { getPlatformApiBaseUrl } from "./api";
import { httpGet, httpPost } from "./http";

export type OutboxMessageStatus = "pending" | "published" | "failed" | "dead_letter";
export type InboxMessageStatus = "processing" | "processed" | "failed" | "dead_letter";

export interface OutboxMessageResponse {
  id: string;
  eventId: string;
  institutionId: string | null;
  sourceService: string;
  eventType: string;
  aggregateType: string | null;
  aggregateId: string | null;
  status: OutboxMessageStatus;
  attemptCount: number;
  availableAtUtc: string;
  createdAtUtc: string;
  lastAttemptAtUtc: string | null;
  publishedAtUtc: string | null;
  lastError: string | null;
}

interface OutboxMessageListResponse {
  items: OutboxMessageResponse[];
}

export interface OutboxMessageRetryResponse {
  id: string;
  status: OutboxMessageStatus;
  availableAtUtc: string;
  retriedAtUtc: string;
}

export interface InboxMessageResponse {
  id: string;
  eventId: string;
  institutionId: string | null;
  consumerName: string;
  sourceService: string;
  eventType: string;
  status: InboxMessageStatus;
  attemptCount: number;
  receivedAtUtc: string;
  processedAtUtc: string | null;
  lastError: string | null;
}

interface InboxMessageListResponse {
  items: InboxMessageResponse[];
}

export interface InboxMessageRetryResponse {
  id: string;
  status: InboxMessageStatus;
  retriedAtUtc: string;
}

export interface DomainEventStreamStatusResponse {
  service: string;
  component: "domain-events";
  status: "healthy" | "warning" | "danger";
  message: string;
  enabled: boolean;
  streamName: string;
  consumerGroupName: string;
  streamCount: number;
  pendingMessageCount: number | null;
  consumerCount: number | null;
  lowestPendingMessageId: string | null;
  highestPendingMessageId: string | null;
  redisError: string | null;
}

export function getOutboxMessages(
  params: { status?: OutboxMessageStatus; limit?: number },
  signal?: AbortSignal
): Promise<OutboxMessageListResponse> {
  return httpGet<OutboxMessageListResponse>("/api/outbox", params, {
    baseUrl: getPlatformApiBaseUrl(),
    signal,
  });
}

export function retryOutboxMessage(id: string): Promise<OutboxMessageRetryResponse> {
  return httpPost<OutboxMessageRetryResponse>(`/api/outbox/${id}/retry`, {}, {
    baseUrl: getPlatformApiBaseUrl(),
  });
}

export function getInboxMessages(
  params: { status?: InboxMessageStatus; limit?: number },
  signal?: AbortSignal
): Promise<InboxMessageListResponse> {
  return httpGet<InboxMessageListResponse>("/api/inbox", params, {
    baseUrl: getPlatformApiBaseUrl(),
    signal,
  });
}

export function retryInboxMessage(id: string): Promise<InboxMessageRetryResponse> {
  return httpPost<InboxMessageRetryResponse>(`/api/inbox/${id}/retry`, {}, {
    baseUrl: getPlatformApiBaseUrl(),
  });
}

export function getDomainEventStreamStatus(signal?: AbortSignal): Promise<DomainEventStreamStatusResponse> {
  return httpGet<DomainEventStreamStatusResponse>("/health/domain-events", undefined, {
    baseUrl: getPlatformApiBaseUrl(),
    signal,
  });
}
