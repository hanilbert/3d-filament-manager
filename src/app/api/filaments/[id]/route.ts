import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { FILAMENT_ALLOWED_FIELDS } from "@/lib/types";
import { findSharedBrandLogoUrl, invalidateBrandLogoCache } from "@/lib/brand-logo";
import { parseBodyUpcGtin } from "@/lib/upc-gtin";
import { filamentPatchSchema } from "@/lib/api-schemas";
import { readJsonWithLimit } from "@/lib/http";

const MAX_JSON_BODY_BYTES = 64 * 1024;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const item = await prisma.filament.findUnique({
    where: { id },
    include: {
      spools: {
        include: { location: true },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "未找到" }, { status: 404 });

  if (!item.logo_url) {
    const sharedLogoUrl = await findSharedBrandLogoUrl(item.brand, item.id);
    if (sharedLogoUrl) {
      return NextResponse.json({ ...item, logo_url: sharedLogoUrl });
    }
  }

  return NextResponse.json(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
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

    const parsed = filamentPatchSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const body = parsed.data;
    const bodyRecord = body as Record<string, string | null | undefined>;
    const current = await prisma.filament.findUnique({
      where: { id },
      select: { id: true, brand: true, logo_url: true },
    });
    if (!current) return NextResponse.json({ error: "未找到" }, { status: 404 });

    const data: Record<string, string | null> = {};
    for (const f of FILAMENT_ALLOWED_FIELDS) {
      if (f === "upc_gtin") continue;
      if (f in bodyRecord) data[f] = bodyRecord[f] || null;
    }

    const upcGtin = parseBodyUpcGtin(bodyRecord.upc_gtin);
    if (upcGtin.error) {
      return NextResponse.json({ error: upcGtin.error }, { status: 400 });
    }
    if (upcGtin.provided) {
      data.upc_gtin = upcGtin.normalized;
    }

    const targetBrand = data.brand ?? current.brand;
    const hasLogoInPayload = "logo_url" in data;
    if (!hasLogoInPayload && !current.logo_url) {
      const sharedLogoUrl = await findSharedBrandLogoUrl(targetBrand, current.id);
      if (sharedLogoUrl) data.logo_url = sharedLogoUrl;
    }
    if (!hasLogoInPayload && data.brand && data.brand !== current.brand) {
      const sharedLogoUrl = await findSharedBrandLogoUrl(targetBrand, current.id);
      if (sharedLogoUrl) data.logo_url = sharedLogoUrl;
    }

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.filament.update({
        where: { id },
        data,
      });

      if (hasLogoInPayload) {
        await tx.filament.updateMany({
          where: { brand: updated.brand, id: { not: updated.id } },
          data: { logo_url: updated.logo_url },
        });
      } else if (updated.logo_url) {
        await tx.filament.updateMany({
          where: { brand: updated.brand, logo_url: null, id: { not: updated.id } },
          data: { logo_url: updated.logo_url },
        });
      }

      return updated;
    });

    invalidateBrandLogoCache(current.brand);
    if (item.brand !== current.brand) invalidateBrandLogoCache(item.brand);

    return NextResponse.json(item);
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "UPC/GTIN 已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;

  try {
    await prisma.filament.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    // P2003 = FK constraint (spools reference this filament)
    if (code === "P2003") {
      return NextResponse.json(
        { error: "该耗材关联了线轴，无法删除" },
        { status: 400 }
      );
    }
    // P2025 = record not found
    if (code === "P2025") {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
