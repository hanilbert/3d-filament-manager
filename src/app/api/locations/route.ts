import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { isLocationType } from "@/lib/location-types";
import { locationCreateSchema } from "@/lib/api-schemas";
import { readJsonWithLimit } from "@/lib/http";

const MAX_JSON_BODY_BYTES = 64 * 1024;
const DEFAULT_SPOOL_LIMIT = 8;
const MAX_SPOOL_LIMIT = 50;

function logApiError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error(`[api/locations] ${context}`, error);
  }
}

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("view") === "picker") {
      const locations = await prisma.location.findMany({
        select: {
          id: true,
          name: true,
          type: true,
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(locations);
    }

    const spoolLimit = parseBoundedInt(
      searchParams.get("spoolLimit"), DEFAULT_SPOOL_LIMIT, 1, MAX_SPOOL_LIMIT
    );

    const locations = await prisma.location.findMany({
      include: {
        _count: {
          select: { spools: { where: { status: "ACTIVE" } } },
        },
        spools: {
          where: { status: "ACTIVE" },
          include: {
            filament: {
              select: {
                brand: true,
                material: true,
                color_name: true,
                color_hex: true,
                nominal_weight: true,
              },
            },
          },
          orderBy: { created_at: "desc" },
          take: spoolLimit,
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(locations);
  } catch (error) {
    logApiError("GET failed", error);
    return NextResponse.json({ error: "获取位置列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const bodyResult = await readJsonWithLimit<unknown>(request, {
      maxBytes: MAX_JSON_BODY_BYTES,
    });
    if (!bodyResult.ok) {
      return NextResponse.json(
        { error: bodyResult.error },
        { status: bodyResult.status }
      );
    }

    const parsed = locationCreateSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const body = parsed.data;
    const { name, type = "custom", is_default, printer_name, ams_unit, ams_slot } = body;
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedType = typeof type === "string" ? type : "";
    const normalizedPrinterName = typeof printer_name === "string" ? printer_name.trim() : "";
    const normalizedAmsUnit = typeof ams_unit === "string" ? ams_unit.trim() : "";
    const normalizedAmsSlot = typeof ams_slot === "string" ? ams_slot.trim() : "";

    if (!normalizedName) {
      return NextResponse.json({ error: "位置名称不能为空" }, { status: 400 });
    }
    if (!isLocationType(normalizedType)) {
      return NextResponse.json({ error: "不支持的位置类型" }, { status: 400 });
    }
    if (normalizedName.length > 80) {
      return NextResponse.json({ error: "位置名称不能超过 80 个字符" }, { status: 400 });
    }
    if (is_default !== undefined && typeof is_default !== "boolean") {
      return NextResponse.json({ error: "is_default 必须是布尔值" }, { status: 400 });
    }

    // AMS Slot 类型校验
    if (normalizedType === "ams_slot") {
      if (!normalizedPrinterName || !normalizedAmsUnit || !normalizedAmsSlot) {
        return NextResponse.json(
          { error: "AMS 插槽类型需要填写打印机名称、AMS 单元和插槽号" },
          { status: 400 }
        );
      }
    }

    const location = await prisma.$transaction(async (tx) => {
      // 如果设为默认，先取消其他默认
      if (is_default) {
        await tx.location.updateMany({
          where: { is_default: true },
          data: { is_default: false },
        });
      }

      return tx.location.create({
        data: {
          name: normalizedName,
          type: normalizedType,
          is_default: is_default ?? false,
          printer_name: normalizedPrinterName || undefined,
          ams_unit: normalizedAmsUnit || undefined,
          ams_slot: normalizedAmsSlot || undefined,
        },
      });
    });

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    logApiError("POST failed", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
