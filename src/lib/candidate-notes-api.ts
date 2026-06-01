import { getCandidateApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut } from "./http";

const candidateRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getCandidateApiBaseUrl(),
  signal,
});

export interface CandidateNoteResponse {
  id: string;
  candidateId: string;
  body: string;
  reminderAtUtc: string | null;
  completedAtUtc: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

interface CandidateNoteListResponse {
  items: CandidateNoteResponse[];
}

interface CandidateNoteUpsertInput {
  body: string;
  reminderAtUtc: string | null;
}

export function getCandidateNotes(
  candidateId: string,
  signal?: AbortSignal
): Promise<CandidateNoteListResponse> {
  return httpGet<CandidateNoteListResponse>(
    `/api/candidates/${candidateId}/notes`,
    undefined,
    candidateRequestOptions(signal)
  );
}

export function createCandidateNote(
  candidateId: string,
  input: CandidateNoteUpsertInput,
  signal?: AbortSignal
): Promise<CandidateNoteResponse> {
  return httpPost<CandidateNoteResponse>(
    `/api/candidates/${candidateId}/notes`,
    input,
    candidateRequestOptions(signal)
  );
}

export function updateCandidateNote(
  candidateId: string,
  noteId: string,
  input: CandidateNoteUpsertInput,
  signal?: AbortSignal
): Promise<CandidateNoteResponse> {
  return httpPut<CandidateNoteResponse>(
    `/api/candidates/${candidateId}/notes/${noteId}`,
    input,
    candidateRequestOptions(signal)
  );
}

export function setCandidateNoteCompletion(
  candidateId: string,
  noteId: string,
  completed: boolean,
  signal?: AbortSignal
): Promise<CandidateNoteResponse> {
  return httpPost<CandidateNoteResponse>(
    `/api/candidates/${candidateId}/notes/${noteId}/completion`,
    { completed },
    candidateRequestOptions(signal)
  );
}

export function deleteCandidateNote(
  candidateId: string,
  noteId: string,
  signal?: AbortSignal
): Promise<void> {
  return httpDelete(
    `/api/candidates/${candidateId}/notes/${noteId}`,
    undefined,
    candidateRequestOptions(signal)
  );
}
