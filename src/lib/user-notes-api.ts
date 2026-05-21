import { httpDelete, httpGet, httpPost, httpPut } from "./http";

export interface UserNoteResponse {
  id: string;
  body: string;
  reminderAtUtc: string | null;
  completedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

interface UserNoteListResponse {
  items: UserNoteResponse[];
}

interface UserNoteUpsertInput {
  body: string;
  reminderAtUtc: string | null;
}

export function getUserNotes(signal?: AbortSignal): Promise<UserNoteListResponse> {
  return httpGet<UserNoteListResponse>("/api/user-notes", undefined, { signal });
}

export function createUserNote(
  input: UserNoteUpsertInput,
  signal?: AbortSignal
): Promise<UserNoteResponse> {
  return httpPost<UserNoteResponse>("/api/user-notes", input, { signal });
}

export function updateUserNote(
  noteId: string,
  input: UserNoteUpsertInput,
  signal?: AbortSignal
): Promise<UserNoteResponse> {
  return httpPut<UserNoteResponse>(`/api/user-notes/${noteId}`, input, { signal });
}

export function setUserNoteCompletion(
  noteId: string,
  completed: boolean,
  signal?: AbortSignal
): Promise<UserNoteResponse> {
  return httpPost<UserNoteResponse>(
    `/api/user-notes/${noteId}/completion`,
    { completed },
    { signal }
  );
}

export function deleteUserNote(noteId: string, signal?: AbortSignal): Promise<void> {
  return httpDelete(`/api/user-notes/${noteId}`, undefined, { signal });
}
