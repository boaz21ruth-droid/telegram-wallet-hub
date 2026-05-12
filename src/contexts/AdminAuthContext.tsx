/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  adminAuthApi,
  clearAdminToken,
  hasAdminToken,
  setAdminToken,
  type AdminLoginBody,
  type AdminPrincipal,
} from "@/lib/api";
import {
  ADMIN_ROLE_LABELS,
  hasAdminPermission as checkAdminPermission,
  isAdminAuthenticated,
  type AdminPermission,
} from "@/lib/admin";

interface AdminAuthState {
  admin: AdminPrincipal | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  roleLabel: string | null;
  login: (body: AdminLoginBody) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: AdminPermission) => boolean;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminPrincipal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasAdminToken()) {
      setIsLoading(false);
      return;
    }
    adminAuthApi
      .me()
      .then(setAdmin)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (body: AdminLoginBody) => {
    const { accessToken, admin: nextAdmin } = await adminAuthApi.login(body);
    setAdminToken(accessToken);
    setAdmin(nextAdmin);
  }, []);

  const logout = useCallback(async () => {
    await adminAuthApi.logout().catch(() => {});
    clearAdminToken();
    setAdmin(null);
  }, []);

  const isAuthenticated = isAdminAuthenticated(admin);
  const roleLabel = admin ? ADMIN_ROLE_LABELS[admin.role] : null;
  const hasPermission = useCallback(
    (permission: AdminPermission) => {
      if (!admin) return false;
      return checkAdminPermission(admin.role, permission);
    },
    [admin],
  );

  return (
    <AdminAuthContext.Provider
      value={{ admin, isLoading, isAuthenticated, roleLabel, login, logout, hasPermission }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
