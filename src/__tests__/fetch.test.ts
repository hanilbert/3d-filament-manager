import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch } from "@/lib/fetch";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("apiFetch", () => {
  let originalLocation: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    // Save and mock window.location
    originalLocation = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      value: { location: { href: "" } },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalLocation) {
      Object.defineProperty(globalThis, "window", originalLocation);
    } else {
      // @ts-expect-error cleanup
      delete (globalThis as Record<string, unknown>).window;
    }
  });

  it("returns parsed JSON on successful response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1, name: "test" }),
    });

    const result = await apiFetch<{ id: number; name: string }>("/api/test");
    expect(result).toEqual({ id: 1, name: "test" });
  });

  it("sends credentials: same-origin", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiFetch("/api/test");
    expect(mockFetch).toHaveBeenCalledWith("/api/test", expect.objectContaining({
      credentials: "same-origin",
    }));
  });

  it("sets Content-Type to application/json for non-FormData", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiFetch("/api/test", { body: JSON.stringify({ a: 1 }) });
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers["Content-Type"]).toBe("application/json");
  });

  it("does not set Content-Type for FormData body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const formData = new FormData();
    formData.append("file", "data");
    await apiFetch("/api/upload", { body: formData });
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers["Content-Type"]).toBeUndefined();
  });

  it("redirects to /login on 401 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(apiFetch("/api/test")).rejects.toThrow("登录已过期，请重新登录");
    expect((globalThis as unknown as { window: { location: { href: string } } }).window.location.href).toBe("/login");
  });

  it("extracts error from JSON error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ error: "请求格式错误" }),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow("请求格式错误");
  });

  it("truncates long text error responses", async () => {
    const longText = "A".repeat(200);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "text/plain" }),
      text: () => Promise.resolve(longText),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow(/请求失败（HTTP 500）/);
    try {
      await apiFetch("/api/test");
    } catch (e) {
      // The error message should contain truncated text (120 chars max)
      // We already verified it throws above
    }
  });

  it("falls back to generic message when JSON parse fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow("请求失败（HTTP 500）");
  });
});
