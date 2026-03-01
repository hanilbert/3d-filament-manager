import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { FILAMENT_OPTIONAL_FIELDS } from "@/lib/types";
import { findSharedBrandLogoUrl, invalidateBrandLogoCache } from "@/lib/brand-logo";
import { parseBodyUpcGtin } from "@/lib/upc-gtin";
import { filamentCreateSchema } from "@/lib/api-schemas";
import { readJsonWithLimit } from "@/lib/http";
import { queryFilaments } from "@/lib/filaments-api-query";

/**
 * 耗材可选字段类型（排除特殊处理的字段）
 * upc_gtin, material, variant 需要特殊处理，不在通用循环中处理
 */
type CatalogOptionalField = Exclude<
  (typeof FILAMENT_OPTIONAL_FIELDS)[number],
  "upc_gtin" | "material" | "variant"
>;

/** 请求体大小限制：64KB */
const MAX_JSON_BODY_BYTES = 64 * 1024;

/**
 * GET /api/filaments
 * 获取耗材列表或聚合统计
 *
 * 查询参数：
 * - q: 全文搜索（品牌、材料、变体、颜色名称）
 * - brand, material, variant: 筛选条件
 * - exact: 是否精确匹配（默认模糊匹配）
 * - upc_gtin: UPC/GTIN 查询
 * - groupBy: 聚合模式（brand | material | variant | brandList）
 *
 * 返回：
 * - 200: 耗材列表或聚合结果
 * - 401: 未认证
 */
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  return queryFilaments(searchParams);
}

/**
 * POST /api/filaments
 * 创建新耗材
 *
 * 请求体：
 * - brand, material, color_name: 必填
 * - variant: 可选，默认为空字符串
 * - upc_gtin: 可选，会进行格式校验和标准化
 * - 其他 40+ 打印参数字段：可选
 *
 * 业务逻辑：
 * 1. 验证 UPC/GTIN 格式
 * 2. 如果未提供 logo_url，自动查找同品牌的 Logo
 * 3. 创建成功后，将 Logo 同步到同品牌的所有耗材
 *
 * 返回：
 * - 201: 创建成功，返回耗材详情
 * - 400: 请求格式错误、缺少必填字段或 UPC/GTIN 格式错误
 * - 401: 未认证
 * - 409: UPC/GTIN 已存在（唯一约束冲突）
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

    const parsed = filamentCreateSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const body = parsed.data;
    const bodyRecord = body as Record<string, string | null | undefined>;
    const brand = body.brand?.trim();
    const color_name = body.color_name?.trim();
    const material = body.material?.trim();
    const variant = body.variant?.trim() || "";

    if (!brand || !color_name || !material) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const data: Prisma.FilamentCreateInput = {
      brand,
      material,
      variant,
      color_name,
    };

    const upcGtin = parseBodyUpcGtin(bodyRecord.upc_gtin);
    if (upcGtin.error) {
      return NextResponse.json({ error: upcGtin.error }, { status: 400 });
    }
    if (upcGtin.provided) {
      data.upc_gtin = upcGtin.normalized;
    }

    for (const f of FILAMENT_OPTIONAL_FIELDS) {
      const value = bodyRecord[f];
      if (typeof value === "string" && value) {
        data[f as CatalogOptionalField] = value;
      }
    }

    if (!data.logo_url) {
      const sharedLogoUrl = await findSharedBrandLogoUrl(brand);
      if (sharedLogoUrl) data.logo_url = sharedLogoUrl;
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.filament.create({ data });
      if (created.logo_url) {
        await tx.filament.updateMany({
          where: { brand: created.brand, id: { not: created.id } },
          data: { logo_url: created.logo_url },
        });
      }
      return created;
    });

    if (item.logo_url) {
      invalidateBrandLogoCache(item.brand);
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
