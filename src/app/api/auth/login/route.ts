import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { generateToken, TOKEN_TTL } from "@/lib/auth";

// --- Rate limiting (in-memory, per-process) ---
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;
const MAX_BODY_SIZE_BYTES = 10 * 1024;
const MAX_PASSWORD_LENGTH = 256;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Clean up stale entries periodically (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(ip);
  }
}, 5 * 60 * 1000).unref?.();

// --- Handler ---

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "登录尝试过于频繁，请 15 分钟后再试" },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_SIZE_BYTES) {
      return NextResponse.json({ error: "请求体过大" }, { status: 413 });
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const password = (body as { password?: unknown }).password;
    if (typeof password !== "string" || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    const expected = process.env.APP_PASSWORD;
    if (!expected) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[api/auth/login] APP_PASSWORD is not configured");
      }
      return NextResponse.json({ error: "服务端未完成配置" }, { status: 503 });
    }

    if (
      !safeEqual(password, expected)
    ) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_TTL;
    const maxAge = Math.floor(TOKEN_TTL / 1000);

    // Set HttpOnly cookie server-side (S-H2)
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const cookie = `spool_tracker_token=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;

    return NextResponse.json(
      { expiresAt },
      { headers: { "Set-Cookie": cookie } }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[api/auth/login] failed to parse request", error);
    }
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to keep constant time, then return false
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
