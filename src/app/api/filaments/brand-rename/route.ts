import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

function logApiError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error(`[api/filaments/brand-rename] ${context}`, error);
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const oldBrandRaw = (body as { oldBrand?: unknown }).oldBrand;
    const newBrandRaw = (body as { newBrand?: unknown }).newBrand;
    const oldBrand = typeof oldBrandRaw === "string" ? oldBrandRaw.trim() : "";
    const newBrand = typeof newBrandRaw === "string" ? newBrandRaw.trim() : "";

    if (!oldBrand || !newBrand) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    if (oldBrand === newBrand) {
      return NextResponse.json({ error: "新旧品牌不能相同" }, { status: 400 });
    }
    if (newBrand.length > 80) {
      return NextResponse.json({ error: "品牌名不能超过 80 个字符" }, { status: 400 });
    }

    const result = await prisma.filament.updateMany({
      where: { brand: oldBrand },
      data: { brand: newBrand },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    logApiError("PATCH failed", error);
    return NextResponse.json({ error: "重命名失败" }, { status: 500 });
  }
}
