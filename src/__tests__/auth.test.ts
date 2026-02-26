import { describe, it, expect, beforeEach } from "vitest";
import { generateToken, verifyToken, extractBearerToken, TOKEN_TTL } from "@/lib/auth";

// Set required env var for tests
beforeEach(() => {
  process.env.TOKEN_SECRET = "test-secret-for-unit-tests";
});

describe("extractBearerToken", () => {
  it("extracts token from valid Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("returns null for null header", () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it("returns null for non-Bearer header", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractBearerToken("")).toBeNull();
  });
});

describe("generateToken + verifyToken", () => {
  it("generates a valid token that passes verification", async () => {
    const token = generateToken();
    expect(token).toContain(".");
    const valid = await verifyToken(token);
    expect(valid).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const token = generateToken();
    const tampered = token.slice(0, -3) + "xxx";
    const valid = await verifyToken(tampered);
    expect(valid).toBe(false);
  });

  it("rejects a token with wrong format", async () => {
    expect(await verifyToken("notavalidtoken")).toBe(false);
    expect(await verifyToken("")).toBe(false);
  });

  it("TOKEN_TTL is 7 days in ms", () => {
    expect(TOKEN_TTL).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
