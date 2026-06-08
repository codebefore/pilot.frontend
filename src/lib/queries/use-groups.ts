import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createGroup,
  deleteGroup,
  getGroupById,
  getGroups,
  updateGroup,
  type GetGroupsParams,
} from "../groups-api";
import type {
  GroupCreateRequest,
  GroupResponse,
  GroupUpdateRequest,
  PagedResponse,
} from "../types";
import { candidateKeys } from "./use-candidates";

export const groupKeys = {
  all: ["groups"] as const,
  lists: () => [...groupKeys.all, "list"] as const,
  list: (filters: GetGroupsParams | undefined) =>
    [...groupKeys.lists(), filters ?? {}] as const,
  details: () => [...groupKeys.all, "detail"] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
};

export function useGroups(filters?: GetGroupsParams, enabled = true) {
  return useQuery<PagedResponse<GroupResponse>>({
    queryKey: groupKeys.list(filters),
    queryFn: ({ signal }) => getGroups(filters, signal),
    enabled,
  });
}

export function useGroup(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? groupKeys.detail(id) : groupKeys.detail("__missing__"),
    queryFn: ({ signal }) => getGroupById(id as string, signal),
    enabled: Boolean(id),
  });
}

function invalidateGroupMutationDependents(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId?: string
) {
  void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: groupKeys.details() });
  if (groupId) {
    void queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
  }
  void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
  void queryClient.invalidateQueries({ queryKey: ["training", "groups"] });
  void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
  void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GroupCreateRequest) => createGroup(body),
    onSuccess: () => {
      invalidateGroupMutationDependents(queryClient);
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: GroupUpdateRequest }) =>
      updateGroup(id, body),
    onSuccess: (_data, variables) => {
      invalidateGroupMutationDependents(queryClient, variables.id);
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: (_data, id) => {
      invalidateGroupMutationDependents(queryClient, id);
    },
  });
}
