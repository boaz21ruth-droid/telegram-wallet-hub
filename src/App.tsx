import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const DEV_USERS = [
  { id: "user1", label: "测试用户 1", emoji: "👤" },
  { id: "user2", label: "测试用户 2", emoji: "👥" },
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
      setError("登录失败，请确认后端已启动（backend: npm run start:dev）");
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-8">
      <div className="text-center">
        <div className="mb-3 text-5xl">💎</div>
        <h1 className="text-xl font-bold text-foreground">Telegram 钱包</h1>
        <p className="mt-1 text-sm text-muted-foreground">开发模式</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {DEV_USERS.map((user) => (
          <button
            key={user.id}
            onClick={() => void handleLogin(user.id)}
            disabled={loading !== null}
            className="flex items-center gap-3 rounded-2xl bg-secondary/70 px-5 py-4 text-left transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <span className="text-2xl">{user.emoji}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{user.label}</p>
              <p className="text-xs text-muted-foreground">dev_{user.id}</p>
            </div>
            {loading === user.id && (
              <span className="ml-auto animate-pulse text-xs text-muted-foreground">登录中…</span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="max-w-xs text-center text-xs text-destructive">{error}</p>}

      <p className="text-center text-xs text-muted-foreground">
        仅本地开发可用，生产环境通过 Telegram 登录
      </p>
    </div>
  );
}

function AppRoutes() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-4xl">💎</div>
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
