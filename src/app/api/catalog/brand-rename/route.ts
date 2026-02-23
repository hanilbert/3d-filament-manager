import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function PATCH(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { oldBrand, newBrand } = await request.json();
    if (!oldBrand || !newBrand) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const result = await prisma.globalFilament.updateMany({
      where: { brand: oldBrand },
      data: { brand: newBrand },
    });

    return NextResponse.json({ updated: result.count });
  } catch {
    return NextResponse.json({ error: "重命名失败" }, { status: 500 });
  }
}
