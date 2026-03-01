"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Home, LibraryBig, MapPin } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/",
    label: "主页",
    icon: Home,
    active: (pathname: string) => pathname === "/",
  },
  {
    href: "/spools",
    label: "线轴",
    icon: LibraryBig,
    active: (pathname: string) => pathname.startsWith("/spools"),
  },
  {
    href: "/locations",
    label: "位置",
    icon: MapPin,
    active: (pathname: string) =>
      pathname.startsWith("/locations") || pathname.startsWith("/location/"),
  },
  {
    href: "/filaments",
    label: "材料",
    icon: FlaskConical,
    active: (pathname: string) => pathname.startsWith("/filaments"),
  },
];

export { tabs };

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur">
      <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = tab.active(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}

        <div className="flex min-h-16 items-center justify-center border-l border-border/60">
          <ThemeToggle variant="icon" />
        </div>
      </div>
    </nav>
  );
}
