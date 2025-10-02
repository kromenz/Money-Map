import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

  useEffect(() => {
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
