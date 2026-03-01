import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/logos"];
const AUTH_VERIFIED_HEADER = "x-auth-verified";
const AUTH_COOKIE_NAME = "spool_tracker_token";

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

  // 防止外部伪造内部鉴权标记
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(AUTH_VERIFIED_HEADER);

  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const bearerToken = extractBearerToken(request.headers.get("Authorization"));

  // API 客户端使用 Bearer Token：跳过 middleware 验证，交由 requireAuth 处理
  if (!cookieToken && pathname.startsWith("/api/") && bearerToken) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!cookieToken || !(await verifyToken(cookieToken))) {
    // API 路由返回 401 JSON，页面路由跳转登录页
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    // Only pass relative paths to prevent open redirect (S-M1)
    if (pathname.startsWith("/") && !pathname.startsWith("//")) {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Cookie 已在 middleware 验证通过，标记请求以便 requireAuth 跳过重复验证
  if (pathname.startsWith("/api/")) {
    requestHeaders.set(AUTH_VERIFIED_HEADER, "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
