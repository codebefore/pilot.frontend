import { useEffect, useState } from "react";

import { getTrainingApiBaseUrl } from "../../lib/api";
import { createAuthorizedObjectUrl } from "../../lib/authorized-files";
import type { InstructorResponse } from "../../lib/types";

type InstructorAvatarProps = {
  instructor: Pick<InstructorResponse, "id" | "firstName" | "lastName" | "hasPhoto">;
  className?: string;
  size?: number;
};

function instructorInitials(instructor: Pick<InstructorResponse, "firstName" | "lastName">): string {
  const first = instructor.firstName.trim().charAt(0);
  const last = instructor.lastName.trim().charAt(0);
  return `${first}${last}`.trim().toLocaleUpperCase("tr-TR") || "E";
}

function buildInstructorPhotoUrl(
  instructor: Pick<InstructorResponse, "id" | "hasPhoto">
): string | null {
  if (!instructor.hasPhoto) return null;

  const base = getTrainingApiBaseUrl().replace(/\/+$/, "");
  const path = `/api/training/instructors/${instructor.id}/photo`;
  const dedupedPath =
    base.endsWith("/api") && path.startsWith("/api/")
      ? path.slice("/api".length)
      : path;

  return new URL(`${base}${dedupedPath}`, window.location.origin).toString();
}

export function InstructorAvatar({
  instructor,
  className,
  size = 34,
}: InstructorAvatarProps) {
  const imageUrl = buildInstructorPhotoUrl(instructor);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const rootClassName = ["candidate-avatar", "instructor-avatar", className]
    .filter(Boolean)
    .join(" ");

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
          alt={`${instructor.firstName} ${instructor.lastName}`}
          className="candidate-avatar-image"
          loading="lazy"
          src={objectUrl}
        />
      ) : (
        <span className="candidate-avatar-fallback">{instructorInitials(instructor)}</span>
      )}
    </span>
  );
}
