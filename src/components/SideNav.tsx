"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabs } from "./BottomNav";

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="h-full bg-background border-r border-border flex flex-col">
      <div className="px-4 py-5 border-b border-border">
        <h1 className="text-base font-semibold">Spool Tracker</h1>
        <p className="text-xs text-muted-foreground mt-0.5">耗材管理</p>
      </div>
      <div className="flex-1 py-2">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const isCatalog = tab.href === "/catalog";

          return (
            <div key={tab.href}>
              <Link
                href={tab.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {tab.icon(active)}
                <span>{tab.label}</span>
              </Link>

              {/* 品牌与材料的子导航 */}
              {isCatalog && active && (
                <div className="ml-6 mt-1 space-y-0.5">
                  <Link
                    href="/catalog"
                    className={`flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-sm transition-colors ${
                      pathname === "/catalog" || pathname.startsWith("/catalog/brand")
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                    </svg>
                    <span>品牌</span>
                  </Link>
                  <Link
                    href="/catalog/materials"
                    className={`flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-sm transition-colors ${
                      pathname === "/catalog/materials" || pathname.startsWith("/catalog/material/")
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                    <span>材料</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
