import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ensureOrphanSpoolFilamentsRepaired } from "@/lib/data-repair";

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
type SpoolStatus = "ACTIVE" | "EMPTY";
const SPOOL_STATUS_SET = new Set<SpoolStatus>(["ACTIVE", "EMPTY"]);

function logApiError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error(`[api/spools] ${context}`, error);
  }
}

function parseSortField(value: string | null): SpoolSortField {
  if (!value) return "created_at";
  return SPOOL_SORT_FIELDS.includes(value as SpoolSortField)
    ? (value as SpoolSortField)
    : "created_at";
}

function parseSortOrder(value: string | null): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function parseSpoolStatus(value: string | null): SpoolStatus | null | "invalid" {
  if (!value) return null;
  if (SPOOL_STATUS_SET.has(value as SpoolStatus)) {
    return value as SpoolStatus;
  }
  return "invalid";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  await ensureOrphanSpoolFilamentsRepaired().catch((error) => {
    logApiError("orphan repair skipped after failure", error);
    return 0;
  });

  const { searchParams } = new URL(request.url);
  const status = parseSpoolStatus(searchParams.get("status"));
  if (status === "invalid") {
    return NextResponse.json({ error: "status 必须为 ACTIVE 或 EMPTY" }, { status: 400 });
  }
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
    const body = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const filamentId =
      typeof body.filament_id === "string" ? body.filament_id.trim() : "";

    if (!filamentId) {
      return NextResponse.json({ error: "缺少 filament_id" }, { status: 400 });
    }

    const exists = await prisma.filament.findUnique({
      where: { id: filamentId },
    });
    if (!exists) {
      return NextResponse.json({ error: "耗材不存在" }, { status: 404 });
    }

    const spool = await prisma.spool.create({
      data: { filament_id: filamentId, status: "ACTIVE" },
      include: {
        filament: true,
        location: true,
      },
    });

    return NextResponse.json(spool, { status: 201 });
  } catch (error: unknown) {
    logApiError("POST failed", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
