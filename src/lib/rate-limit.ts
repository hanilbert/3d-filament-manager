import { isIP } from "node:net";

/**
 * 限流记录条目
 * 存储每个客户端的请求计数和时间窗口信息
 */
interface RateLimitEntry {
  /** 当前时间窗口内的请求次数 */
  count: number;
  /** 时间窗口重置时间戳（毫秒） */
  resetAt: number;
  /** 最后一次请求时间戳（毫秒），用于清理最久未使用的条目 */
  lastSeenAt: number;
}

/**
 * 固定窗口限流器配置选项
 */
export interface FixedWindowRateLimitOptions {
  /** 时间窗口大小（毫秒） */
  windowMs: number;
  /** 时间窗口内允许的最大请求次数 */
  maxAttempts: number;
  /** 最大存储的客户端数量，超过后删除最久未使用的条目 */
  maxKeys: number;
  /** 清理过期条目的间隔时间（毫秒），默认 30 秒 */
  cleanupIntervalMs?: number;
}

/**
 * 限流检查结果
 */
export interface RateLimitResult {
  /** 是否被限流 */
  limited: boolean;
  /** 当前时间窗口内的请求次数 */
  count: number;
  /** 剩余可用请求次数 */
  remaining: number;
  /** 时间窗口重置时间戳（毫秒） */
  resetAt: number;
}

const DEFAULT_CLEANUP_INTERVAL_MS = 30 * 1000;
const MAX_IP_LENGTH = 64;

/**
 * 移除 IPv4 地址中的端口号
 * 例如：192.168.1.1:8080 -> 192.168.1.1
 * @param raw - 原始 IP 地址字符串
 * @returns 移除端口号后的 IP 地址
 */
function stripIpv4Port(raw: string): string {
  if (!raw.includes(":")) return raw;
  if (!raw.includes(".")) return raw;
  const [host] = raw.split(":");
  return host ?? raw;
}

/**
 * 标准化候选 IP 地址
 * 处理步骤：
 * 1. 去除首尾空格
 * 2. 移除 IPv4 端口号
 * 3. 移除 IPv6 区域标识符（%）
 * 4. 转换为小写
 * @param raw - 原始 IP 地址字符串
 * @returns 标准化后的 IP 地址
 */
function normalizeCandidateIp(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withoutPort = stripIpv4Port(trimmed);
  const withoutZone = withoutPort.split("%")[0] ?? withoutPort;
  return withoutZone.toLowerCase();
}

/**
 * 从请求头中提取并标准化客户端 IP 地址
 * 按优先级检查以下请求头：
 * 1. X-Forwarded-For（代理/负载均衡器设置，取第一个 IP）
 * 2. X-Real-IP（Nginx 等反向代理设置）
 *
 * @param headers - HTTP 请求头对象
 * @returns 标准化的客户端 IP 地址，如果无法提取则返回 "unknown"
 */
export function normalizeClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  const xRealIp = headers.get("x-real-ip");
  const candidates = [
    xff ? xff.split(",")[0] ?? "" : "",
    xRealIp ?? "",
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCandidateIp(candidate);
    if (!normalized) continue;
    if (!isIP(normalized)) continue;
    return normalized.slice(0, MAX_IP_LENGTH);
  }

  return "unknown";
}

/**
 * 固定窗口限流器
 * 实现固定时间窗口的请求频率限制
 *
 * 特性：
 * - 固定时间窗口算法（每个窗口独立计数）
 * - 自动清理过期条目
 * - LRU 策略：超过 maxKeys 时删除最久未使用的条目
 * - 内存存储（适用于单实例部署）
 *
 * @example
 * ```typescript
 * const limiter = new FixedWindowRateLimiter({
 *   windowMs: 15 * 60 * 1000,  // 15 分钟
 *   maxAttempts: 10,            // 最多 10 次请求
 *   maxKeys: 10000              // 最多存储 10000 个客户端
 * });
 *
 * const result = limiter.hit(clientIp);
 * if (result.limited) {
 *   // 返回 429 Too Many Requests
 * }
 * ```
 */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  private readonly cleanupIntervalMs: number;

  private lastCleanupAt = 0;

  constructor(private readonly options: FixedWindowRateLimitOptions) {
    this.cleanupIntervalMs =
      options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
  }

  /**
   * 记录一次请求并检查是否超过限流阈值
   * @param key - 客户端标识符（通常是 IP 地址）
   * @param now - 当前时间戳（毫秒），默认为 Date.now()
   * @returns 限流检查结果
   */
  hit(key: string, now = Date.now()): RateLimitResult {
    const normalizedKey = key.trim() || "unknown";
    this.maybeCleanup(now);

    const current = this.entries.get(normalizedKey);
    let entry: RateLimitEntry;
    if (!current || now > current.resetAt) {
      entry = {
        count: 1,
        resetAt: now + this.options.windowMs,
        lastSeenAt: now,
      };
    } else {
      entry = {
        count: current.count + 1,
        resetAt: current.resetAt,
        lastSeenAt: now,
      };
    }

    // LRU：先删再插，确保活跃 key 移到 Map 尾部
    if (this.entries.has(normalizedKey)) this.entries.delete(normalizedKey);
    this.entries.set(normalizedKey, entry);
    this.enforceMaxKeys();

    const limited = entry.count > this.options.maxAttempts;
    return {
      limited,
      count: entry.count,
      remaining: Math.max(0, this.options.maxAttempts - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /**
   * 获取当前存储的客户端数量
   * @returns 存储的条目数量
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * 定期清理过期的限流条目
   * 仅在距离上次清理超过 cleanupIntervalMs 时执行
   * @param now - 当前时间戳（毫秒）
   */
  private maybeCleanup(now: number): void {
    if (now - this.lastCleanupAt < this.cleanupIntervalMs) return;
    this.lastCleanupAt = now;

    for (const [key, entry] of this.entries) {
      if (now > entry.resetAt) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * 强制执行最大条目数限制
   * 利用 Map 插入顺序实现 O(1) LRU 淘汰：首部即为最久未使用的条目
   */
  private enforceMaxKeys(): void {
    while (this.entries.size > this.options.maxKeys) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }
}
