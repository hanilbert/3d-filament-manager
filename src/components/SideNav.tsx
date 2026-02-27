"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Home, LibraryBig, MapPin, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalScanDialog } from "@/components/GlobalScanDialog";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

function NavItem({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mx-2 flex items-center gap-2.5 rounded-lg px-4 py-2 text-sm transition-colors",
        active
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col border-r border-border/80 bg-background/95 backdrop-blur">
      <div className="border-b border-border/80 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold tracking-tight">线轴管家</h1>
          <GlobalScanDialog
            trigger={
              <Button type="button" size="sm" variant="outline" className="h-8 px-2.5">
                <ScanLine className="size-3.5" />
                扫描
              </Button>
            }
          />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">耗材管理</p>
      </div>

      <div className="flex-1 space-y-1 py-2">
        <SectionLabel>工作区</SectionLabel>
        <div className="space-y-0.5">
          <NavItem
            href="/"
            label="主页"
            active={pathname === "/"}
            icon={<Home className="size-4" />}
          />
          <NavItem
            href="/spools"
            label="线轴"
            active={pathname.startsWith("/spools")}
            icon={<LibraryBig className="size-4" />}
          />
          <NavItem
            href="/locations"
            label="位置"
            active={pathname.startsWith("/locations") || pathname.startsWith("/location/")}
            icon={<MapPin className="size-4" />}
          />
        </div>

        <SectionLabel>品牌与材料</SectionLabel>
        <div className="space-y-0.5">
          <NavItem
            href="/filaments"
            label="品牌"
            active={
              pathname === "/filaments" ||
              pathname.startsWith("/filaments/brand") ||
              (pathname.match(/^\/filaments\/[^/]+$/) !== null &&
                pathname !== "/filaments/materials")
            }
            icon={<LibraryBig className="size-4" />}
          />
          <NavItem
            href="/filaments/materials"
            label="材料"
            active={
              pathname === "/filaments/materials" ||
              pathname.startsWith("/filaments/material/")
            }
            icon={<FlaskConical className="size-4" />}
          />
        </div>
      </div>

      <div className="border-t border-border/80 p-3">
        <ThemeToggle variant="compact" className="w-full justify-center" />
      </div>
    </nav>
  );
}
