import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const spools = await prisma.spool.findMany({
    where: status ? { status } : {},
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
      location: { select: { id: true, name: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(spools);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const { global_filament_id } = await request.json();

    if (!global_filament_id) {
      return NextResponse.json({ error: "缺少 global_filament_id" }, { status: 400 });
    }

    const exists = await prisma.globalFilament.findUnique({
      where: { id: global_filament_id },
    });
    if (!exists) {
      return NextResponse.json({ error: "耗材字典不存在" }, { status: 404 });
    }

    const spool = await prisma.spool.create({
      data: { global_filament_id, status: "ACTIVE" },
      include: {
        globalFilament: true,
        location: true,
      },
    });

    return NextResponse.json(spool, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
