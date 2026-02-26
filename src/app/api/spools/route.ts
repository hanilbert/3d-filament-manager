import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { repairOrphanSpoolFilaments } from "@/lib/data-repair";

const SPOOL_SORT_FIELDS = [
  "brand",
  "material",
  "variant",
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
      return { filament: { brand: order } };
    case "material":
      return { filament: { material: order } };
    case "variant":
      return { filament: { variant: order } };
    case "color_name":
      return { filament: { color_name: order } };
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
  await repairOrphanSpoolFilaments();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const sortBy = parseSortField(searchParams.get("sortBy"));
  const sortOrder = parseSortOrder(searchParams.get("sortOrder"));

  const spools = await prisma.spool.findMany({
    where: status ? { status: status as "ACTIVE" | "EMPTY" } : {},
    include: {
      filament: {
        select: {
          id: true,
          brand: true,
          material: true,
          variant: true,
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
    const { filament_id } = await request.json();

    if (!filament_id) {
      return NextResponse.json({ error: "缺少 filament_id" }, { status: 400 });
    }

    const exists = await prisma.filament.findUnique({
      where: { id: filament_id },
    });
    if (!exists) {
      return NextResponse.json({ error: "耗材不存在" }, { status: 404 });
    }

    const spool = await prisma.spool.create({
      data: { filament_id, status: "ACTIVE" },
      include: {
        filament: true,
        location: true,
      },
    });

    return NextResponse.json(spool, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
