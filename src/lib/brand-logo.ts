import { prisma } from "@/lib/db";

/**
 * 查找同品牌下已配置的 Logo URL
 * 用于品牌 Logo 共享功能：新建耗材时自动继承同品牌的 Logo
 *
 * 查询逻辑：
 * - 查找相同品牌名称（精确匹配）
 * - 必须已配置 logo_url
 * - 可选排除指定 ID（用于更新场景）
 * - 按更新时间倒序，返回最新的 Logo
 *
 * @param brand - 品牌名称
 * @param excludeId - 可选，要排除的耗材 ID（避免查询到自己）
 * @returns Logo URL，如果未找到则返回 null
 *
 * @example
 * ```typescript
 * // 新建耗材时自动继承品牌 Logo
 * const logoUrl = await findSharedBrandLogoUrl("eSUN");
 * if (logoUrl) {
 *   data.logo_url = logoUrl;
 * }
 * ```
 */
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
