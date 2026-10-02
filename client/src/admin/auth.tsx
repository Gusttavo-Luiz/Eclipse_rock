import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "../../../shared/schemas";
import { api, apiSend } from "../lib/api";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

interface AuthCtx {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: SessionUser | null }>("/api/auth/me");
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await apiSend<{ user: SessionUser }>("POST", "/api/auth/login", { email, password });
    setUser(r.user);
  };
  const logout = async () => {
    try {
      await apiSend("POST", "/api/auth/logout");
    } finally {
      setUser(null);
    }
  };

  return <Ctx.Provider value={{ user, ready, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora do AuthProvider");
  return v;
}
