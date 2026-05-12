/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { authApi, clearUserToken, hasUserToken, setUserToken, type User } from "@/lib/api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (initData: string) => Promise<void>;
  logout: () => Promise<void>;
  setDevToken: (token: string) => Promise<void>;
  devLogin: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasUserToken()) {
      setIsLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => clearUserToken())
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (user || isLoading) return;
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;

    authApi
      .login(initData)
      .then(({ accessToken, user: nextUser }) => {
        setUserToken(accessToken);
        setUser(nextUser);
      })
      .catch(console.error);
  }, [user, isLoading]);

  const login = useCallback(async (initData: string) => {
    const { accessToken, user: nextUser } = await authApi.login(initData);
    setUserToken(accessToken);
    setUser(nextUser);
  }, []);

  const setDevToken = useCallback(async (token: string) => {
    setUserToken(token);
    const nextUser = await authApi.me();
    setUser(nextUser);
  }, []);

  const devLogin = useCallback(async (userId: string) => {
    const { accessToken, user: nextUser } = await authApi.devLogin(userId);
    setUserToken(accessToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    clearUserToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, logout, setDevToken, devLogin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        close: () => void;
      };
    };
  }
}
