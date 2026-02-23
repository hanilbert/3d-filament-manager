import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/logos"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 放行公开路径和静态资源
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // 从 Cookie 中读取 token 并验证签名 + 过期时间
  const token = request.cookies.get("spool_tracker_token")?.value;

  if (!token || !(await verifyToken(token))) {
    // API 路由返回 401 JSON，页面路由跳转登录页
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
