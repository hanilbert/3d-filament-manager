/**
 * UPC/GTIN 格式校验和标准化工具
 *
 * 支持的格式：
 * - UPC-A: 12 位数字
 * - EAN-8: 8 位数字
 * - EAN-13: 13 位数字
 * - GTIN-14: 14 位数字
 */

/** 有效的 UPC/GTIN 长度集合 */
const UPC_GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/**
 * 标准化 UPC/GTIN 字符串
 * 移除空格和连字符
 * @param value - 原始 UPC/GTIN 字符串
 * @returns 标准化后的字符串（仅包含数字）
 */
export function normalizeUpcGtin(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/**
 * 验证 UPC/GTIN 格式是否有效
 * @param value - 标准化后的 UPC/GTIN 字符串
 * @returns 是否为有效的 UPC/GTIN（纯数字且长度符合要求）
 */
export function isValidUpcGtin(value: string): boolean {
  return /^\d+$/.test(value) && UPC_GTIN_LENGTHS.has(value.length);
}

/**
 * 解析请求体中的 UPC/GTIN 字段
 * 用于 POST/PATCH 请求的数据验证
 *
 * @param value - 请求体中的 UPC/GTIN 值
 * @returns 解析结果对象
 *   - provided: 是否提供了该字段
 *   - normalized: 标准化后的值（null 表示清空）
 *   - error: 错误信息（null 表示无错误）
 *
 * @example
 * ```typescript
 * const result = parseBodyUpcGtin(body.upc_gtin);
 * if (result.error) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 * if (result.provided) {
 *   data.upc_gtin = result.normalized;
 * }
 * ```
 */
export function parseBodyUpcGtin(value: unknown): {
  provided: boolean;
  normalized: string | null;
  error: string | null;
} {
  if (value === undefined) {
    return { provided: false, normalized: null, error: null };
  }
  if (value === null) {
    return { provided: true, normalized: null, error: null };
  }
  if (typeof value !== "string") {
    return { provided: true, normalized: null, error: "UPC/GTIN 格式无效" };
  }
  const normalized = normalizeUpcGtin(value);
  if (!normalized) {
    return { provided: true, normalized: null, error: null };
  }
  if (!isValidUpcGtin(normalized)) {
    return { provided: true, normalized: null, error: "UPC/GTIN 格式无效" };
  }
  return { provided: true, normalized, error: null };
}

/**
 * 解析 URL 查询参数中的 UPC/GTIN
 * 用于 GET 请求的查询筛选
 *
 * @param value - URL 查询参数值
 * @returns 解析结果对象
 *   - provided: 是否提供了该参数
 *   - normalized: 标准化后的值
 *   - error: 错误信息（null 表示无错误）
 */
export function parseQueryUpcGtin(value: string | null): {
  provided: boolean;
  normalized: string | null;
  error: string | null;
} {
  if (value === null) {
    return { provided: false, normalized: null, error: null };
  }
  const normalized = normalizeUpcGtin(value);
  if (!normalized || !isValidUpcGtin(normalized)) {
    return { provided: true, normalized: null, error: "UPC/GTIN 格式无效" };
  }
  return { provided: true, normalized, error: null };
}
