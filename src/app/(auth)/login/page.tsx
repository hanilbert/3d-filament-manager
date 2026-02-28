"use client";

import { useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Only allow relative paths starting with / to prevent open redirect (S-M1) */
function sanitizeRedirect(raw: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/spools";
  return raw;
}

function LoginPageContent() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = sanitizeRedirect(searchParams.get("from") || "/spools");

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

      if (res.status === 429) {
        setError("登录尝试过于频繁，请稍后再试");
        return;
      }

      if (!res.ok) {
        setError("密码错误，请重试");
        return;
      }

      const { expiresAt } = await res.json();
      void expiresAt; // cookie is set server-side as HttpOnly

      router.push(from);
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
          <CardTitle className="text-2xl">耗材管家</CardTitle>
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
