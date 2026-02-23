import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, verifyToken } from "./auth";

export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const token = extractBearerToken(
    request.headers.get("Authorization")
  );
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
