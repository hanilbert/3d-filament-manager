"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { normalizeThemeMode, type ThemeMode } from "@/lib/theme";

interface ThemeToggleProps {
  variant?: "icon" | "compact";
  className?: string;
}

function subscribe(): () => void {
  return () => {};
}

function getNextTheme(theme: ThemeMode): ThemeMode {
  if (theme === "system") return "light";
  if (theme === "light") return "dark";
  return "system";
}

function getThemeLabel(theme: ThemeMode): string {
  if (theme === "system") return "跟随系统";
  if (theme === "light") return "浅色";
  return "深色";
}

export function ThemeToggle({ variant = "compact", className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const mode = normalizeThemeMode(theme);

  const icon = useMemo(() => {
    if (mode === "dark") return <Moon className="size-4" />;
    if (mode === "light") return <Sun className="size-4" />;
    return <Monitor className="size-4" />;
  }, [mode]);

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground",
          variant === "icon" ? "size-9" : "h-9 px-2.5",
          className
        )}
        aria-label="主题切换"
      >
        <Monitor className="size-4" />
      </button>
    );
  }

  const next = getNextTheme(mode);

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:text-foreground",
        variant === "icon" ? "size-9" : "h-9 px-2.5 text-xs",
        className
      )}
      title={`当前：${getThemeLabel(mode)}，点击切换`}
      aria-label={`当前主题：${getThemeLabel(mode)}，点击切换`}
    >
      {icon}
      {variant === "compact" ? <span>{getThemeLabel(mode)}</span> : null}
    </button>
  );
}
