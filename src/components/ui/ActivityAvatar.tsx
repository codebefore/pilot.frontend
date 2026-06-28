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
import type { DashboardActivityResponse } from "../../lib/types";

type ActivityAvatarProps = {
  activity: DashboardActivityResponse;
};

export function ActivityAvatar({ activity }: ActivityAvatarProps) {
  const imageUrl = getSafeImageUrl(activity.actorPhotoUrl);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const actorInitials = getInitials(activity.actorDisplayName);
  const fallback = actorInitials || activity.avatar;

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
