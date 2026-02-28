import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { spoolCreateSchema } from "@/lib/api-schemas";
import { readJsonWithLimit } from "@/lib/http";

/**
 * 线轴列表支持的排序字段
 * 包括耗材关联字段（brand, material 等）和线轴自身字段
 */
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
/** 请求体大小限制：64KB */
const MAX_JSON_BODY_BYTES = 64 * 1024;

/**
 * 记录 API 错误日志
 * 测试环境下不输出日志，避免干扰测试输出
 * @param context - 错误上下文描述
 * @param error - 错误对象
 */
function logSpoolApiError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error(`[api/spools] ${context}`, error);
  }
}

/**
 * 解析排序字段参数
 * @param value - URL 查询参数值
 * @returns 有效的排序字段，无效时返回默认值 "created_at"
 */
function parseSortField(value: string | null): SpoolSortField {
  if (!value) return "created_at";
  return SPOOL_SORT_FIELDS.includes(value as SpoolSortField)
    ? (value as SpoolSortField)
    : "created_at";
}

/**
 * 解析排序方向参数
 * @param value - URL 查询参数值
 * @returns "asc" 或 "desc"，默认为 "desc"
 */
function parseSortOrder(value: string | null): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}

/**
 * 解析线轴状态参数
 * @param value - URL 查询参数值
 * @returns 有效状态、null（不筛选）或 "invalid"（无效值）
 */
function parseSpoolStatus(value: string | null): SpoolStatus | null | "invalid" {
  if (!value) return null;
  if (SPOOL_STATUS_SET.has(value as SpoolStatus)) {
    return value as SpoolStatus;
  }
  return "invalid";
}

/**
 * 根据排序字段构建 Prisma orderBy 对象
 * 处理关联字段（brand, material 等）和直接字段的不同查询语法
 * @param field - 排序字段
 * @param order - 排序方向
 * @returns Prisma orderBy 配置对象
 */
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

/**
 * GET /api/spools
 * 获取线轴列表
 *
 * 查询参数：
 * - status: 筛选状态（ACTIVE | EMPTY），可选
 * - sortBy: 排序字段，默认 created_at
 * - sortOrder: 排序方向（asc | desc），默认 desc
 *
 * 返回：
 * - 200: 线轴列表（包含关联的耗材和位置信息）
 * - 400: 无效的 status 参数
 * - 401: 未认证
 */
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

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

/**
 * POST /api/spools
 * 创建新线轴
 *
 * 请求体：
 * - filament_id: 耗材 ID（必填）
 *
 * 业务逻辑：
 * - 验证耗材是否存在
 * - 状态默认为 ACTIVE
 * - 位置默认为 null
 *
 * 返回：
 * - 201: 创建成功，返回线轴详情
 * - 400: 请求格式错误或缺少 filament_id
 * - 401: 未认证
 * - 404: 耗材不存在
 * - 413: 请求体过大
 * - 500: 创建失败
 */
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

    const parsed = spoolCreateSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const filamentId = parsed.data.filament_id.trim();

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
    logSpoolApiError("POST failed", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
