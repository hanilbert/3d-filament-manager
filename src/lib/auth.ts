import { v4 as uuidv4 } from "uuid";

const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// 使用 global 持久化 tokenStore，防止 Next.js 热重载时 Map 被重置
// 生产环境行为不变（进程级单例），开发环境热重载后 token 仍有效
declare global {
  // eslint-disable-next-line no-var
  var __spoolTokenStore: Map<string, number> | undefined;
}
if (!global.__spoolTokenStore) {
  global.__spoolTokenStore = new Map<string, number>();
}
const tokenStore: Map<string, number> = global.__spoolTokenStore;

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
