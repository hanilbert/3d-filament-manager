import { prisma } from "@/lib/db";

interface MissingFilamentRow {
  filament_id: string;
}

const REPAIR_CACHE_TTL_MS = 5 * 60 * 1000;
let repairInFlight: Promise<number> | null = null;
let lastRepairAt = 0;

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

export async function ensureOrphanSpoolFilamentsRepaired(): Promise<number> {
  const now = Date.now();
  if (now - lastRepairAt < REPAIR_CACHE_TTL_MS) return 0;
  if (repairInFlight) return repairInFlight;

  repairInFlight = repairOrphanSpoolFilaments()
    .then((count) => {
      lastRepairAt = Date.now();
      return count;
    })
    .finally(() => {
      repairInFlight = null;
    });

  return repairInFlight;
}
