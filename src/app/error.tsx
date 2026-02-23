"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold">出了点问题</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "发生了未知错误"}
        </p>
        <Button onClick={reset}>重试</Button>
      </div>
    </div>
  );
}
