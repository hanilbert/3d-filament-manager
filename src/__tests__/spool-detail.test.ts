import { describe, expect, it, vi } from "vitest";
import { withFallbackFilamentLogo } from "@/lib/spool-detail";

describe("withFallbackFilamentLogo", () => {
  it("当线轴耗材缺少 logo 时回填品牌共享 logo", async () => {
    const spool = {
      id: "spool-1",
      filament_id: "filament-1",
      filament: {
        id: "filament-1",
        brand: "Bambu",
        logo_url: null,
      },
    };

    const result = await withFallbackFilamentLogo(spool, async () => "https://cdn.test/logo.png");

    expect(result.filament.logo_url).toBe("https://cdn.test/logo.png");
    expect(result.id).toBe("spool-1");
    expect(result.filament_id).toBe("filament-1");
    expect(result.filament.id).toBe("filament-1");
  });

  it("当已存在 logo 时不再调用回填函数", async () => {
    const resolveLogo = vi.fn(async () => "https://cdn.test/logo.png");
    const spool = {
      id: "spool-2",
      filament_id: "filament-2",
      filament: {
        id: "filament-2",
        brand: "Bambu",
        logo_url: "https://cdn.test/exist.png",
      },
    };

    const result = await withFallbackFilamentLogo(spool, resolveLogo);

    expect(result.filament.logo_url).toBe("https://cdn.test/exist.png");
    expect(resolveLogo).not.toHaveBeenCalled();
  });

  it("回填函数找不到 logo 时保持原数据", async () => {
    const spool = {
      id: "spool-3",
      filament_id: "filament-3",
      filament: {
        id: "filament-3",
        brand: "Bambu",
        logo_url: null,
      },
    };

    const result = await withFallbackFilamentLogo(spool, async () => null);
    expect(result).toEqual(spool);
  });
});
