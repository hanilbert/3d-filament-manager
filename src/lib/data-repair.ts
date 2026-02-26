import { prisma } from "@/lib/db";

interface MissingFilamentRow {
  filament_id: string;
}

export async function repairOrphanSpoolFilaments(): Promise<number> {
  const rows = await prisma.$queryRaw<MissingFilamentRow[]>`
    SELECT DISTINCT s.filament_id
    FROM "Spool" s
    LEFT JOIN "Filament" f ON f.id = s.filament_id
    WHERE f.id IS NULL AND s.filament_id IS NOT NULL
  `;

  if (rows.length === 0) return 0;

  await prisma.$transaction(
    rows.map((row) =>
      prisma.filament.upsert({
        where: { id: row.filament_id },
        update: {},
        create: {
          id: row.filament_id,
          brand: "Recovered",
          material: "UNKNOWN",
          variant: "",
          color_name: "待核对",
          color_hex: "#9CA3AF",
        },
      })
    )
  );

  return rows.length;
}
