import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const spool = await prisma.spool.findUnique({
    where: { id },
    include: {
      globalFilament: true,
      location: true,
    },
  });

  if (!spool) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(spool);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();
    if (body.status !== undefined && !["ACTIVE", "EMPTY"].includes(body.status)) {
      return NextResponse.json({ error: "status 必须为 ACTIVE 或 EMPTY" }, { status: 400 });
    }
    const allowedFields = ["location_id", "status"];
    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) data[key] = body[key];
    }
    // Validate and handle metadata: allow clearing with null and enforce size on stored string
    if ("metadata" in body) {
      if (body.metadata === null) {
        data.metadata = null;
      } else {
        const metaString =
          typeof body.metadata === "string"
            ? body.metadata
            : JSON.stringify(body.metadata);
        if (metaString.length > 10000) {
          return NextResponse.json(
            { error: "metadata 不能超过 10KB" },
            { status: 400 }
          );
        }
        data.metadata = metaString;
      }
    }

    const spool = await prisma.spool.update({
      where: { id },
      data,
      include: {
        globalFilament: true,
        location: true,
      },
    });

    return NextResponse.json(spool);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  try {
    await prisma.spool.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
