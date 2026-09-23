import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, apiGet, apiPost } from "../lib/api";
import { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await apiGet<AuthUser>("/api/v1/auth/me");
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) {
        console.error("Failed to load session", err);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const me = await apiPost<AuthUser>("/api/v1/auth/login", { email, password });
    setUser(me);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const me = await apiPost<AuthUser>("/api/v1/auth/signup", { name, email, password });
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/api/v1/auth/logout", {});
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, loginWithPassword, signup, logout }),
    [user, loading, loginWithPassword, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
