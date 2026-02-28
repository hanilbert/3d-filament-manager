import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { findSharedBrandLogoUrl } from "@/lib/brand-logo";
import { withFallbackFilamentLogo } from "@/lib/spool-detail";
import { spoolPatchSchema } from "@/lib/api-schemas";
import { readJsonWithLimit } from "@/lib/http";

const MAX_JSON_BODY_BYTES = 64 * 1024;

function logApiError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error(`[api/spools/[id]] ${context}`, error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const spool = await prisma.spool.findUnique({
    where: { id },
    include: {
      filament: true,
      location: true,
    },
  });

  if (!spool) return NextResponse.json({ error: "未找到" }, { status: 404 });
  const normalized = await withFallbackFilamentLogo(spool, (brand, filamentId) =>
    findSharedBrandLogoUrl(brand, filamentId)
  );
  return NextResponse.json(normalized);
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

    const parsed = spoolPatchSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const body = parsed.data;
    const bodyRecord = body as Record<string, unknown>;
    const allowedFields = ["location_id", "status"];
    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in bodyRecord) data[key] = bodyRecord[key];
    }

    if ("metadata" in bodyRecord) {
      if (bodyRecord.metadata === null) {
        data.metadata = null;
      } else {
        const metaString =
          typeof bodyRecord.metadata === "string"
            ? bodyRecord.metadata
            : JSON.stringify(bodyRecord.metadata);
        if (metaString.length > 10000) {
          return NextResponse.json(
            { error: "metadata 不能超过 10KB" },
            { status: 400 }
          );
        }
        data.metadata = metaString;
      }
    }

    const spool = await prisma.spool.update({
      where: { id },
      data,
      include: {
        filament: true,
        location: true,
      },
    });

    const normalized = await withFallbackFilamentLogo(spool, (brand, filamentId) =>
      findSharedBrandLogoUrl(brand, filamentId)
    );
    return NextResponse.json(normalized);
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "P2025") {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (code === "P2003") {
      return NextResponse.json({ error: "location_id 无效" }, { status: 400 });
    }
    logApiError("PATCH failed", error);
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
    await prisma.spool.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "P2025") {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    logApiError("DELETE failed", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
