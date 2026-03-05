import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock 会被提升，必须用 vi.hoisted() 确保 mock 变量在提升后也可访问
const { nextMock, jsonMock, redirectMock, extractBearerTokenMock, verifyTokenMock } = vi.hoisted(() => ({
  nextMock: vi.fn(),
  jsonMock: vi.fn(),
  redirectMock: vi.fn(),
  extractBearerTokenMock: vi.fn(),
  verifyTokenMock: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextRequest: class NextRequest {},
  NextResponse: {
    next: nextMock,
    json: jsonMock,
    redirect: redirectMock,
  },
}));

vi.mock("@/lib/auth", () => ({
  extractBearerToken: extractBearerTokenMock,
  verifyToken: verifyTokenMock,
}));

import { middleware } from "@/middleware";

function makeRequest(options: {
  pathname: string;
  authorization?: string;
  authVerified?: string;
  cookieToken?: string;
  url?: string;
}): NextRequest {
  const headers = new Headers();
  if (options.authorization) headers.set("Authorization", options.authorization);
  if (options.authVerified) headers.set("x-auth-verified", options.authVerified);

  return {
    nextUrl: { pathname: options.pathname },
    headers,
    cookies: {
      get: (name: string) => {
        if (name !== "spool_tracker_token") return undefined;
        if (options.cookieToken === undefined) return undefined;
        return { value: options.cookieToken };
      },
    },
    url: options.url ?? `https://app.local${options.pathname}`,
  } as unknown as NextRequest;
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextMock.mockImplementation((init?: unknown) => ({ type: "next", init }));
    jsonMock.mockImplementation((body: unknown, init?: { status?: number }) => ({
      type: "json",
      body,
      status: init?.status ?? 200,
    }));
    redirectMock.mockImplementation((url: URL | string) => ({
      type: "redirect",
      location: typeof url === "string" ? url : url.toString(),
    }));

    extractBearerTokenMock.mockReturnValue(null);
    verifyTokenMock.mockResolvedValue(false);
  });

  it("allows public paths without auth checks", async () => {
    const request = makeRequest({
      pathname: "/login",
      authVerified: "forged",
      authorization: "Bearer some-token",
      cookieToken: "cookie-token",
    });

    await middleware(request);

    expect(nextMock).toHaveBeenCalledTimes(1);
    expect(nextMock).toHaveBeenCalledWith();
    expect(extractBearerTokenMock).not.toHaveBeenCalled();
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it("allows API bearer-token requests and strips forged x-auth-verified header", async () => {
    extractBearerTokenMock.mockReturnValue("api-bearer");

    const request = makeRequest({
      pathname: "/api/spools",
      authorization: "Bearer api-bearer",
      authVerified: "forged",
    });

    await middleware(request);

    expect(extractBearerTokenMock).toHaveBeenCalledWith("Bearer api-bearer");
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(nextMock).toHaveBeenCalledTimes(1);

    const init = nextMock.mock.calls[0][0] as { request: { headers: Headers } };
    expect(init.request.headers.get("Authorization")).toBe("Bearer api-bearer");
    expect(init.request.headers.get("x-auth-verified")).toBeNull();
  });

  it("returns 401 json for API routes when cookie token is invalid", async () => {
    verifyTokenMock.mockResolvedValue(false);

    const request = makeRequest({
      pathname: "/api/private",
      cookieToken: "bad-cookie",
    });

    await middleware(request);

    expect(verifyTokenMock).toHaveBeenCalledWith("bad-cookie");
    expect(jsonMock).toHaveBeenCalledWith(
      { error: "Unauthorized" },
      { status: 401 }
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects page requests to login with relative from path", async () => {
    verifyTokenMock.mockResolvedValue(false);

    const request = makeRequest({
      pathname: "/dashboard",
      cookieToken: "bad-cookie",
    });

    await middleware(request);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    const target = redirectMock.mock.calls[0][0] as URL;
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("from")).toBe("/dashboard");
  });

  it("prevents open redirect by not forwarding non-relative path", async () => {
    verifyTokenMock.mockResolvedValue(false);

    const request = makeRequest({
      pathname: "//evil.example/path",
      cookieToken: "bad-cookie",
      url: "https://app.local//evil.example/path",
    });

    await middleware(request);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    const target = redirectMock.mock.calls[0][0] as URL;
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.has("from")).toBe(false);
  });

  it("marks valid API cookie requests with x-auth-verified=1", async () => {
    verifyTokenMock.mockResolvedValue(true);

    const request = makeRequest({
      pathname: "/api/filaments",
      cookieToken: "good-cookie",
      authVerified: "forged",
    });

    await middleware(request);

    expect(verifyTokenMock).toHaveBeenCalledWith("good-cookie");
    expect(nextMock).toHaveBeenCalledTimes(1);
    expect(jsonMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();

    const init = nextMock.mock.calls[0][0] as { request: { headers: Headers } };
    expect(init.request.headers.get("x-auth-verified")).toBe("1");
  });
});
