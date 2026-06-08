import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignCandidateGroup,
  createCandidate,
  createCandidateTag,
  deleteCandidate,
  deleteCandidateTag,
  getCandidateById,
  getCandidateReuseSources,
  getCandidates,
  removeActiveGroupAssignment,
  searchCandidateTags,
  setCandidateRegistrationDate,
  setCandidateRegistrationNumber,
  setCandidateSecondPracticeRound,
  setCandidateTheoryExemption,
  updateCandidate,
  updateCandidateExistingLicense,
  updateCandidateTag,
  type GetCandidatesParams,
} from "../candidates-api";
import { getExamScheduleOptions } from "../exam-schedules-api";
import type {
  CandidateExistingLicenseRequest,
  CandidateResponse,
  CandidateUpsertRequest,
  ExamScheduleOption,
  PagedResponse,
} from "../types";
import { groupKeys } from "./use-groups";

type GetExamScheduleOptionsParams = Parameters<typeof getExamScheduleOptions>[0];
const LIVE_CANDIDATE_STALE_TIME_MS = 0;

export const candidateKeys = {
  all: ["candidates"] as const,
  lists: () => [...candidateKeys.all, "list"] as const,
  list: (filters: GetCandidatesParams | undefined) =>
    [...candidateKeys.lists(), filters ?? {}] as const,
  details: () => [...candidateKeys.all, "detail"] as const,
  detail: (id: string) => [...candidateKeys.details(), id] as const,
  tags: (search?: string) => [...candidateKeys.all, "tags", search ?? ""] as const,
  reuseSources: (nationalId: string) =>
    [...candidateKeys.all, "reuseSources", nationalId] as const,
  examScheduleOptions: (params: GetExamScheduleOptionsParams) =>
    [...candidateKeys.all, "examScheduleOptions", params] as const,
};

export function useCandidates(filters?: GetCandidatesParams, enabled = true) {
  return useQuery<PagedResponse<CandidateResponse>>({
    queryKey: candidateKeys.list(filters),
    queryFn: ({ signal }) => getCandidates(filters, signal),
    enabled,
    staleTime: LIVE_CANDIDATE_STALE_TIME_MS,
  });
}

export function useCandidate(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? candidateKeys.detail(id) : candidateKeys.detail("__missing__"),
    queryFn: ({ signal }) => getCandidateById(id as string, signal),
    enabled: Boolean(id),
    staleTime: LIVE_CANDIDATE_STALE_TIME_MS,
  });
}

export function useCandidateTags(search?: string, limit = 20, enabled = true) {
  return useQuery({
    queryKey: candidateKeys.tags(search),
    queryFn: ({ signal }) => searchCandidateTags(search, limit, signal),
    enabled,
  });
}

export function useCandidateReuseSources(nationalId: string | null | undefined) {
  return useQuery({
    queryKey: candidateKeys.reuseSources(nationalId ?? ""),
    queryFn: ({ signal }) => getCandidateReuseSources(nationalId as string, signal),
    enabled: Boolean(nationalId),
  });
}

export function useExamScheduleOptions(
  params: GetExamScheduleOptionsParams | null,
  enabled = true
) {
  return useQuery<ExamScheduleOption[]>({
    queryKey: candidateKeys.examScheduleOptions(params as GetExamScheduleOptionsParams),
    queryFn: ({ signal }) => getExamScheduleOptions(params as GetExamScheduleOptionsParams, signal),
    enabled: Boolean(params) && enabled,
  });
}

function invalidateCandidateLists(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
}

function invalidateCandidateDetails(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
}

function invalidateDashboardData(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

function invalidateExamScheduleOptions(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "examScheduleOptions"] });
}

function invalidatePaymentOverviews(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ["payments"] });
}

