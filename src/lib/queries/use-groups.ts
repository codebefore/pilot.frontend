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

export const groupKeys = {
  all: ["groups"] as const,
  lists: () => [...groupKeys.all, "list"] as const,
  list: (filters: GetGroupsParams | undefined) =>
    [...groupKeys.lists(), filters ?? {}] as const,
  details: () => [...groupKeys.all, "detail"] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
};

export function useGroups(filters?: GetGroupsParams, enabled = true, consumeSignal = true) {
  return useQuery<PagedResponse<GroupResponse>>({
    queryKey: groupKeys.list(filters),
    queryFn: ({ signal }) => (consumeSignal ? getGroups(filters, signal) : getGroups(filters)),
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

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GroupCreateRequest) => createGroup(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: GroupUpdateRequest }) =>
      updateGroup(id, body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.id) });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) });
    },
  });
}
