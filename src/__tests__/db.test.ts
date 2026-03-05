import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const existsSyncMock = vi.fn();
const prismaClientConstructorMock = vi.fn(function PrismaClientMock(
  options: unknown
) {
  return { __options: options };
});

vi.mock("node:fs", () => ({
  default: { existsSync: existsSyncMock },
  existsSync: existsSyncMock,
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: prismaClientConstructorMock,
}));

const globalWithPrisma = globalThis as unknown as { prisma?: unknown };
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalNodeEnv = process.env.NODE_ENV;
const originalGlobalPrisma = globalWithPrisma.prisma;

async function importDbModule() {
  return import("@/lib/db");
}

function lastConfiguredDbUrl(): string | undefined {
  const calls = prismaClientConstructorMock.mock.calls;
  const lastCall = calls[calls.length - 1];
  const options = lastCall?.[0] as
    | { datasources?: { db?: { url?: string } } }
    | undefined;
  return options?.datasources?.db?.url;
}

describe("lib/db initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    delete globalWithPrisma.prisma;
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    globalWithPrisma.prisma = originalGlobalPrisma;
  });

  it("passes undefined datasource url when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = "test";

    await importDbModule();

    expect(prismaClientConstructorMock).toHaveBeenCalledTimes(1);
    expect(lastConfiguredDbUrl()).toBeUndefined();
    expect(existsSyncMock).not.toHaveBeenCalled();
  });

  it("normalizes relative sqlite urls to absolute file paths", async () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "file:./prisma/data/dev.db";

    await importDbModule();

    expect(lastConfiguredDbUrl()).toBe(
      `file:${path.resolve(process.cwd(), "./prisma/data/dev.db")}`
    );
  });

  it("keeps non-sqlite urls unchanged", async () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://localhost:5432/spool";

    await importDbModule();

    expect(lastConfiguredDbUrl()).toBe("postgresql://localhost:5432/spool");
    expect(existsSyncMock).not.toHaveBeenCalled();
  });

  it("uses local sqlite fallback in non-production when /app database is missing", async () => {
    const fallbackPath = path.resolve(process.cwd(), "./data/spool_tracker.db");
    existsSyncMock.mockImplementation((fsPath: string) => fsPath === fallbackPath);

    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "file:/app/prisma/data/dev.db";

    await importDbModule();

    expect(lastConfiguredDbUrl()).toBe(`file:${fallbackPath}`);
    expect(existsSyncMock).toHaveBeenCalledWith("/app/prisma/data/dev.db");
  });

  it("does not apply fallback in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "file:/app/prisma/data/dev.db";

    await importDbModule();

    expect(lastConfiguredDbUrl()).toBe("file:/app/prisma/data/dev.db");
    expect(existsSyncMock).not.toHaveBeenCalled();
  });

  it("keeps configured /app sqlite url when file exists", async () => {
    existsSyncMock.mockImplementation((fsPath: string) => fsPath === "/app/live.db");

    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "file:/app/live.db";

    await importDbModule();

    expect(lastConfiguredDbUrl()).toBe("file:/app/live.db");
    expect(existsSyncMock).toHaveBeenCalledTimes(1);
    expect(existsSyncMock).toHaveBeenCalledWith("/app/live.db");
  });
});
