import { prisma } from "@/lib/db";

function normalizeBrand(value: string): string {
  return value.trim().toLowerCase();
}

export async function findSharedBrandLogoUrl(
  brand: string,
  excludeId?: string
): Promise<string | null> {
  const normalized = normalizeBrand(brand);
  if (!normalized) return null;

  const candidates = await prisma.globalFilament.findMany({
    where: {
      logo_url: { not: null },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { brand: true, logo_url: true },
    orderBy: { updated_at: "desc" },
  });

  const matched = candidates.find(
    (item) => item.logo_url && normalizeBrand(item.brand) === normalized
  );
  return matched?.logo_url ?? null;
}

