import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
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
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();
    const item = await prisma.globalFilament.update({
      where: { id },
      data: body,
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
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const spoolCount = await prisma.spool.count({
    where: { global_filament_id: id },
  });

  if (spoolCount > 0) {
    return NextResponse.json(
      { error: `该字典关联了 ${spoolCount} 卷耗材，无法删除` },
      { status: 400 }
    );
  }

  await prisma.globalFilament.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
