import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTerm,
  deleteTerm,
  getTerms,
  updateTerm,
  type GetTermsParams,
} from "../terms-api";
import type {
  CreateTermRequest,
  PagedResponse,
  TermResponse,
  UpdateTermRequest,
} from "../types";
import { groupKeys } from "./use-groups";

export const termKeys = {
  all: ["terms"] as const,
  lists: () => [...termKeys.all, "list"] as const,
  list: (filters: GetTermsParams | undefined) =>
    [...termKeys.lists(), filters ?? {}] as const,
};

export function useTerms(filters?: GetTermsParams, enabled = true) {
  return useQuery<PagedResponse<TermResponse>>({
    queryKey: termKeys.list(filters),
    queryFn: ({ signal }) => getTerms(filters, signal),
    enabled,
  });
}

function invalidateTermAndGroupLists(
  queryClient: ReturnType<typeof useQueryClient>
) {
  void queryClient.invalidateQueries({ queryKey: termKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
}

export function useCreateTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTermRequest) => createTerm(body),
    onSuccess: () => invalidateTermAndGroupLists(queryClient),
  });
}

export function useUpdateTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTermRequest }) =>
      updateTerm(id, body),
    onSuccess: () => invalidateTermAndGroupLists(queryClient),
  });
}

export function useDeleteTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTerm(id),
    onSuccess: () => invalidateTermAndGroupLists(queryClient),
  });
}
