import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("rename migration mapping", () => {
  it("包含 material_type/material 到 material/variant 的映射", () => {
    const migrationPath = resolve(
      process.cwd(),
      "prisma/migrations/20260226213500_rename_filament_spool_breaking/migration.sql"
    );
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain('COALESCE("material_type", \'\')');
    expect(sql).toContain('COALESCE("material", \'\')');
    expect(sql).toContain('"filament_id" TEXT NOT NULL');
    expect(sql).toContain('REFERENCES "Filament" ("id")');
  });

  it("schema 已切换为 Filament + material/variant", () => {
    const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");
    const schema = readFileSync(schemaPath, "utf-8");

    expect(schema).toContain("model Filament {");
    expect(schema).not.toContain("model GlobalFilament {");
    expect(schema).toMatch(/\n\s+material\s+String/);
    expect(schema).toMatch(/\n\s+variant\s+String/);
  });
});
