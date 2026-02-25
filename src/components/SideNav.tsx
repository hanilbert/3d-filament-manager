"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalScanDialog } from "@/components/GlobalScanDialog";

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
      className={`flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-1 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
      {children}
    </p>
  );
}

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="h-full bg-background border-r border-border flex flex-col">
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold">Spool Tracker</h1>
          <GlobalScanDialog
            trigger={(
              <Button type="button" size="sm" variant="outline" className="h-7 px-2">
                <ScanLine className="size-3.5" />
                扫描
              </Button>
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">耗材管理</p>
      </div>
      <div className="flex-1 py-2 space-y-1">
        <SectionLabel>工作区</SectionLabel>
        <div className="space-y-0.5">
          <NavItem
            href="/spools"
            label="料卷"
            active={pathname.startsWith("/spools") || pathname.startsWith("/spool/")}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            }
          />
          <NavItem
            href="/locations"
            label="位置"
            active={pathname.startsWith("/locations") || pathname.startsWith("/location/")}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            }
          />
        </div>
        <SectionLabel>品牌与材料</SectionLabel>
        <div className="space-y-0.5">
          <NavItem
            href="/catalog"
            label="品牌"
            active={pathname === "/catalog" || pathname.startsWith("/catalog/brand") || pathname.match(/^\/catalog\/[^/]+$/) !== null && pathname !== "/catalog/materials"}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            }
          />
          <NavItem
            href="/catalog/materials"
            label="材料"
            active={pathname === "/catalog/materials" || pathname.startsWith("/catalog/material/")}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            }
          />
        </div>
      </div>
    </nav>
  );
}
