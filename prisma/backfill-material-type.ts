/**
 * Backfill Filament.material from Filament.variant when material is empty.
 * 用于字段重命名后的兜底修复：如果材料主类为空，尝试从细分类型首词推断。
 *
 * Usage: npx tsx prisma/backfill-material-type.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const missingMaterialRows = await prisma.filament.findMany({
    where: {
      material: "",
    },
    select: { id: true, variant: true },
  });

  let updated = 0;
  for (const row of missingMaterialRows) {
    const inferred = row.variant.trim().split(/\s+/)[0] || "UNKNOWN";
    await prisma.filament.update({
      where: { id: row.id },
      data: { material: inferred },
    });
    updated += 1;
    console.log(`Set material="${inferred}" from variant="${row.variant}" (id: ${row.id})`);
  }

  console.log(`\nDone. Processed ${updated} backfills.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
