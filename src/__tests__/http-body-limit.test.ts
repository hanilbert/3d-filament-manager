import { describe, expect, it } from "vitest";
import { readJsonWithLimit } from "@/lib/http";

describe("readJsonWithLimit", () => {
  it("parses valid json within limit", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      headers: { "content-type": "application/json" },
    });

    const result = await readJsonWithLimit<{ a: number }>(request, {
      maxBytes: 1024,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.a).toBe(1);
    }
  });

  it("returns 413 when content-length exceeds limit", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ a: "x" }),
      headers: {
        "content-type": "application/json",
        "content-length": "9999",
      },
    });

    const result = await readJsonWithLimit(request, { maxBytes: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
    }
  });

  it("returns 413 when streamed body exceeds limit", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ a: "this-is-too-large" }),
      headers: { "content-type": "application/json" },
    });

    const result = await readJsonWithLimit(request, { maxBytes: 8 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
    }
  });

  it("returns 400 for invalid json", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "{invalid json}",
      headers: { "content-type": "application/json" },
    });

    const result = await readJsonWithLimit(request, { maxBytes: 1024 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });
});
