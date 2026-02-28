import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { findSharedBrandLogoUrl } from "@/lib/brand-logo";
import { withFallbackFilamentLogo } from "@/lib/spool-detail";
import { ensureOrphanSpoolFilamentsRepaired } from "@/lib/data-repair";

function logApiError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error(`[api/spools/[id]] ${context}`, error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  await ensureOrphanSpoolFilamentsRepaired().catch((error) => {
    logApiError("orphan repair skipped after failure", error);
    return 0;
  });

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
  await ensureOrphanSpoolFilamentsRepaired().catch((error) => {
    logApiError("orphan repair skipped after failure", error);
    return 0;
  });

  const { id } = await params;
  try {
    const body = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    if (
      body.status !== undefined &&
      (typeof body.status !== "string" || !["ACTIVE", "EMPTY"].includes(body.status))
    ) {
      return NextResponse.json({ error: "status 必须为 ACTIVE 或 EMPTY" }, { status: 400 });
    }

    if (
      body.location_id !== undefined &&
      body.location_id !== null &&
      typeof body.location_id !== "string"
    ) {
      return NextResponse.json({ error: "location_id 必须为字符串或 null" }, { status: 400 });
    }

    const allowedFields = ["location_id", "status"];
    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) data[key] = body[key];
    }

    if ("metadata" in body) {
      if (body.metadata === null) {
        data.metadata = null;
      } else {
        const metaString =
          typeof body.metadata === "string"
            ? body.metadata
            : JSON.stringify(body.metadata);
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
