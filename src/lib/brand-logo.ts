import { prisma } from "@/lib/db";

// --- 品牌 Logo 内存缓存 ---
const BRAND_LOGO_CACHE_TTL_MS = 30_000; // 30s TTL
const BRAND_LOGO_CACHE_MAX_KEYS = 2_000;

interface LogoCacheEntry {
  value: string | null;
  expiresAt: number;
}

const logoCache = new Map<string, LogoCacheEntry>();

function buildCacheKey(brand: string, excludeId?: string): string {
  return `${brand}::${excludeId ?? ""}`;
}

function getCachedLogo(key: string, now: number): string | null | undefined {
  const entry = logoCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    logoCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedLogo(key: string, value: string | null, now: number): void {
  logoCache.set(key, { value, expiresAt: now + BRAND_LOGO_CACHE_TTL_MS });
  // LRU 淘汰：Map 按插入顺序，删除最早的
  while (logoCache.size > BRAND_LOGO_CACHE_MAX_KEYS) {
    const oldest = logoCache.keys().next().value as string | undefined;
    if (!oldest) break;
    logoCache.delete(oldest);
  }
}

/**
 * 清除品牌 Logo 缓存
 * 在品牌 Logo 变更时调用（创建/更新/重命名）
 * @param brand - 品牌名称，不传则清除全部缓存
 */
export function invalidateBrandLogoCache(brand?: string): void {
  if (!brand) {
    logoCache.clear();
    return;
  }
  const normalized = brand.trim();
  if (!normalized) return;
  const prefix = `${normalized}::`;
  for (const key of logoCache.keys()) {
    if (key.startsWith(prefix)) {
      logoCache.delete(key);
    }
  }
}

/**
 * 查找同品牌下已配置的 Logo URL
 * 用于品牌 Logo 共享功能：新建耗材时自动继承同品牌的 Logo
 *
 * 查询逻辑：
 * - 查找相同品牌名称（精确匹配）
 * - 必须已配置 logo_url
 * - 可选排除指定 ID（用于更新场景）
 * - 按更新时间倒序，返回最新的 Logo
 * - 结果缓存 30 秒，减少高频重复查询
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

  const now = Date.now();
  const cacheKey = buildCacheKey(normalized, excludeId);
  const cached = getCachedLogo(cacheKey, now);
  if (cached !== undefined) {
    return cached;
  }

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
  const logo = result?.logo_url ?? null;
  setCachedLogo(cacheKey, logo, now);
  return logo;
}
