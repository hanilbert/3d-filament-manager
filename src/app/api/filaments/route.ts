import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { FILAMENT_OPTIONAL_FIELDS } from "@/lib/types";
import { findSharedBrandLogoUrl } from "@/lib/brand-logo";
import { parseBodyUpcGtin, parseQueryUpcGtin } from "@/lib/upc-gtin";
import {
  buildTextSearchCondition,
  parseExactSearchParam,
} from "@/lib/filaments-query";

const FLAT_SORT_FIELDS = [
  "brand",
  "material",
  "variant",
  "color_name",
  "color_hex",
  "created_at",
] as const;

type FlatSortField = (typeof FLAT_SORT_FIELDS)[number];
type CatalogOptionalField = Exclude<(typeof FILAMENT_OPTIONAL_FIELDS)[number], "upc_gtin" | "material" | "variant">;
const MAX_QUERY_LENGTH = 120;

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
): Prisma.FilamentOrderByWithRelationInput {
  switch (field) {
    case "brand":
      return { brand: order };
    case "material":
      return { material: order };
    case "variant":
      return { variant: order };
    case "color_name":
      return { color_name: order };
    case "color_hex":
      return { color_hex: order };
    case "created_at":
    default:
      return { created_at: order };
  }
}

async function handleGroupByBrandList(): Promise<NextResponse> {
  const items = await prisma.filament.findMany({
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
  const result = Array.from(map.entries())
    .map(([brandName, logo_url]) => ({ brand: brandName, logo_url }))
    .sort((a, b) => a.brand.localeCompare(b.brand));
  return NextResponse.json(result);
}

async function handleGroupByBrand(): Promise<NextResponse> {
  const items = await prisma.filament.findMany({
    select: {
      brand: true,
      material: true,
      variant: true,
      logo_url: true,
      _count: { select: { spools: true } },
    },
  });

  const brandMap = new Map<string, {
    brand: string;
    logo_url?: string | null;
    count: number;
    materials: Set<string>;
    variants: Set<string>;
    spoolCount: number;
  }>();

  for (const item of items) {
    const existing = brandMap.get(item.brand);
    if (existing) {
      existing.count += 1;
      existing.materials.add(item.material);
      if (item.variant) existing.variants.add(item.variant);
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
        variants: item.variant ? new Set([item.variant]) : new Set(),
        spoolCount: item._count.spools,
      });
    }
  }

  const result = Array.from(brandMap.values())
    .map((b) => ({
      brand: b.brand,
      logo_url: b.logo_url,
      count: b.count,
      materials: Array.from(b.materials),
      variants: Array.from(b.variants),
      spoolCount: b.spoolCount,
    }))
    .sort((a, b) => b.count - a.count);
  return NextResponse.json(result);
}

async function handleGroupByMaterial(): Promise<NextResponse> {
  const items = await prisma.filament.findMany({
    select: {
      material: true,
      variant: true,
      brand: true,
      _count: { select: { spools: true } },
    },
  });

  const materialMap = new Map<string, {
    material: string;
    variants: Set<string>;
    brands: Set<string>;
    count: number;
    spoolCount: number;
  }>();

  for (const item of items) {
    const existing = materialMap.get(item.material);
    if (existing) {
      existing.count += 1;
      if (item.variant) existing.variants.add(item.variant);
      existing.brands.add(item.brand);
      existing.spoolCount += item._count.spools;
    } else {
      materialMap.set(item.material, {
        material: item.material,
        variants: item.variant ? new Set([item.variant]) : new Set(),
        brands: new Set([item.brand]),
        count: 1,
        spoolCount: item._count.spools,
      });
    }
  }

  const result = Array.from(materialMap.values())
    .map((m) => ({
      material: m.material,
      variantCount: m.variants.size,
      brandCount: m.brands.size,
      count: m.count,
      spoolCount: m.spoolCount,
    }))
    .sort((a, b) => b.count - a.count);
  return NextResponse.json(result);
}

