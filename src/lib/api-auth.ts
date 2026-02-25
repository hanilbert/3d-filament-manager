import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, verifyToken } from "./auth";

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
