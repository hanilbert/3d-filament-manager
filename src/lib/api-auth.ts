import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, verifyToken } from "./auth";

/**
 * API 路由认证中间件
 * 验证请求是否携带有效的认证 Token
 *
 * 支持两种认证方式（按优先级）：
 * 1. Authorization 请求头中的 Bearer Token（用于 API 客户端）
 * 2. HttpOnly Cookie 中的 Token（用于浏览器）
 *
 * @param request - Next.js 请求对象
 * @returns 如果认证失败返回 401 响应，认证成功返回 null
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authError = await requireAuth(request);
 *   if (authError) return authError;
 *   // 继续处理已认证的请求
 * }
 * ```
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  // Check Bearer header first, then fall back to HttpOnly cookie
  const bearerToken = extractBearerToken(request.headers.get("Authorization"));
  const cookieToken = request.cookies.get("spool_tracker_token")?.value;
  const token = bearerToken || cookieToken;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
