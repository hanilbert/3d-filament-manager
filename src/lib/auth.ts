import { v4 as uuidv4 } from "uuid";

const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// In-memory token store: token -> expiry timestamp
const tokenStore = new Map<string, number>();

export function generateToken(): string {
  const token = uuidv4();
  tokenStore.set(token, Date.now() + TOKEN_TTL);
  return token;
}

export function verifyToken(token: string): boolean {
  const expiry = tokenStore.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    tokenStore.delete(token);
    return false;
  }
  return true;
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
