"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

export function ConditionalNav() {
  const pathname = usePathname();
  const hideNav = pathname === "/login" || pathname.endsWith("/print");
  if (hideNav) return null;
  return <BottomNav />;
}
