import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    filament: {
      findFirst: findFirstMock,
    },
  },
}));

async function importBrandLogoModule() {
  return import("@/lib/brand-logo");
}

describe("invalidateBrandLogoCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("clears all cached entries when called without brand", async () => {
    const { findSharedBrandLogoUrl, invalidateBrandLogoCache } =
      await importBrandLogoModule();

    findFirstMock
      .mockResolvedValueOnce({ logo_url: "https://cdn/logo-a.png" })
      .mockResolvedValueOnce({ logo_url: "https://cdn/logo-b.png" });

    await expect(findSharedBrandLogoUrl("Anycubic")).resolves.toBe(
      "https://cdn/logo-a.png"
    );
    await expect(findSharedBrandLogoUrl("Anycubic")).resolves.toBe(
      "https://cdn/logo-a.png"
    );
    expect(findFirstMock).toHaveBeenCalledTimes(1);

    invalidateBrandLogoCache();

    await expect(findSharedBrandLogoUrl("Anycubic")).resolves.toBe(
      "https://cdn/logo-b.png"
    );
    expect(findFirstMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates only matching brand keys including different excludeId variants", async () => {
    const { findSharedBrandLogoUrl, invalidateBrandLogoCache } =
      await importBrandLogoModule();

    findFirstMock.mockImplementation(async (args: { where: { brand: { equals: string }; NOT?: { id: string } } }) => ({
      logo_url: `${args.where.brand.equals}-${args.where.NOT?.id ?? "none"}`,
    }));

    await findSharedBrandLogoUrl("Alpha");
    await findSharedBrandLogoUrl("Alpha", "exclude-1");
    const betaFirst = await findSharedBrandLogoUrl("Beta");
    await findSharedBrandLogoUrl("Beta");
    expect(findFirstMock).toHaveBeenCalledTimes(3);

    invalidateBrandLogoCache("Alpha");

    await findSharedBrandLogoUrl("Alpha");
    await findSharedBrandLogoUrl("Alpha", "exclude-1");
    const betaSecond = await findSharedBrandLogoUrl("Beta");

    expect(findFirstMock).toHaveBeenCalledTimes(5);
    expect(betaSecond).toBe(betaFirst);
    expect(findFirstMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { id: "exclude-1" },
        }),
      })
    );
  });

  it("ignores empty brand input when invalidating", async () => {
    const { findSharedBrandLogoUrl, invalidateBrandLogoCache } =
      await importBrandLogoModule();

    findFirstMock.mockResolvedValue({ logo_url: "https://cdn/logo.png" });

    await expect(findSharedBrandLogoUrl("Bambu Lab")).resolves.toBe(
      "https://cdn/logo.png"
    );
    expect(findFirstMock).toHaveBeenCalledTimes(1);

    invalidateBrandLogoCache("   ");

    await expect(findSharedBrandLogoUrl("Bambu Lab")).resolves.toBe(
      "https://cdn/logo.png"
    );
    expect(findFirstMock).toHaveBeenCalledTimes(1);
  });

  it("trims brand name before invalidating", async () => {
    const { findSharedBrandLogoUrl, invalidateBrandLogoCache } =
      await importBrandLogoModule();

    findFirstMock.mockResolvedValue({ logo_url: "https://cdn/esun.png" });

    await findSharedBrandLogoUrl("eSUN");
    expect(findFirstMock).toHaveBeenCalledTimes(1);

    invalidateBrandLogoCache("  eSUN  ");
    await findSharedBrandLogoUrl("eSUN");

    expect(findFirstMock).toHaveBeenCalledTimes(2);
  });
});
