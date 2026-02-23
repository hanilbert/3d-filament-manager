import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: true },
    {
      headers: {
        "Set-Cookie":
          "spool_tracker_token=; path=/; max-age=0; SameSite=Lax",
      },
    }
  );
}
