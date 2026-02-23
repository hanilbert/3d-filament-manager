"use client";

import { usePathname } from "next/navigation";
import { SideNav } from "./SideNav";

export function ConditionalSideNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.endsWith("/print")) return null;
  return <SideNav />;
}
