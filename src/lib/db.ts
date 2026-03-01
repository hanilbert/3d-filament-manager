import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function sqliteFileExists(databaseUrl: string): boolean {
  if (!databaseUrl.startsWith("file:")) return true;

  const rawPath = databaseUrl.slice("file:".length);
  const fsPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);
  return fs.existsSync(fsPath);
}

function normalizeSqliteFileUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) return databaseUrl;

  const rawPath = databaseUrl.slice("file:".length);
  if (path.isAbsolute(rawPath)) return `file:${rawPath}`;

  const absolutePath = path.resolve(process.cwd(), rawPath);
  return `file:${absolutePath}`;
}

function resolveDatabaseUrl(): string | undefined {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) return undefined;

  const normalizedConfiguredUrl = normalizeSqliteFileUrl(configuredUrl);

  // Allow local development to run with Docker-style DATABASE_URL in .env.
  if (
    process.env.NODE_ENV !== "production" &&
    normalizedConfiguredUrl.startsWith("file:/app/") &&
    !sqliteFileExists(normalizedConfiguredUrl)
  ) {
    const fallbackCandidates = [
      "file:./prisma/data/dev.db",
      "file:./prisma/data/spool_tracker.db",
      "file:./data/spool_tracker.db",
      "file:./prisma/dev.db",
    ].map(normalizeSqliteFileUrl);
    const fallback = fallbackCandidates.find(sqliteFileExists);
    if (fallback) return fallback;
  }

  return normalizedConfiguredUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
  });

// Cache in all environments to prevent connection exhaustion (P-M1)
globalForPrisma.prisma = prisma;
