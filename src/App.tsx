import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const DEV_USERS = [
  { id: "user1", label: "测试用户 1", emoji: "👤" },
  { id: "user2", label: "测试用户 2", emoji: "👥" },
  { id: "admin1", label: "管理员",    emoji: "🔧" },
];

function DevLoginScreen() {
  const { devLogin } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleLogin = async (userId: string) => {
    setLoading(userId);
    setError("");
    try {
      await devLogin(userId);
    } catch {
      setError("登录失败，请确认后端已启动（npm run start:dev）");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-8">
      <div className="text-center">
        <div className="text-5xl mb-3">💎</div>
        <h1 className="text-xl font-bold text-foreground">Telegram 钱包</h1>
        <p className="text-sm text-muted-foreground mt-1">开发模式</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3">
        {DEV_USERS.map((u) => (
          <button
            key={u.id}
            onClick={() => handleLogin(u.id)}
            disabled={loading !== null}
            className="flex items-center gap-3 rounded-2xl bg-secondary/70 hover:bg-secondary px-5 py-4 text-left transition-colors disabled:opacity-50"
          >
            <span className="text-2xl">{u.emoji}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{u.label}</p>
              <p className="text-xs text-muted-foreground">dev_{u.id}</p>
            </div>
            {loading === u.id && (
              <span className="ml-auto text-xs text-muted-foreground animate-pulse">登录中…</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
      )}

      <p className="text-xs text-muted-foreground text-center">
        仅本地开发可用，生产环境通过 Telegram 登录
      </p>
    </div>
  );
}

function AppRoutes() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">💎</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <DevLoginScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
