import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getMebbisSessionStatus } from "../mebbis-jobs-api";
import { useAuth } from "../auth";
import { useToast } from "../../components/ui/Toast";

export const MEBBIS_SESSION_REQUIRED_MESSAGE = "MEBBİS oturumu açılmalı.";

export function useMebbisSessionGuard() {
  const { showToast } = useToast();
  const { activeInstitution, user } = useAuth();
  const sessionQuery = useQuery({
    queryKey: ["mebbis", "session", "status", activeInstitution?.id ?? "no-institution", user?.id ?? "anonymous"],
    queryFn: ({ signal }) => getMebbisSessionStatus(signal),
    refetchInterval: 30_000,
    enabled: Boolean(activeInstitution && user),
  });

  const sessionOpen = useMemo(() => {
    return sessionQuery.data?.isOpen === true;
  }, [sessionQuery.data?.isOpen]);

  const checking = sessionQuery.isPending;
  const disabled = checking || !sessionOpen;

  const warnSessionRequired = useCallback(() => {
    showToast(MEBBIS_SESSION_REQUIRED_MESSAGE, "error");
  }, [showToast]);

  const ensureSession = useCallback(() => {
    if (sessionOpen) return true;
    warnSessionRequired();
    return false;
  }, [sessionOpen, warnSessionRequired]);

  return {
    checking,
    disabled,
    ensureSession,
    message: MEBBIS_SESSION_REQUIRED_MESSAGE,
    sessionOpen,
    warnSessionRequired,
  };
}
