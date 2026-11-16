"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { authService } from "@/lib/api/auth.service";
import { isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import type { UserResponse } from "@/lib/api/types";

const STAFF_TOKEN_EVENT = "ccf-staff-token-change";

function subscribeStaffTokens(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener(STAFF_TOKEN_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(STAFF_TOKEN_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function getStaffTokenSnapshot() {
  return tokenStore.getStaffAccessToken();
}

function getServerSnapshot() {
  return null as string | null;
}

export function notifyStaffTokenChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STAFF_TOKEN_EVENT));
  }
}

/**
 * FastAPI staff JWT session (orthogonal to Better Auth V1 coach cookies).
 */
export function useStaffApiSession() {
  const accessToken = useSyncExternalStore(
    subscribeStaffTokens,
    getStaffTokenSnapshot,
    getServerSnapshot,
  );
  const [user, setUser] = useState<UserResponse | null>(null);
  const [checking, setChecking] = useState(Boolean(accessToken));
  const [error, setError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    if (!tokenStore.getStaffAccessToken()) {
      setUser(null);
      setChecking(false);
      return null;
    }
    setChecking(true);
    setError(null);
    try {
      const me = await authService.me();
      setUser(me);
      return me;
    } catch (err) {
      setUser(null);
      if (isApiError(err) && err.code === "authentication_error") {
        tokenStore.clearStaffTokens();
        notifyStaffTokenChange();
      }
      setError(
        isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Session API indisponible.",
      );
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshMe();
    });
  }, [accessToken, refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setChecking(true);
    try {
      await authService.login({ email: email.trim(), password });
      notifyStaffTokenChange();
      const me = await authService.me();
      setUser(me);
      return me;
    } catch (err) {
      const message = isApiError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : "Connexion API impossible.";
      setError(message);
      throw err;
    } finally {
      setChecking(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    notifyStaffTokenChange();
    setUser(null);
  }, []);

  return {
    ready: Boolean(accessToken) && Boolean(user),
    hasToken: Boolean(accessToken),
    user,
    checking,
    error,
    login,
    logout,
    refreshMe,
  };
}
