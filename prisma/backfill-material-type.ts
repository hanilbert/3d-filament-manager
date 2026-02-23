/**
 * Backfill material_type from existing material values.
 * - Extracts the first word as material_type (e.g. "PLA Matte" → "PLA")
 * - Renames bare "PLA" → "PLA Basic" (no sub-type should exist without a qualifier)
 *
 * Usage: npx tsx prisma/backfill-material-type.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Step 1: Rename bare material names to "X Basic"
  const bareRows = await prisma.globalFilament.findMany({
    where: {
      material: { in: ["PLA", "PETG", "TPU"] },
    },
    select: { id: true, material: true },
  });

  for (const row of bareRows) {
    await prisma.globalFilament.update({
      where: { id: row.id },
      data: { material: `${row.material} Basic` },
    });
    console.log(`Renamed material "${row.material}" → "${row.material} Basic" (id: ${row.id})`);
  }

  // Step 2: Backfill material_type = first word of material
  const all = await prisma.globalFilament.findMany({
    where: { material_type: null },
    select: { id: true, material: true },
  });

  for (const row of all) {
    const materialType = row.material.split(" ")[0];
    await prisma.globalFilament.update({
      where: { id: row.id },
      data: { material_type: materialType },
    });
    console.log(`Set material_type="${materialType}" for "${row.material}" (id: ${row.id})`);
  }

  console.log(`\nDone. Processed ${bareRows.length} renames, ${all.length} backfills.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
