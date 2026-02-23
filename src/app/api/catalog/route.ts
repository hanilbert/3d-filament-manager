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
  const groupBy = searchParams.get("groupBy");

  // 品牌分组模式
  if (groupBy === "brand") {
    const items = await prisma.globalFilament.findMany({
      select: {
        brand: true,
        material: true,
        logo_url: true,
        _count: { select: { spools: true } },
      },
    });

    // 按品牌聚合
    const brandMap = new Map<string, {
      brand: string;
      logo_url?: string | null;
      count: number;
      materials: Set<string>;
      spoolCount: number;
    }>();

    for (const item of items) {
      const existing = brandMap.get(item.brand);
      if (existing) {
        existing.count += 1;
        existing.materials.add(item.material);
        existing.spoolCount += item._count.spools;
        if (!existing.logo_url && item.logo_url) {
          existing.logo_url = item.logo_url;
        }
      } else {
        brandMap.set(item.brand, {
          brand: item.brand,
          logo_url: item.logo_url,
          count: 1,
          materials: new Set([item.material]),
          spoolCount: item._count.spools,
        });
      }
    }

    const result = Array.from(brandMap.values()).map((b) => ({
      brand: b.brand,
      logo_url: b.logo_url,
      count: b.count,
      materials: Array.from(b.materials),
      spoolCount: b.spoolCount,
    }));

    result.sort((a, b) => b.count - a.count);
    return NextResponse.json(result);
  }

  // 材料分组模式
  if (groupBy === "material") {
    const items = await prisma.globalFilament.findMany({
      select: {
        material: true,
        brand: true,
        _count: { select: { spools: true } },
      },
    });

    const materialMap = new Map<string, {
      material: string;
      count: number;
      brands: Set<string>;
      spoolCount: number;
    }>();

    for (const item of items) {
      const existing = materialMap.get(item.material);
      if (existing) {
        existing.count += 1;
        existing.brands.add(item.brand);
        existing.spoolCount += item._count.spools;
      } else {
        materialMap.set(item.material, {
          material: item.material,
          count: 1,
          brands: new Set([item.brand]),
          spoolCount: item._count.spools,
        });
      }
    }

    const result = Array.from(materialMap.values()).map((m) => ({
      material: m.material,
      count: m.count,
      brands: Array.from(m.brands),
      spoolCount: m.spoolCount,
    }));

    result.sort((a, b) => b.count - a.count);
    return NextResponse.json(result);
  }

  // 扁平列表模式（现有行为）
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
    const { brand, material, color_name } = body;

    if (!brand || !material || !color_name) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const optionalFields = [
      "color_hex", "nozzle_temp", "bed_temp", "print_speed", "logo_url",
      "density", "diameter", "nominal_weight", "softening_temp", "chamber_temp",
      "ironing_flow", "ironing_speed", "shrinkage", "empty_spool_weight", "pressure_advance",
      "fan_min", "fan_max",
      "first_layer_walls", "first_layer_infill", "first_layer_outer_wall", "first_layer_top_surface",
      "other_layers_walls", "other_layers_infill", "other_layers_outer_wall", "other_layers_top_surface",
      "measured_rgb", "top_voted_td", "num_td_votes",
      "max_volumetric_speed", "flow_ratio",
      "drying_temp", "dry_time",
      "ams_compatibility", "build_plates",
    ] as const;

    const data: Record<string, string> = { brand, material, color_name };
    for (const f of optionalFields) {
      if (body[f]) data[f] = body[f];
    }

    const item = await prisma.globalFilament.create({ data });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
