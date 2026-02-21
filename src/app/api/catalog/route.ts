import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const brand = searchParams.get("brand") || "";
  const material = searchParams.get("material") || "";

  const items = await prisma.globalFilament.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { brand: { contains: q } },
                { material: { contains: q } },
                { color_name: { contains: q } },
              ],
            }
          : {},
        brand ? { brand: { contains: brand } } : {},
        material ? { material: { contains: material } } : {},
      ],
    },
    include: {
      _count: { select: { spools: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { brand, material, color_name, color_hex, nozzle_temp, bed_temp, print_speed, logo_url } = body;

    if (!brand || !material || !color_name || !nozzle_temp || !bed_temp || !print_speed) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const item = await prisma.globalFilament.create({
      data: { brand, material, color_name, color_hex, nozzle_temp, bed_temp, print_speed, logo_url },
    });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
