import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const locations = await prisma.location.findMany({
    include: {
      _count: {
        select: { spools: { where: { status: "ACTIVE" } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(locations);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "位置名称不能为空" }, { status: 400 });
    }

    const location = await prisma.location.create({
      data: { name: name.trim() },
    });

    return NextResponse.json(location, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
