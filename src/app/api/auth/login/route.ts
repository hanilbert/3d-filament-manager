import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { generateToken, TOKEN_TTL } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const expected = process.env.APP_PASSWORD ?? "";

    if (
      !password ||
      !expected ||
      !safeEqual(String(password), expected)
    ) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_TTL;

    return NextResponse.json({ token, expiresAt });
  } catch {
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
