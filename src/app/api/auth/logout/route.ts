import { NextResponse } from "next/server";

export async function POST() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return NextResponse.json(
    { success: true },
    {
      headers: {
        "Set-Cookie": `spool_tracker_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
      },
    }
  );
}
