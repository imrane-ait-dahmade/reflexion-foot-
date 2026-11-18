"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { authBffClient } from "@/lib/api/auth-bff.client";
import { authService } from "@/lib/api/auth.service";
import { isApiError } from "@/lib/api/errors";
import {
  notifyStaffTokenChange,
  subscribeStaffTokenChanges,
} from "@/lib/api/staff-token-events";
import { tokenStore } from "@/lib/api/token-store";
import type { UserResponse } from "@/lib/api/types";

export { notifyStaffTokenChange } from "@/lib/api/staff-token-events";

function getStaffTokenSnapshot() {
  return tokenStore.getStaffAccessToken();
}

function getServerSnapshot() {
  return null as string | null;
}

/**
 * FastAPI staff JWT session via BFF cookies + localStorage tokenStore.
 */
export function useStaffApiSession() {
  const accessToken = useSyncExternalStore(
    subscribeStaffTokenChanges,
    getStaffTokenSnapshot,
    getServerSnapshot,
  );
  const [user, setUser] = useState<UserResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      if (!tokenStore.getStaffAccessToken()) {
        // Cookies may still be valid after a hard refresh cleared localStorage.
        try {
          await authBffClient.refresh();
        } catch {
          setUser(null);
          setChecking(false);
          return null;
        }
      }
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
      await authBffClient.login(email.trim(), password);
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
    await authBffClient.logout();
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
