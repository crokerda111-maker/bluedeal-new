"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ApiUser } from "../../lib/apiClient";
import { apiLogin, apiLogout, apiMe, apiSignup } from "../../lib/apiClient";

type AuthContextValue = {
  user: ApiUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<{ ok: true; user: ApiUser } | null>;
  signup: (payload: { email: string; password: string; nickname: string }) => Promise<{ ok: true; user: ApiUser } | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiMe();
      setUser(res.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial session check
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (payload: { email: string; password: string }) => {
    try {
      const res = await apiLogin(payload);
      await refresh();
      return res;
    } catch {
      return null;
    }
  };

  const signup = async (payload: { email: string; password: string; nickname: string }) => {
    try {
      const res = await apiSignup(payload);
      await refresh();
      return res;
    } catch {
      return null;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    } finally {
      await refresh();
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, refresh, login, signup, logout }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
