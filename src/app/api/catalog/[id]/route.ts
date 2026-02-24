import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { FILAMENT_ALLOWED_FIELDS } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const item = await prisma.globalFilament.findUnique({
    where: { id },
    include: {
      spools: {
        where: { status: "ACTIVE" },
        include: { location: true },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(item);
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

    const data: Record<string, string | null> = {};
    for (const f of FILAMENT_ALLOWED_FIELDS) {
      if (f in body) data[f] = body[f] || null;
    }

    const item = await prisma.globalFilament.update({
      where: { id },
      data,
    });
    return NextResponse.json(item);
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
    await prisma.globalFilament.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    // P2003 = FK constraint (spools reference this filament)
    if (code === "P2003") {
      return NextResponse.json(
        { error: "该耗材关联了料卷，无法删除" },
        { status: 400 }
      );
    }
    // P2025 = record not found
    if (code === "P2025") {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
