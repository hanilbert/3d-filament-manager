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
  const location = await prisma.location.findUnique({
    where: { id },
    include: {
      spools: {
        where: { status: "ACTIVE" },
        include: {
          filament: {
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
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();
    const { name, type, is_default, printer_name, ams_unit, ams_slot } = body;

    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: "位置名称不能为空" }, { status: 400 });
    }

    // AMS Slot 类型校验
    if (type === "ams_slot") {
      if (!printer_name || !ams_unit || !ams_slot) {
        return NextResponse.json(
          { error: "AMS 插槽类型需要填写打印机名称、AMS 单元和插槽号" },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (type !== undefined) data.type = type;
    if (is_default !== undefined) data.is_default = is_default;
    if (printer_name !== undefined) data.printer_name = printer_name?.trim() || null;
    if (ams_unit !== undefined) data.ams_unit = ams_unit?.trim() || null;
    if (ams_slot !== undefined) data.ams_slot = ams_slot?.trim() || null;

    const location = await prisma.$transaction(async (tx) => {
      // 如果设为默认，先取消其他默认
      if (is_default) {
        await tx.location.updateMany({
          where: { is_default: true, id: { not: id } },
          data: { is_default: false },
        });
      }

      return tx.location.update({
        where: { id },
        data,
      });
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
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.spool.updateMany({
        where: { location_id: id },
        data: { location_id: null },
      });

      await tx.location.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2025") {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
