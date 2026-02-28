import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { generateToken, TOKEN_TTL } from "@/lib/auth";
import { loginBodySchema } from "@/lib/api-schemas";
import { readJsonWithLimit } from "@/lib/http";
import { FixedWindowRateLimiter, normalizeClientIp } from "@/lib/rate-limit";

// --- Rate limiting (in-memory, per-process) ---
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;
const MAX_BODY_SIZE_BYTES = 10 * 1024;
const loginRateLimiter = new FixedWindowRateLimiter({
  windowMs: LOGIN_WINDOW_MS,
  maxAttempts: MAX_ATTEMPTS,
  maxKeys: 20_000,
});

// --- Handler ---

export async function POST(request: NextRequest) {
  const ip = normalizeClientIp(request.headers);
  const rateLimitResult = loginRateLimiter.hit(ip);
  if (rateLimitResult.limited) {
    return NextResponse.json(
      { error: "登录尝试过于频繁，请 15 分钟后再试" },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  const bodyResult = await readJsonWithLimit<unknown>(request, {
    maxBytes: MAX_BODY_SIZE_BYTES,
  });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const parsed = loginBodySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[api/auth/login] APP_PASSWORD is not configured");
    }
    return NextResponse.json({ error: "服务端未完成配置" }, { status: 503 });
  }

  if (!safeEqual(parsed.data.password, expected)) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const token = generateToken();
  const expiresAt = Date.now() + TOKEN_TTL;
  const maxAge = Math.floor(TOKEN_TTL / 1000);

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookie = `spool_tracker_token=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;

  return NextResponse.json(
    { expiresAt },
    { headers: { "Set-Cookie": cookie } }
  );
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
