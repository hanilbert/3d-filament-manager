import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { FILAMENT_OPTIONAL_FIELDS } from "@/lib/types";
import { findSharedBrandLogoUrl } from "@/lib/brand-logo";

const FLAT_SORT_FIELDS = [
  "brand",
  "material",
  "material_type",
  "color_name",
  "color_hex",
  "created_at",
] as const;

type FlatSortField = (typeof FLAT_SORT_FIELDS)[number];

function parseFlatSortField(value: string | null): FlatSortField {
  if (!value) return "created_at";
  return FLAT_SORT_FIELDS.includes(value as FlatSortField)
    ? (value as FlatSortField)
    : "created_at";
}

function parseSortOrder(value: string | null): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function getFlatListOrderBy(
  field: FlatSortField,
  order: Prisma.SortOrder
): Prisma.GlobalFilamentOrderByWithRelationInput {
  switch (field) {
    case "brand":
      return { brand: order };
    case "material":
      return { material: order };
    case "material_type":
      return { material_type: order };
    case "color_name":
      return { color_name: order };
    case "color_hex":
      return { color_hex: order };
    case "created_at":
    default:
      return { created_at: order };
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const brand = searchParams.get("brand") || "";
  const material = searchParams.get("material") || "";
  const materialType = searchParams.get("materialType") || "";
  const groupBy = searchParams.get("groupBy");
  const sortBy = parseFlatSortField(searchParams.get("sortBy"));
  const sortOrder = parseSortOrder(searchParams.get("sortOrder"));

  // 品牌列表模式（去重 brand + logo_url）
  if (groupBy === "brandList") {
    const items = await prisma.globalFilament.findMany({
      select: { brand: true, logo_url: true },
    });
    const map = new Map<string, string | null>();
    for (const item of items) {
      if (!map.has(item.brand)) {
        map.set(item.brand, item.logo_url);
      } else if (!map.get(item.brand) && item.logo_url) {
        map.set(item.brand, item.logo_url);
      }
    }
    const result = Array.from(map.entries()).map(([brand, logo_url]) => ({ brand, logo_url }));
    result.sort((a, b) => a.brand.localeCompare(b.brand));
    return NextResponse.json(result);
  }

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
    orderBy: getFlatListOrderBy(sortBy, sortOrder),
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { brand, color_name } = body;
    const material = body.material || "";

    if (!brand || !color_name) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const data: Record<string, string> = { brand, material, color_name };
    // material_type is required
    const materialType = body.material_type?.trim();
    if (!materialType || materialType === "__custom") {
      return NextResponse.json({ error: "缺少材料字段" }, { status: 400 });
    }
    data.material_type = materialType;
    for (const f of FILAMENT_OPTIONAL_FIELDS) {
      if (body[f]) data[f] = body[f];
    }

    if (!data.logo_url) {
      const sharedLogoUrl = await findSharedBrandLogoUrl(brand);
      if (sharedLogoUrl) data.logo_url = sharedLogoUrl;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = await prisma.globalFilament.create({ data: data as any });

    if (item.logo_url) {
      await prisma.globalFilament.updateMany({
        where: { brand: item.brand },
        data: { logo_url: item.logo_url },
      });
    }

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
