import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi, clearToken, setToken, type User } from "@/lib/api";

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

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setIsLoading(false));
  }, []);

  // Auto-login via Telegram initData when available
  useEffect(() => {
    if (user || isLoading) return;
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;

    authApi
      .login(initData)
      .then(({ accessToken, user: u }) => {
        setToken(accessToken);
        setUser(u);
      })
      .catch(console.error);
  }, [user, isLoading]);

  const login = useCallback(async (initData: string) => {
    const { accessToken, user: u } = await authApi.login(initData);
    setToken(accessToken);
    setUser(u);
  }, []);

  // Dev helper: paste a token obtained via curl / Telegram
  const setDevToken = useCallback(async (token: string) => {
    setToken(token);
    const u = await authApi.me();
    setUser(u);
  }, []);

  const devLogin = useCallback(async (userId: string) => {
    const { accessToken, user: u } = await authApi.devLogin(userId);
    setToken(accessToken);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    clearToken();
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

// Augment Window for Telegram WebApp
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