async function handleGroupByVariant(material: string): Promise<NextResponse> {
  const items = await prisma.filament.findMany({
    where: { material },
    select: {
      variant: true,
      brand: true,
      _count: { select: { spools: true } },
    },
  });

  const variantMap = new Map<string, {
    variant: string;
    brands: Set<string>;
    colorCount: number;
    spoolCount: number;
  }>();

  for (const item of items) {
    const key = item.variant || "";
    const existing = variantMap.get(key);
    if (existing) {
      existing.colorCount += 1;
      existing.brands.add(item.brand);
      existing.spoolCount += item._count.spools;
    } else {
      variantMap.set(key, {
        variant: key,
        brands: new Set([item.brand]),
        colorCount: 1,
        spoolCount: item._count.spools,
      });
    }
  }

  const result = Array.from(variantMap.values())
    .map((m) => ({
      variant: m.variant,
      brandCount: m.brands.size,
      colorCount: m.colorCount,
      spoolCount: m.spoolCount,
    }))
    .sort((a, b) => b.colorCount - a.colorCount);
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const brand = searchParams.get("brand") || "";
  const material = searchParams.get("material") || "";
  const variant = searchParams.get("variant") || "";
  const upcGtin = parseQueryUpcGtin(searchParams.get("upc_gtin"));
  const groupBy = searchParams.get("groupBy");
  const sortBy = parseFlatSortField(searchParams.get("sortBy"));
  const sortOrder = parseSortOrder(searchParams.get("sortOrder"));
  const exact = parseExactSearchParam(searchParams.get("exact"));
  const brandFilter = buildTextSearchCondition(brand, exact);
  const materialFilter = buildTextSearchCondition(material, exact);
  const variantFilter = buildTextSearchCondition(variant, exact);

  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "q 参数过长" }, { status: 400 });
  }

  if (upcGtin.error) {
    return NextResponse.json({ error: upcGtin.error }, { status: 400 });
  }

  if (groupBy === "brandList") return handleGroupByBrandList();
  if (groupBy === "brand") return handleGroupByBrand();
  if (groupBy === "material") return handleGroupByMaterial();

  if (groupBy === "materialType") {
    const rows = await prisma.filament.groupBy({
      by: ["variant"],
      _count: { _all: true },
    });

    const materialTypes = rows
      .map((row) => ({
        materialType: row.variant.trim(),
        count: row._count._all,
      }))
      .sort((a, b) => a.materialType.localeCompare(b.materialType));

    return NextResponse.json(materialTypes);
  }

  if (groupBy === "variant") {
    const normalizedMaterial = material.trim();
    if (!normalizedMaterial) {
      return NextResponse.json({ error: "material parameter required" }, { status: 400 });
    }
    return handleGroupByVariant(normalizedMaterial);
  }

  const items = await prisma.filament.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { brand: { contains: q } },
                { material: { contains: q } },
                { variant: { contains: q } },
                { color_name: { contains: q } },
              ],
            }
          : {},
        brandFilter ? { brand: brandFilter } : {},
        materialFilter ? { material: materialFilter } : {},
        variantFilter ? { variant: variantFilter } : {},
        upcGtin.provided ? { upc_gtin: upcGtin.normalized } : {},
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
    const brand = body.brand?.trim();
    const color_name = body.color_name?.trim();
    const material = body.material?.trim();
    const variant = body.variant?.trim() || "";

    if (!brand || !color_name || !material) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const data: Prisma.FilamentCreateInput = { brand, material, variant, color_name };

    const upcGtin = parseBodyUpcGtin(body.upc_gtin);
    if (upcGtin.error) {
      return NextResponse.json({ error: upcGtin.error }, { status: 400 });
    }
    if (upcGtin.provided) {
      data.upc_gtin = upcGtin.normalized;
    }

    for (const f of FILAMENT_OPTIONAL_FIELDS) {
      const value = body[f];
      if (typeof value === "string" && value) {
        data[f as CatalogOptionalField] = value;
      }
    }

    if (!data.logo_url) {
      const sharedLogoUrl = await findSharedBrandLogoUrl(brand);
      if (sharedLogoUrl) data.logo_url = sharedLogoUrl;
    }

    const item = await prisma.filament.create({ data });

    if (item.logo_url) {
      await prisma.filament.updateMany({
        where: { brand: item.brand },
        data: { logo_url: item.logo_url },
      });
    }

    return NextResponse.json(item, { status: 201 });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({ error: "UPC/GTIN 已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
