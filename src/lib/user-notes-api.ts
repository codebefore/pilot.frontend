import { getAuthApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut } from "./http";

function authOptions(signal?: AbortSignal) {
  return { baseUrl: getAuthApiBaseUrl(), signal };
}

export interface UserNoteResponse {
  id: string;
  createdByUserId: string;
  body: string;
  isVisibleToInstitution: boolean;
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
  isVisibleToInstitution?: boolean;
}

export function getUserNotes(signal?: AbortSignal): Promise<UserNoteListResponse> {
  return httpGet<UserNoteListResponse>("/api/user-notes", undefined, authOptions(signal));
}

export function createUserNote(
  input: UserNoteUpsertInput,
  signal?: AbortSignal
): Promise<UserNoteResponse> {
  return httpPost<UserNoteResponse>("/api/user-notes", input, authOptions(signal));
}

export function updateUserNote(
  noteId: string,
  input: UserNoteUpsertInput,
  signal?: AbortSignal
): Promise<UserNoteResponse> {
  return httpPut<UserNoteResponse>(`/api/user-notes/${noteId}`, input, authOptions(signal));
}

export function setUserNoteCompletion(
  noteId: string,
  completed: boolean,
  signal?: AbortSignal
): Promise<UserNoteResponse> {
  return httpPost<UserNoteResponse>(
    `/api/user-notes/${noteId}/completion`,
    { completed },
    authOptions(signal)
  );
}

export function deleteUserNote(noteId: string, signal?: AbortSignal): Promise<void> {
  return httpDelete(`/api/user-notes/${noteId}`, undefined, authOptions(signal));
}
