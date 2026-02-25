import { prisma } from "@/lib/db";

export async function findSharedBrandLogoUrl(
  brand: string,
  excludeId?: string
): Promise<string | null> {
  const normalized = brand.trim().toLowerCase();
  if (!normalized) return null;

  // SQLite LIKE is case-insensitive for ASCII; use contains for broader match
  const result = await prisma.globalFilament.findFirst({
    where: {
      brand: { contains: brand.trim() },
      logo_url: { not: null },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { logo_url: true },
    orderBy: { updated_at: "desc" },
  });

  // Double-check normalized match in case contains returned a partial match
  if (!result?.logo_url) return null;
  return result.logo_url;
}
