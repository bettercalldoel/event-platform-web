"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useRouter } from "next/navigation";

type Role = "CUSTOMER" | "ORGANIZER";

type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  referralCode: string;
  avatarUrl?: string | null;
};

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: any) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    if (!token) return;
    const me = await api<User>("/auth/me", { token });
    setUser(me);
  };

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) setToken(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    localStorage.setItem("token", token);
    refreshMe().catch(() => {
      // token invalid
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api<any>("/auth/login", { method: "POST", body: { email, password } });
    setToken(res.accessToken);
    setUser({
      id: res.id,
      name: res.name,
      email: res.email,
      role: res.role,
      referralCode: res.referralCode,
      avatarUrl: res.avatarUrl ?? null,
    });
    router.push("/");
  };

  const register = async (payload: any) => {
    await api("/auth/register", { method: "POST", body: payload });
    // setelah register, langsung login biar UX enak
    await login(payload.email, payload.password);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  const value = useMemo(
    () => ({ token, user, loading, login, register, logout, refreshMe }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
