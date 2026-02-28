import { describe, expect, it } from "vitest";
import {
  filamentPatchSchema,
  locationCreateSchema,
  loginBodySchema,
  spoolPatchSchema,
} from "@/lib/api-schemas";

describe("api-schemas", () => {
  it("rejects invalid filament patch payload", () => {
    const result = filamentPatchSchema.safeParse({
      brand: 123,
    });
    expect(result.success).toBe(false);
  });

  it("accepts spool patch payload with metadata object", () => {
    const result = spoolPatchSchema.safeParse({
      status: "ACTIVE",
      location_id: null,
      metadata: { note: "ok" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid location type", () => {
    const result = locationCreateSchema.safeParse({
      name: "A",
      type: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("validates login password length", () => {
    const result = loginBodySchema.safeParse({
      password: "",
    });
    expect(result.success).toBe(false);
  });
});
