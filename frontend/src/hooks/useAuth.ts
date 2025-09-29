// src/hooks/useAuth.ts
import { useCallback, useEffect, useState } from "react";
import * as authService from "../services/auth.service";
import type { User, LoginPayload } from "../types/auth";
import Router from "next/router";

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (payload: LoginPayload) => {
    setLoading(true);
    try {
      const data = await authService.login(payload);
      if (data.user) setUser(data.user);
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (e) {
      // ignore
    } finally {
      setUser(null);
      Router.push("/");
    }
  }, []);

  // optional: try refresh on mount (silent)
  useEffect(() => {
    (async () => {
      try {
        await authService.refresh();
        // if your refresh endpoint returns user, setUser(...)
        // ex: const { user } = await authService.refresh(); if (user) setUser(user)
      } catch {
        // not authenticated
      }
    })();
  }, []);

  return { user, setUser, login, logout, loading };
}
