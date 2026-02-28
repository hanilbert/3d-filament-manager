import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  filament: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  location: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/api-auth", () => ({
  requireAuth: vi.fn(async () => null),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("route behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when filament patch payload has invalid field type", async () => {
    const { PATCH } = await import("@/app/api/filaments/[id]/route");

    const req = new Request("http://localhost/api/filaments/abc", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brand: 123 }),
    });

    const res = await PATCH(req as never, {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(res.status).toBe(400);
    expect(mockPrisma.filament.findUnique).not.toHaveBeenCalled();
  });

  it("returns picker-only payload for /api/locations?view=picker", async () => {
    mockPrisma.location.findMany.mockResolvedValueOnce([
      { id: "loc-1", name: "机架A", type: "custom" },
    ]);

    const { GET } = await import("@/app/api/locations/route");
    const req = new Request("http://localhost/api/locations?view=picker");
    const res = await GET(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.location.findMany).toHaveBeenCalledTimes(1);
    expect(json).toEqual([{ id: "loc-1", name: "机架A", type: "custom" }]);
  });

  it("does not trigger orphan repair in spools GET routes", () => {
    const routeFile = readFileSync(
      resolve(process.cwd(), "src/app/api/spools/route.ts"),
      "utf-8"
    );
    const routeByIdFile = readFileSync(
      resolve(process.cwd(), "src/app/api/spools/[id]/route.ts"),
      "utf-8"
    );

    expect(routeFile.includes("ensureOrphanSpoolFilamentsRepaired(")).toBe(false);
    expect(routeByIdFile.includes("ensureOrphanSpoolFilamentsRepaired(")).toBe(
      false
    );
  });
});
