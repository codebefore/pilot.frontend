import { useEffect, useState } from "react";

import { getDocumentApiBaseUrl } from "../../lib/api";
import { createAuthorizedObjectUrl } from "../../lib/authorized-files";
import { normalizeApiPathForBaseUrl } from "../../lib/http";
import { normalizeCandidateGender } from "../../lib/status-maps";
import type { CandidateResponse } from "../../lib/types";

type CandidateAvatarProps = {
  candidate: Pick<CandidateResponse, "id" | "photo"> & {
    firstName?: string | null;
    lastName?: string | null;
    gender?: string | null;
  };
  className?: string;
  size?: number;
};

function candidateNamePart(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function candidateInitials(candidate: Pick<CandidateAvatarProps["candidate"], "firstName" | "lastName">): string {
  const first = candidateNamePart(candidate.firstName).charAt(0);
  const last = candidateNamePart(candidate.lastName).charAt(0);
  return `${first}${last}`.trim().toLocaleUpperCase("tr-TR") || "A";
}

function buildCandidatePhotoUrl(
  candidate: Pick<CandidateResponse, "id" | "photo">
): string | null {
  if (!candidate.photo?.documentId) return null;
  if (candidate.photo.kind !== "biometric_photo") return null;

  const base = getDocumentApiBaseUrl().replace(/\/+$/, "");
  const path = `/api/candidates/${candidate.id}/documents/${candidate.photo.documentId}/download`;

  return new URL(`${base}${normalizeApiPathForBaseUrl(base, path)}`, window.location.origin).toString();
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

    const controller = new AbortController();
    let createdUrl: string | null = null;
    createAuthorizedObjectUrl(imageUrl, controller.signal)
      .then((url) => {
        createdUrl = url;
        if (!controller.signal.aborted) setObjectUrl(url);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setObjectUrl(null);
        }
      });

    return () => {
      controller.abort();
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
          alt={`${candidateNamePart(candidate.firstName)} ${candidateNamePart(candidate.lastName)}`.trim()}
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
