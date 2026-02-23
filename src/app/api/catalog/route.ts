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
  const materialType = searchParams.get("materialType") || "";
  const groupBy = searchParams.get("groupBy");

  // 品牌分组模式
  if (groupBy === "brand") {
    const items = await prisma.globalFilament.findMany({
      select: {
        brand: true,
        material: true,
        material_type: true,
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
      materialTypes: Set<string>;
      spoolCount: number;
    }>();

    for (const item of items) {
      const existing = brandMap.get(item.brand);
      if (existing) {
        existing.count += 1;
        existing.materials.add(item.material);
        existing.materialTypes.add(item.material_type || item.material.split(" ")[0]);
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
          materialTypes: new Set([item.material_type || item.material.split(" ")[0]]),
          spoolCount: item._count.spools,
        });
      }
    }

    const result = Array.from(brandMap.values()).map((b) => ({
      brand: b.brand,
      logo_url: b.logo_url,
      count: b.count,
      materials: Array.from(b.materials),
      materialTypes: Array.from(b.materialTypes),
      spoolCount: b.spoolCount,
    }));

    result.sort((a, b) => b.count - a.count);
    return NextResponse.json(result);
  }

  // 材料大类分组模式（按 material_type）
  if (groupBy === "material") {
    const items = await prisma.globalFilament.findMany({
      select: {
        material: true,
        material_type: true,
        brand: true,
        _count: { select: { spools: true } },
      },
    });

    const typeMap = new Map<string, {
      material_type: string;
      subMaterials: Set<string>;
      brands: Set<string>;
      count: number;
      spoolCount: number;
    }>();

    for (const item of items) {
      const mt = item.material_type || item.material.split(" ")[0];
      const existing = typeMap.get(mt);
      if (existing) {
        existing.count += 1;
        existing.subMaterials.add(item.material);
        existing.brands.add(item.brand);
        existing.spoolCount += item._count.spools;
      } else {
        typeMap.set(mt, {
          material_type: mt,
          subMaterials: new Set([item.material]),
          brands: new Set([item.brand]),
          count: 1,
          spoolCount: item._count.spools,
        });
      }
    }

    const result = Array.from(typeMap.values()).map((m) => ({
      material_type: m.material_type,
      subMaterialCount: m.subMaterials.size,
      brandCount: m.brands.size,
      count: m.count,
      spoolCount: m.spoolCount,
    }));

    result.sort((a, b) => b.count - a.count);
    return NextResponse.json(result);
  }

  // 某大类下的子材料列表
  if (groupBy === "materialType") {
    if (!materialType) {
      return NextResponse.json({ error: "materialType parameter required" }, { status: 400 });
    }

    const items = await prisma.globalFilament.findMany({
      where: { material_type: materialType },
      select: {
        material: true,
        brand: true,
        _count: { select: { spools: true } },
      },
    });

    const materialMap = new Map<string, {
      material: string;
      brands: Set<string>;
      colorCount: number;
      spoolCount: number;
    }>();

    for (const item of items) {
      const existing = materialMap.get(item.material);
      if (existing) {
        existing.colorCount += 1;
        existing.brands.add(item.brand);
        existing.spoolCount += item._count.spools;
      } else {
        materialMap.set(item.material, {
          material: item.material,
          brands: new Set([item.brand]),
          colorCount: 1,
          spoolCount: item._count.spools,
        });
      }
    }

    const result = Array.from(materialMap.values()).map((m) => ({
      material: m.material,
      brandCount: m.brands.size,
      colorCount: m.colorCount,
      spoolCount: m.spoolCount,
    }));

    result.sort((a, b) => b.colorCount - a.colorCount);
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
        materialType ? { material_type: materialType } : {},
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
    const { brand, color_name } = body;
    const material = body.material || "";

    if (!brand || !color_name) {
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
    // material_type is required
    const materialType = body.material_type?.trim();
    if (!materialType || materialType === "__custom") {
      return NextResponse.json({ error: "缺少材料字段" }, { status: 400 });
    }
    data.material_type = materialType;
    for (const f of optionalFields) {
      if (body[f]) data[f] = body[f];
    }

    const item = await prisma.globalFilament.create({
      data: {
        brand: data.brand,
        material: data.material,
        material_type: data.material_type,
        color_name: data.color_name,
        color_hex: data.color_hex,
        nozzle_temp: data.nozzle_temp,
        bed_temp: data.bed_temp,
        print_speed: data.print_speed,
        logo_url: data.logo_url,
        density: data.density,
        diameter: data.diameter,
        nominal_weight: data.nominal_weight,
        softening_temp: data.softening_temp,
        chamber_temp: data.chamber_temp,
        ironing_flow: data.ironing_flow,
        ironing_speed: data.ironing_speed,
        shrinkage: data.shrinkage,
        empty_spool_weight: data.empty_spool_weight,
        pressure_advance: data.pressure_advance,
        fan_min: data.fan_min,
        fan_max: data.fan_max,
        first_layer_walls: data.first_layer_walls,
        first_layer_infill: data.first_layer_infill,
        first_layer_outer_wall: data.first_layer_outer_wall,
        first_layer_top_surface: data.first_layer_top_surface,
        other_layers_walls: data.other_layers_walls,
        other_layers_infill: data.other_layers_infill,
        other_layers_outer_wall: data.other_layers_outer_wall,
        other_layers_top_surface: data.other_layers_top_surface,
        measured_rgb: data.measured_rgb,
        top_voted_td: data.top_voted_td,
        num_td_votes: data.num_td_votes,
        max_volumetric_speed: data.max_volumetric_speed,
        flow_ratio: data.flow_ratio,
        drying_temp: data.drying_temp,
        dry_time: data.dry_time,
        ams_compatibility: data.ams_compatibility,
        build_plates: data.build_plates,
      }
    });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
