import { prisma } from "@/lib/db";

export async function findSharedBrandLogoUrl(
  brand: string,
  excludeId?: string
): Promise<string | null> {
  const normalized = brand.trim();
  if (!normalized) return null;

  const result = await prisma.filament.findFirst({
    where: {
      brand: { equals: normalized },
      logo_url: { not: null },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { logo_url: true },
    orderBy: { updated_at: "desc" },
  });

  // 仅返回同品牌下最近一次已配置的 logo
  if (!result?.logo_url) return null;
  return result.logo_url;
}
