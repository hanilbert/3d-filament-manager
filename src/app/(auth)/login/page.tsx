"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("密码错误，请重试");
        return;
      }

      const { token, expiresAt } = await res.json();

      // 存入 localStorage 供 API 请求使用
      localStorage.setItem("spool_tracker_token", token);
      localStorage.setItem("spool_tracker_expires", String(expiresAt));

      // 存入 Cookie 供中间件使用（7 天）
      const days = 7;
      document.cookie = `spool_tracker_token=${token}; path=/; max-age=${days * 24 * 3600}; SameSite=Lax`;

      router.push("/spools");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Spool Tracker</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">3D 打印耗材管理系统</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">访问密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入访问密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={loading || !password}
            >
              {loading ? "验证中..." : "进入系统"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
