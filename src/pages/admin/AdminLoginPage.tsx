import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export default function AdminLoginPage() {
  const { isAuthenticated, login } = useAdminAuth();
  const [username, setUsername] = useState(import.meta.env.DEV ? "admin" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "admin123456" : "");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({ username, password });
      toast.success("管理员登录成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.94),_rgba(2,6,23,1))]" />
      <Card className="w-full max-w-md border-border/60 bg-card/85 backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto rounded-3xl border border-primary/20 bg-primary/10 p-4 text-primary">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-2xl">管理员登录</CardTitle>
            <CardDescription className="mt-2">
              独立管理员站点，认证与普通 Telegram 用户隔离。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="用户名"
              autoComplete="username"
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="密码"
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "登录中…" : "登录后台"}
            </Button>
          </form>
          {import.meta.env.DEV && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              本地默认账号：`admin` / `admin123456`
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
