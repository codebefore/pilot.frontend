import { getApiBaseUrl } from "./api";
import {
  ApiError,
  httpDelete,
  httpGet,
  httpPost,
  httpPostForm,
  httpPut,
} from "./http";
import type {
  InstructorAssignment,
  InstructorAssignmentDocument,
  InstructorAssignmentUpsertRequest,
} from "./types";

const DATE_OVERLAP_CODE = "instructorAssignment.validation.dateOverlap";

export class AssignmentDateConflictError extends Error {
  constructor(message = "Sözleşme tarihleri başka bir atama ile çakışıyor") {
    super(message);
    this.name = "AssignmentDateConflictError";
  }
}

function isDateOverlapError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  const codes = error.validationErrorCodes;
  if (codes) {
    for (const fieldErrors of Object.values(codes)) {
      if (fieldErrors.some((e) => e.code === DATE_OVERLAP_CODE)) return true;
    }
  }
  const fallback = error.validationErrors;
  if (fallback) {
    for (const messages of Object.values(fallback)) {
      if (messages.some((m) => m === DATE_OVERLAP_CODE)) return true;
    }
  }
  return false;
}

async function unwrapDateOverlap<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (isDateOverlapError(error)) {
      throw new AssignmentDateConflictError();
    }
    throw error;
  }
}

export function listAssignments(
  instructorId: string,
  signal?: AbortSignal
): Promise<InstructorAssignment[]> {
  return httpGet<InstructorAssignment[]>(
    `/api/instructors/${instructorId}/assignments`,
    undefined,
    { signal }
  );
}

export function createAssignment(
  instructorId: string,
  body: InstructorAssignmentUpsertRequest
): Promise<InstructorAssignment> {
  return unwrapDateOverlap(
    httpPost<InstructorAssignment>(
      `/api/instructors/${instructorId}/assignments`,
      body
    )
  );
}

export function updateAssignment(
  instructorId: string,
  assignmentId: string,
  body: InstructorAssignmentUpsertRequest
): Promise<InstructorAssignment> {
  return unwrapDateOverlap(
    httpPut<InstructorAssignment>(
      `/api/instructors/${instructorId}/assignments/${assignmentId}`,
      body
    )
  );
}

export function deleteAssignment(
  instructorId: string,
  assignmentId: string,
  rowVersion: number
): Promise<void> {
  return httpDelete<void>(
    `/api/instructors/${instructorId}/assignments/${assignmentId}`,
    { rowVersion }
  );
}

export function addAssignmentDocument(
  instructorId: string,
  assignmentId: string,
  body: { name: string; description: string | null; file: File | null }
): Promise<InstructorAssignmentDocument> {
  const form = new FormData();
  form.append("name", body.name);
  if (body.description) form.append("description", body.description);
  if (body.file) form.append("file", body.file);

  return httpPostForm<InstructorAssignmentDocument>(
    `/api/instructors/${instructorId}/assignments/${assignmentId}/documents`,
    form
  );
}

export function deleteAssignmentDocument(
  instructorId: string,
  assignmentId: string,
  documentId: string
): Promise<void> {
  return httpDelete<void>(
    `/api/instructors/${instructorId}/assignments/${assignmentId}/documents/${documentId}`
  );
}

/** URL the user can hit (in a new tab) to download an attached file. */
export function getAssignmentDocumentDownloadUrl(
  instructorId: string,
  assignmentId: string,
  documentId: string
): string {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const path = `/api/instructors/${instructorId}/assignments/${assignmentId}/documents/${documentId}/file`;
  const dedupedPath =
    base.endsWith("/api") && path.startsWith("/api/")
      ? path.slice("/api".length)
      : path;
  return new URL(`${base}${dedupedPath}`, window.location.origin).toString();
}
