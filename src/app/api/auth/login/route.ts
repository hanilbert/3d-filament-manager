import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password || password !== process.env.APP_PASSWORD) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    const token = generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    return NextResponse.json({ token, expiresAt });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}
