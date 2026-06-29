import { useEffect, useState } from "react";

import { createAuthorizedObjectUrl } from "../../lib/authorized-files";
import {
  getApiBaseUrl,
  getAuthApiBaseUrl,
  getDocumentApiBaseUrl,
  getPlatformApiBaseUrl,
  getTrainingApiBaseUrl,
} from "../../lib/api";
import { currentLocale } from "../../lib/i18n";
import { getInstructors } from "../../lib/instructors-api";
import { normalizeApiPathForBaseUrl } from "../../lib/http";
import type { DashboardActivityResponse } from "../../lib/types";

type ActivityAvatarProps = {
  activity: DashboardActivityResponse;
};

export function ActivityAvatar({ activity }: ActivityAvatarProps) {
  const [instructorPhotoUrl, setInstructorPhotoUrl] = useState<string | null>(null);
  const imageUrl = getSafeImageUrl(activity.actorPhotoUrl) ?? getSafeImageUrl(instructorPhotoUrl);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const actorInitials = getInitials(activity.actorDisplayName);
  const fallback = actorInitials || activity.avatar;

  useEffect(() => {
    setInstructorPhotoUrl(null);
    const actorPhoneNumber = normalizePhone(activity.actorPhoneNumber);
    const actorDisplayName = activity.actorDisplayName?.trim() ?? "";
    if (activity.actorPhotoUrl || (!actorPhoneNumber && !actorDisplayName)) {
      return;
    }

    const controller = new AbortController();
    getInstructors(
      {
        search: actorPhoneNumber || actorDisplayName,
        includeInactive: true,
        pageSize: 10,
      },
      controller.signal
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        const targetName = normalizeName(actorDisplayName);
        const instructor = response.items.find((item) => {
          if (!item.hasPhoto) return false;
          if (actorPhoneNumber && normalizePhone(item.phoneNumber) === actorPhoneNumber) return true;
          return Boolean(targetName && normalizeName(`${item.firstName} ${item.lastName}`) === targetName);
        });
        setInstructorPhotoUrl(instructor ? buildInstructorPhotoUrl(instructor.id) : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setInstructorPhotoUrl(null);
      });

    return () => controller.abort();
  }, [activity.actorDisplayName, activity.actorPhoneNumber, activity.actorPhotoUrl]);

  useEffect(() => {
    setImageFailed(false);
    setDisplayUrl(null);
    if (!imageUrl) {
      return;
    }

    if (!shouldUseAuthorizedFetch(imageUrl)) {
      setDisplayUrl(imageUrl);
      return;
    }

    const controller = new AbortController();
    let createdUrl: string | null = null;
    createAuthorizedObjectUrl(imageUrl, controller.signal)
      .then((url) => {
        createdUrl = url;
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }

        setDisplayUrl(url);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setDisplayUrl(imageUrl);
        }
      });

    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [imageUrl]);

  if (displayUrl && !imageFailed) {
    return (
      <img
        alt={activity.actorDisplayName ?? activity.actor}
        className="activity-avatar activity-avatar-image"
        loading="lazy"
        onError={() => setImageFailed(true)}
        src={displayUrl}
      />
    );
  }

  return <div className={`activity-avatar tone-${activity.avatarTone}`}>{fallback}</div>;
}

function buildInstructorPhotoUrl(instructorId: string): string {
  const base = getTrainingApiBaseUrl().replace(/\/+$/, "");
  const path = `/api/training/instructors/${instructorId}/photo`;
  return new URL(`${base}${normalizeApiPathForBaseUrl(base, path)}`, window.location.origin).toString();
}

function normalizeName(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR") ?? "";
}

function normalizePhone(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 12 && digits.startsWith("90")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

function shouldUseAuthorizedFetch(url: string): boolean {
  if (url.startsWith("blob:")) {
    return false;
  }

  try {
    return getAuthorizedFetchOrigins().has(new URL(url, window.location.origin).origin);
  } catch {
    return false;
  }
}

function getAuthorizedFetchOrigins(): Set<string> {
  return new Set(
    getConfiguredBaseUrls().flatMap((url) => {
      try {
        return [new URL(url, window.location.origin).origin];
      } catch {
        return [];
      }
    })
  );
}

function getConfiguredBaseUrls(): string[] {
  return [
    window.location.origin,
    ...[
      getApiBaseUrl,
      getAuthApiBaseUrl,
      getDocumentApiBaseUrl,
      getPlatformApiBaseUrl,
      getTrainingApiBaseUrl,
    ].flatMap((getBaseUrl) => {
      try {
        return [getBaseUrl()];
      } catch {
        return [];
      }
    }),
  ];
}

function getSafeImageUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  if (!url) return null;

  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "blob:") {
      return url;
    }
  } catch {
    return null;
  }

  return null;
}

function getInitials(value: string | null | undefined): string {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase(currentLocale()) ?? "")
    .join("");
}
