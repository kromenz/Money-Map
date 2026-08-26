"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as authService from "../services/auth.service";
import type { User } from "../types/auth";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (p: { email: string; password: string }) => Promise<any>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Retomar a sessao e um gesto que so pode acontecer uma vez por montagem.
   *
   * Nao e um efeito idempotente: o /auth/refresh RODA o token no servidor --
   * cria a linha nova e apaga a velha. Com o reactStrictMode ligado, o React
   * corre o efeito de montagem duas vezes, e o resultado eram dois pedidos com
   * 1ms de intervalo a rodar o mesmo token. Um respondia 200 e o outro 500, e
   * quem chegasse por ultimo decidia: se fosse o erro, o catch punha o user a
   * null e o useRequireAuth mandava o utilizador para a pagina de entrada.
   * Dava um F5 que deslogava dia sim, dia nao.
   */
  const resumed = useRef(false);

  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;

    (async () => {
      try {
        const data = await authService.refresh(); // tries to refresh using cookie refresh_token
        if (data?.user) setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (payload: { email: string; password: string }) => {
    const res = await authService.login(payload);
    if (res?.user) setUser(res.user);
    return res;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, loading, login, logout, setUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
}
