import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const locations = await prisma.location.findMany({
    include: {
      _count: {
        select: { spools: { where: { status: "ACTIVE" } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(locations);
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, type = "custom", short_code, is_default, printer_name, ams_unit, ams_slot } = body;

    if (!name || !name.trim()) {
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

    const location = await prisma.$transaction(async (tx) => {
      // 如果设为默认，先取消其他默认
      if (is_default) {
        await tx.location.updateMany({
          where: { is_default: true },
          data: { is_default: false },
        });
      }

      return tx.location.create({
        data: {
          name: name.trim(),
          type,
          short_code: short_code?.trim() || undefined,
          is_default: is_default ?? false,
          printer_name: printer_name?.trim() || undefined,
          ams_unit: ams_unit?.trim() || undefined,
          ams_slot: ams_slot?.trim() || undefined,
        },
      });
    });

    return NextResponse.json(location, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
