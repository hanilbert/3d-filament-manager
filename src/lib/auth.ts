/**
 * Token 有效期：7 天（毫秒）
 * 用于生成和验证 HMAC 签名的 Token
 */
export const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * 获取用于 HMAC 签名的密钥
 * 优先使用 TOKEN_SECRET 环境变量，回退到 APP_PASSWORD
 * @returns HMAC 签名密钥
 * @throws 如果两个环境变量都未设置则抛出错误
 */
function getSecret(): string {
  const secret = process.env.TOKEN_SECRET ?? process.env.APP_PASSWORD;
  if (!secret) throw new Error("TOKEN_SECRET or APP_PASSWORD must be set");
  return secret;
}

// --- Web Crypto 辅助函数（Edge Runtime 兼容）---

/**
 * 将二进制数据转换为 Base64URL 编码字符串
 * Base64URL 是 URL 安全的 Base64 变体，替换 +/= 字符
 * @param buf - 要编码的二进制数据
 * @returns Base64URL 编码的字符串
 */
function toBase64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 将 Base64URL 编码的字符串解码为二进制数据
 * @param str - Base64URL 编码的字符串
 * @returns 解码后的字节数组
 */
function fromBase64url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * 使用 Web Crypto API 导入 HMAC 密钥
 * 兼容 Edge Runtime 和 Node.js Runtime
 * @param secret - 密钥字符串
 * @returns CryptoKey 对象，用于 HMAC 签名和验证
 */
async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * 使用 Web Crypto API 进行恒定时间 HMAC 验证
 * 防止时序攻击，兼容 Edge Runtime
 * @param data - 要验证的数据
 * @param signature - Base64URL 编码的签名
 * @param secret - HMAC 密钥
 * @returns 验证是否通过
 */
async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await getHmacKey(secret);
  const sigBytes = fromBase64url(signature);
  const dataBytes = new TextEncoder().encode(data);
  // @ts-expect-error -- TS 5.x Uint8Array<ArrayBufferLike> vs BufferSource mismatch
  return crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
}

// --- Node.js Runtime 同步辅助函数（用于 API 路由中的 Token 生成）---

/**
 * 使用 Node.js crypto 模块进行同步 HMAC 签名
 * 仅在 Node.js Runtime 中可用（API 路由）
 * @param data - 要签名的数据
 * @param secret - HMAC 密钥
 * @returns Base64URL 编码的签名
 */
function hmacSignSync(data: string, secret: string): string {
  // Dynamic require so Edge Runtime doesn't choke on the import
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require("crypto") as typeof import("crypto");
  const buf = createHmac("sha256", secret).update(data).digest();
  return toBase64url(buf);
}

// --- 公共 API ---

/**
 * 生成带 HMAC 签名的认证 Token
 * 仅在 Node.js Runtime 中可用（API 路由）
 * Token 格式：{payload_base64url}.{signature_base64url}
 * Payload 包含：iat（签发时间）和 exp（过期时间）
 * @returns 签名后的 Token 字符串
 */
export function generateToken(): string {
  const payload = { iat: Date.now(), exp: Date.now() + TOKEN_TTL };
  const payloadB64 = toBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = hmacSignSync(payloadB64, getSecret());
  return `${payloadB64}.${sig}`;
}

/**
 * 验证 Token 的签名和有效期
 * 异步函数，兼容 Edge Runtime 和 Node.js Runtime
 * 验证步骤：
 * 1. 检查 Token 格式（必须为 payload.signature）
 * 2. 使用恒定时间算法验证 HMAC 签名
 * 3. 检查 Token 是否过期
 * @param token - 要验证的 Token 字符串
 * @returns 验证是否通过
 */
export async function verifyToken(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;

  // Constant-time signature verification via Web Crypto
  const valid = await hmacVerify(payloadB64, sig, getSecret());
  if (!valid) return false;

  try {
    const json = new TextDecoder().decode(fromBase64url(payloadB64));
    const payload = JSON.parse(json);
    if (typeof payload.exp !== "number") return false;
    return Date.now() < payload.exp;
  } catch {
    return false;
  }
}

/**
 * 从 Authorization 请求头中提取 Bearer Token
 * @param authHeader - Authorization 请求头的值
 * @returns 提取的 Token，如果格式不正确则返回 null
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
