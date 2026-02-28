import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseQueryUpcGtin } from "@/lib/upc-gtin";
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
const MAX_QUERY_LENGTH = 120;

function toNumber(value: number | bigint | null): number {
  if (typeof value === "bigint") return Number(value);
  return value ?? 0;
}

function parseCsvList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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
  const rows = await prisma.$queryRaw<Array<{ brand: string; logo_url: string | null }>>`
    SELECT
      f.brand AS brand,
      (
        SELECT f2.logo_url
        FROM "Filament" f2
        WHERE f2.brand = f.brand
          AND f2.logo_url IS NOT NULL
        ORDER BY f2.updated_at DESC
        LIMIT 1
      ) AS logo_url
    FROM "Filament" f
    GROUP BY f.brand
    ORDER BY f.brand ASC
  `;

  return NextResponse.json(
    rows.map((row) => ({
      brand: row.brand,
      logo_url: row.logo_url,
    }))
  );
}

async function handleGroupByBrand(): Promise<NextResponse> {
  const rows = await prisma.$queryRaw<Array<{
    brand: string;
    logo_url: string | null;
    count: number | bigint;
    materials_csv: string | null;
    variants_csv: string | null;
    spool_count: number | bigint | null;
  }>>`
    SELECT
      f.brand AS brand,
      COUNT(*) AS count,
      GROUP_CONCAT(DISTINCT f.material) AS materials_csv,
      GROUP_CONCAT(DISTINCT NULLIF(TRIM(f.variant), '')) AS variants_csv,
      COALESCE(SUM(sc.spool_count), 0) AS spool_count,
      (
        SELECT f2.logo_url
        FROM "Filament" f2
        WHERE f2.brand = f.brand
          AND f2.logo_url IS NOT NULL
        ORDER BY f2.updated_at DESC
        LIMIT 1
      ) AS logo_url
    FROM "Filament" f
    LEFT JOIN (
      SELECT s.filament_id AS filament_id, COUNT(*) AS spool_count
      FROM "Spool" s
      GROUP BY s.filament_id
    ) sc ON sc.filament_id = f.id
    GROUP BY f.brand
    ORDER BY count DESC, f.brand ASC
  `;

  return NextResponse.json(
    rows.map((row) => ({
      brand: row.brand,
      logo_url: row.logo_url,
      count: toNumber(row.count),
      materials: parseCsvList(row.materials_csv),
      variants: parseCsvList(row.variants_csv),
      spoolCount: toNumber(row.spool_count),
    }))
  );
}

async function handleGroupByMaterial(): Promise<NextResponse> {
  const rows = await prisma.$queryRaw<Array<{
    material: string;
    count: number | bigint;
    variant_count: number | bigint;
    brand_count: number | bigint;
    spool_count: number | bigint | null;
  }>>`
    SELECT
      f.material AS material,
      COUNT(*) AS count,
      COUNT(DISTINCT NULLIF(TRIM(f.variant), '')) AS variant_count,
      COUNT(DISTINCT f.brand) AS brand_count,
      COALESCE(SUM(sc.spool_count), 0) AS spool_count
    FROM "Filament" f
    LEFT JOIN (
      SELECT s.filament_id AS filament_id, COUNT(*) AS spool_count
      FROM "Spool" s
      GROUP BY s.filament_id
    ) sc ON sc.filament_id = f.id
    GROUP BY f.material
    ORDER BY count DESC, f.material ASC
  `;

  return NextResponse.json(
    rows.map((row) => ({
      material: row.material,
      variantCount: toNumber(row.variant_count),
      brandCount: toNumber(row.brand_count),
      count: toNumber(row.count),
      spoolCount: toNumber(row.spool_count),
    }))
  );
}

async function handleGroupByVariant(material: string): Promise<NextResponse> {
  const rows = await prisma.$queryRaw<Array<{
    variant: string;
    brand_count: number | bigint;
    color_count: number | bigint;
    spool_count: number | bigint | null;
  }>>`
    SELECT
      COALESCE(f.variant, '') AS variant,
      COUNT(DISTINCT f.brand) AS brand_count,
      COUNT(*) AS color_count,
      COALESCE(SUM(sc.spool_count), 0) AS spool_count
    FROM "Filament" f
    LEFT JOIN (
      SELECT s.filament_id AS filament_id, COUNT(*) AS spool_count
      FROM "Spool" s
      GROUP BY s.filament_id
    ) sc ON sc.filament_id = f.id
    WHERE f.material = ${material}
    GROUP BY COALESCE(f.variant, '')
    ORDER BY color_count DESC, variant ASC
  `;

  return NextResponse.json(
    rows.map((row) => ({
      variant: row.variant,
      brandCount: toNumber(row.brand_count),
      colorCount: toNumber(row.color_count),
      spoolCount: toNumber(row.spool_count),
    }))
  );
}

export async function queryFilaments(searchParams: URLSearchParams): Promise<NextResponse> {
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
    const rows = await prisma.$queryRaw<Array<{ material_type: string; count: number | bigint }>>`
      SELECT
        TRIM(COALESCE(f.variant, '')) AS material_type,
        COUNT(*) AS count
      FROM "Filament" f
      GROUP BY TRIM(COALESCE(f.variant, ''))
      ORDER BY material_type ASC
    `;

    return NextResponse.json(
      rows.map((row) => ({
        materialType: row.material_type,
        count: toNumber(row.count),
      }))
    );
  }

  if (groupBy === "variant") {
    const normalizedMaterial = material.trim();
    if (!normalizedMaterial) {
      return NextResponse.json(
        { error: "material parameter required" },
        { status: 400 }
      );
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