function invalidateCandidateMutationDependents(
  queryClient: ReturnType<typeof useQueryClient>,
  candidateId?: string
) {
  void invalidateCandidateLists(queryClient);
  void invalidateCandidateDetails(queryClient);
  if (candidateId) {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidateId) });
    void queryClient.invalidateQueries({ queryKey: ["candidates", "documents", candidateId] });
    void queryClient.invalidateQueries({ queryKey: ["candidates", "accounting", candidateId] });
  }
  void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
  void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
  void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: groupKeys.details() });
  void queryClient.invalidateQueries({ queryKey: ["training", "groups"] });
  void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
  void invalidatePaymentOverviews(queryClient);
  void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
  void invalidateDashboardData(queryClient);
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CandidateUpsertRequest) => createCandidate(body),
    onSuccess: () => {
      invalidateCandidateMutationDependents(queryClient);
    },
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CandidateUpsertRequest }) =>
      updateCandidate(id, body),
    onSuccess: (_data, variables) => {
      invalidateCandidateMutationDependents(queryClient, variables.id);
    },
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCandidate(id),
    onSuccess: (_data, id) => {
      void invalidateExamScheduleOptions(queryClient);
      invalidateCandidateMutationDependents(queryClient, id);
    },
  });
}

export function useSetCandidateTheoryExemption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isTheoryExempt }: { id: string; isTheoryExempt: boolean }) =>
      setCandidateTheoryExemption(id, isTheoryExempt),
    onSuccess: (_data, variables) => {
      invalidateCandidateMutationDependents(queryClient, variables.id);
    },
  });
}

export function useSetCandidateRegistrationNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      registrationNumber,
      rowVersion,
    }: {
      id: string;
      registrationNumber: string;
      rowVersion: number;
    }) => setCandidateRegistrationNumber(id, registrationNumber, rowVersion),
    onSuccess: (_data, variables) => {
      invalidateCandidateMutationDependents(queryClient, variables.id);
    },
  });
}

export function useSetCandidateRegistrationDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      registrationDate,
      rowVersion,
    }: {
      id: string;
      registrationDate: string;
      rowVersion: number;
    }) => setCandidateRegistrationDate(id, registrationDate, rowVersion),
    onSuccess: (_data, variables) => {
      invalidateCandidateMutationDependents(queryClient, variables.id);
    },
  });
}

export function useUpdateCandidateExistingLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CandidateExistingLicenseRequest }) =>
      updateCandidateExistingLicense(id, body),
    onSuccess: (_data, variables) => {
      invalidateCandidateMutationDependents(queryClient, variables.id);
    },
  });
}

export function useSetCandidateSecondPracticeRound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      enabled,
      rowVersion,
    }: {
      id: string;
      enabled: boolean;
      rowVersion: number;
    }) => setCandidateSecondPracticeRound(id, enabled, rowVersion),
    onSuccess: (_data, variables) => {
      invalidateCandidateMutationDependents(queryClient, variables.id);
    },
  });
}

export function useAssignCandidateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, groupId }: { candidateId: string; groupId: string }) =>
      assignCandidateGroup(candidateId, groupId),
    onSuccess: (_data, variables) => {
      invalidateCandidateMutationDependents(queryClient, variables.candidateId);
    },
  });
}

export function useRemoveActiveGroupAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: string) => removeActiveGroupAssignment(candidateId),
    onSuccess: (_data, candidateId) => {
      invalidateCandidateMutationDependents(queryClient, candidateId);
    },
  });
}

function invalidateCandidateTags(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "tags"] });
  void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
  void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
  void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateCandidateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCandidateTag(name),
    onSuccess: () => {
      void invalidateCandidateTags(queryClient);
    },
  });
}

export function useUpdateCandidateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCandidateTag(id, name),
    onSuccess: () => {
      invalidateCandidateTags(queryClient);
      void invalidateCandidateLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    },
  });
}

export function useDeleteCandidateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCandidateTag(id),
    onSuccess: () => {
      invalidateCandidateTags(queryClient);
      void invalidateCandidateLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    },
  });
}
