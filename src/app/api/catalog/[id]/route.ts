import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const item = await prisma.globalFilament.findUnique({
    where: { id },
    include: {
      spools: {
        where: { status: "ACTIVE" },
        include: { location: true },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();

    const allowedFields = [
      "brand", "material", "color_name", "color_hex", "nozzle_temp", "bed_temp", "print_speed", "logo_url",
      "density", "diameter", "nominal_weight", "softening_temp", "chamber_temp",
      "ironing_flow", "ironing_speed", "shrinkage", "empty_spool_weight", "pressure_advance",
      "fan_min", "fan_max",
      "first_layer_walls", "first_layer_infill", "first_layer_outer_wall", "first_layer_top_surface",
      "other_layers_walls", "other_layers_infill", "other_layers_outer_wall", "other_layers_top_surface",
      "measured_rgb", "top_voted_td", "num_td_votes",
      "max_volumetric_speed", "flow_ratio",
      "drying_temp", "dry_time",
      "ams_compatibility", "build_plates",
    ] as const;

    const data: Record<string, string | null> = {};
    for (const f of allowedFields) {
      if (f in body) data[f] = body[f] || null;
    }

    const item = await prisma.globalFilament.update({
      where: { id },
      data,
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const spoolCount = await prisma.spool.count({
    where: { global_filament_id: id },
  });

  if (spoolCount > 0) {
    return NextResponse.json(
      { error: `该耗材关联了 ${spoolCount} 卷料卷，无法删除` },
      { status: 400 }
    );
  }

  await prisma.globalFilament.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
