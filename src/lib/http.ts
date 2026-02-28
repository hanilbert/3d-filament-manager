/**
 * HTTP 请求体大小限制工具
 * 防止过大的请求体导致内存溢出或 DoS 攻击
 */

/**
 * JSON 读取配置选项
 */
export interface JsonReadOptions {
  /** 最大字节数，默认 64KB */
  maxBytes?: number;
  /** 无效 JSON 的错误消息 */
  invalidMessage?: string;
  /** 请求体过大的错误消息 */
  tooLargeMessage?: string;
}

/**
 * JSON 读取结果
 * 使用 discriminated union 类型确保类型安全
 */
export type JsonReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 413; error: string };

const DEFAULT_MAX_JSON_BYTES = 64 * 1024;
const DEFAULT_INVALID_MESSAGE = "请求格式错误";
const DEFAULT_TOO_LARGE_MESSAGE = "请求体过大";

/**
 * 解析 Content-Length 请求头
 * @param value - Content-Length 请求头的值
 * @returns 解析后的长度（字节），无效时返回 null
 */
function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const length = Number(value);
  if (!Number.isFinite(length) || length < 0) return null;
  return Math.floor(length);
}

/**
 * 读取请求体文本并限制大小
 * 使用流式读取，逐块检查大小，防止内存溢出
 *
 * @param request - HTTP 请求对象
 * @param maxBytes - 最大允许字节数
 * @returns 读取结果
 *   - ok: true 时返回文本内容
 *   - ok: false 时返回状态码（400: 无请求体，413: 超过大小限制）
 */
async function readBodyTextWithLimit(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; status: 400 | 413 }> {
  const headerLength = parseContentLength(request.headers.get("content-length"));
  if (headerLength !== null && headerLength > maxBytes) {
    return { ok: false, status: 413 };
  }

  if (!request.body) {
    return { ok: false, status: 400 };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(merged) };
}

/**
 * 读取并解析 JSON 请求体，限制大小
 * 结合大小限制和 JSON 解析，提供统一的错误处理
 *
 * @param request - HTTP 请求对象
 * @param options - 配置选项
 * @returns 解析结果
 *   - ok: true 时返回解析后的数据
 *   - ok: false 时返回错误信息和 HTTP 状态码
 *
 * @example
 * ```typescript
 * const result = await readJsonWithLimit<CreateSpoolBody>(request, {
 *   maxBytes: 64 * 1024
 * });
 * if (!result.ok) {
 *   return NextResponse.json({ error: result.error }, { status: result.status });
 * }
 * const body = result.data;
 * ```
 */
export async function readJsonWithLimit<T>(
  request: Request,
  options: JsonReadOptions = {}
): Promise<JsonReadResult<T>> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  const invalidMessage = options.invalidMessage ?? DEFAULT_INVALID_MESSAGE;
  const tooLargeMessage = options.tooLargeMessage ?? DEFAULT_TOO_LARGE_MESSAGE;

  const bodyResult = await readBodyTextWithLimit(request, maxBytes);
  if (!bodyResult.ok) {
    return {
      ok: false,
      status: bodyResult.status,
      error: bodyResult.status === 413 ? tooLargeMessage : invalidMessage,
    };
  }

  const text = bodyResult.text.trim();
  if (!text) {
    return { ok: false, status: 400, error: invalidMessage };
  }

  try {
    const parsed = JSON.parse(text) as T;
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, status: 400, error: invalidMessage };
  }
}
