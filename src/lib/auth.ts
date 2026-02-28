export const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function getSecret(): string {
  const secret = process.env.TOKEN_SECRET ?? process.env.APP_PASSWORD;
  if (!secret) throw new Error("TOKEN_SECRET or APP_PASSWORD must be set");
  return secret;
}

// --- Web Crypto helpers (Edge-compatible) ---

function toBase64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Constant-time HMAC verification using Web Crypto verify (Edge-safe) */
async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await getHmacKey(secret);
  const sigBytes = fromBase64url(signature);
  const dataBytes = new TextEncoder().encode(data);
  // @ts-expect-error -- TS 5.x Uint8Array<ArrayBufferLike> vs BufferSource mismatch
  return crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
}

// --- Sync helpers for Node.js runtime (API routes, generateToken) ---

function hmacSignSync(data: string, secret: string): string {
  // Dynamic require so Edge Runtime doesn't choke on the import
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require("crypto") as typeof import("crypto");
  const buf = createHmac("sha256", secret).update(data).digest();
  return toBase64url(buf);
}

// --- Public API ---

/** Generate a signed token (Node.js runtime only — used in API routes) */
export function generateToken(): string {
  const payload = { iat: Date.now(), exp: Date.now() + TOKEN_TTL };
  const payloadB64 = toBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = hmacSignSync(payloadB64, getSecret());
  return `${payloadB64}.${sig}`;
}

/** Verify token — async, works in both Edge and Node.js runtimes */
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

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
