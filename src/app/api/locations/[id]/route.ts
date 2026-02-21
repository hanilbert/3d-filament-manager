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
  const location = await prisma.location.findUnique({
    where: { id },
    include: {
      spools: {
        where: { status: "ACTIVE" },
        include: {
          globalFilament: {
            select: {
              brand: true,
              material: true,
              color_name: true,
              color_hex: true,
              logo_url: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!location) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(location);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "位置名称不能为空" }, { status: 400 });
    }

    const location = await prisma.location.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(location);
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
  // 解绑该位置下所有料卷，设 location_id 为 null
  await prisma.spool.updateMany({
    where: { location_id: id },
    data: { location_id: null },
  });

  await prisma.location.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
