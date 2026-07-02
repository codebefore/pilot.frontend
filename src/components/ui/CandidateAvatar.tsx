import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";

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
  previewOnClick?: boolean;
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
  previewOnClick = false,
}: CandidateAvatarProps) {
  const imageUrl = buildCandidatePhotoUrl(candidate);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const candidateName = `${candidateNamePart(candidate.firstName)} ${candidateNamePart(candidate.lastName)}`.trim();
  const canPreview = previewOnClick && Boolean(objectUrl);
  const genderToneClass =
    normalizeCandidateGender(candidate.gender) === "male"
      ? "candidate-avatar-male"
    : "candidate-avatar-female";
  const rootClassName = [
    "candidate-avatar",
    genderToneClass,
    canPreview ? "candidate-avatar-previewable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

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

  useEffect(() => {
    if (!previewPosition) return;

    const closePreview = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (rootRef.current?.contains(target) || previewRef.current?.contains(target))
      ) {
        return;
      }
      setPreviewPosition(null);
    };

    document.addEventListener("pointerdown", closePreview);
    return () => document.removeEventListener("pointerdown", closePreview);
  }, [previewPosition]);

  useEffect(() => {
    if (!previewPosition) return;

    const closePreview = () => setPreviewPosition(null);
    window.addEventListener("resize", closePreview);
    window.addEventListener("scroll", closePreview, true);
    return () => {
      window.removeEventListener("resize", closePreview);
      window.removeEventListener("scroll", closePreview, true);
    };
  }, [previewPosition]);

  const togglePreview = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    const previewWidth = 180;
    const gutter = 8;
    const left = Math.min(
      Math.max(gutter, rect.left + rect.width / 2 - previewWidth / 2),
      window.innerWidth - previewWidth - gutter
    );
    const top = Math.min(rect.bottom + gutter, window.innerHeight - 228);

    setPreviewPosition((current) => (current ? null : { top: Math.max(gutter, top), left }));
  };

  const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
    if (!canPreview) return;
    event.preventDefault();
    event.stopPropagation();
    togglePreview();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!canPreview || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    event.stopPropagation();
    togglePreview();
  };

  return (
    <span
      aria-label={canPreview ? `${candidateName || "Aday"} resmini aç` : undefined}
      className={rootClassName}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      ref={rootRef}
      role={canPreview ? "button" : undefined}
      style={{ ["--candidate-avatar-size" as string]: `${size}px` }}
      tabIndex={canPreview ? 0 : undefined}
    >
      {objectUrl ? (
        <img
          alt={candidateName}
          className="candidate-avatar-image"
          loading="lazy"
          src={objectUrl}
        />
      ) : (
        <span className="candidate-avatar-fallback">{candidateInitials(candidate)}</span>
      )}
      {canPreview && previewPosition
        ? createPortal(
            <div
              className="candidate-avatar-popover"
              ref={previewRef}
              style={{ top: previewPosition.top, left: previewPosition.left }}
            >
              <img
                alt={`${candidateName || "Aday"} aday resmi`}
                className="candidate-avatar-popover-image"
                src={objectUrl ?? ""}
              />
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
