import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

const SPOOL_SORT_FIELDS = [
  "brand",
  "material",
  "material_type",
  "color_name",
  "status",
  "created_at",
  "updated_at",
] as const;

type SpoolSortField = (typeof SPOOL_SORT_FIELDS)[number];

function parseSortField(value: string | null): SpoolSortField {
  if (!value) return "created_at";
  return SPOOL_SORT_FIELDS.includes(value as SpoolSortField)
    ? (value as SpoolSortField)
    : "created_at";
}

function parseSortOrder(value: string | null): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function getSpoolOrderBy(
  field: SpoolSortField,
  order: Prisma.SortOrder
): Prisma.SpoolOrderByWithRelationInput {
  switch (field) {
    case "brand":
      return { globalFilament: { brand: order } };
    case "material":
      return { globalFilament: { material: order } };
    case "material_type":
      return { globalFilament: { material_type: order } };
    case "color_name":
      return { globalFilament: { color_name: order } };
    case "status":
      return { status: order };
    case "created_at":
      return { created_at: order };
    case "updated_at":
      return { updated_at: order };
    default:
      return { created_at: order };
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const sortBy = parseSortField(searchParams.get("sortBy"));
  const sortOrder = parseSortOrder(searchParams.get("sortOrder"));

  const spools = await prisma.spool.findMany({
    where: status ? { status } : {},
    include: {
      globalFilament: {
        select: {
          brand: true,
          material: true,
          material_type: true,
          color_name: true,
          color_hex: true,
          logo_url: true,
        },
      },
      location: { select: { id: true, name: true } },
    },
    orderBy: getSpoolOrderBy(sortBy, sortOrder),
  });

  return NextResponse.json(spools);
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
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
