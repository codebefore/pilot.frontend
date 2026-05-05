import { useEffect, useState } from "react";

import { getApiBaseUrl } from "../../lib/api";
import { createAuthorizedObjectUrl } from "../../lib/authorized-files";
import { normalizeCandidateGender } from "../../lib/status-maps";
import type { CandidateResponse } from "../../lib/types";

type CandidateAvatarProps = {
  candidate: Pick<CandidateResponse, "id" | "firstName" | "lastName" | "photo"> & {
    gender?: string | null;
  };
  className?: string;
  size?: number;
};

function candidateInitials(candidate: Pick<CandidateResponse, "firstName" | "lastName">): string {
  const first = candidate.firstName.trim().charAt(0);
  const last = candidate.lastName.trim().charAt(0);
  return `${first}${last}`.trim().toLocaleUpperCase("tr-TR") || "A";
}

function buildCandidatePhotoUrl(
  candidate: Pick<CandidateResponse, "id" | "photo">
): string | null {
  if (!candidate.photo?.documentId) return null;

  const base = getApiBaseUrl().replace(/\/+$/, "");
  const path = `/api/candidates/${candidate.id}/documents/${candidate.photo.documentId}/download`;
  const dedupedPath =
    base.endsWith("/api") && path.startsWith("/api/")
      ? path.slice("/api".length)
      : path;

  return new URL(`${base}${dedupedPath}`, window.location.origin).toString();
}

export function CandidateAvatar({
  candidate,
  className,
  size = 34,
}: CandidateAvatarProps) {
  const imageUrl = buildCandidatePhotoUrl(candidate);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const genderToneClass =
    normalizeCandidateGender(candidate.gender) === "male"
      ? "candidate-avatar-male"
    : "candidate-avatar-female";
  const rootClassName = ["candidate-avatar", genderToneClass, className].filter(Boolean).join(" ");

  useEffect(() => {
    if (!imageUrl) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    createAuthorizedObjectUrl(imageUrl)
      .then((url) => {
        createdUrl = url;
        if (!cancelled) setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setObjectUrl(null);
    };
  }, [imageUrl]);

  return (
    <span
      className={rootClassName}
      style={{ ["--candidate-avatar-size" as string]: `${size}px` }}
    >
      {objectUrl ? (
        <img
          alt={`${candidate.firstName} ${candidate.lastName}`}
          className="candidate-avatar-image"
          loading="lazy"
          src={objectUrl}
        />
      ) : (
        <span className="candidate-avatar-fallback">{candidateInitials(candidate)}</span>
      )}
    </span>
  );
}
