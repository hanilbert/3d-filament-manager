import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checkedFiles = [
  "src/components/SideNav.tsx",
  "src/components/BottomNav.tsx",
  "src/app/spools/page.tsx",
  "src/app/location/[id]/page.tsx",
  "src/app/filaments/materials/page.tsx",
];

describe("global naming consistency", () => {
  it("关键页面不再出现旧术语和错误标签", () => {
    for (const file of checkedFiles) {
      const content = readFileSync(resolve(process.cwd(), file), "utf-8");
      expect(content).not.toContain("料卷");
      expect(content).not.toContain("# 线轴");
    }
  });

  it("核心列表使用线轴数命名", () => {
    const spoolsPage = readFileSync(resolve(process.cwd(), "src/app/spools/page.tsx"), "utf-8");
    const materialsPage = readFileSync(resolve(process.cwd(), "src/app/filaments/materials/page.tsx"), "utf-8");

    expect(spoolsPage).toContain("线轴数");
    expect(materialsPage).toContain("线轴数");
  });
});
