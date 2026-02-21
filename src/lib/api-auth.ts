import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, verifyToken } from "./auth";

export function requireAuth(request: NextRequest): NextResponse | null {
  const token = extractBearerToken(
    request.headers.get("Authorization")
  );
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
