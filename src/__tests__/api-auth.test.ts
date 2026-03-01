import type { NextRequest } from "next/server";
import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  extractBearerToken: vi.fn(),
  verifyToken: vi.fn(),
}));

import { requireAuth } from "@/lib/api-auth";
import { extractBearerToken, verifyToken } from "@/lib/auth";

function makeRequest(options?: {
  authorization?: string;
  authVerified?: string;
  cookieToken?: string;
}): NextRequest {
  const headers = new Headers();
  if (options?.authorization) headers.set("Authorization", options.authorization);
  if (options?.authVerified) headers.set("x-auth-verified", options.authVerified);

  return {
    headers,
    cookies: {
      get: (name: string) =>
        name === "spool_tracker_token" && options?.cookieToken
          ? { value: options.cookieToken }
          : undefined,
    },
  } as unknown as NextRequest;
}

describe("requireAuth", () => {
  const mockExtractBearerToken = vi.mocked(extractBearerToken);
  const mockVerifyToken = vi.mocked(verifyToken);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for valid Bearer token", async () => {
    mockExtractBearerToken.mockReturnValueOnce("valid-bearer");
    mockVerifyToken.mockResolvedValueOnce(true);

    const req = makeRequest({ authorization: "Bearer valid-bearer", cookieToken: "cookie-token" });
    const result = await requireAuth(req);

    expect(result).toBeNull();
    expect(mockExtractBearerToken).toHaveBeenCalledWith("Bearer valid-bearer");
    expect(mockVerifyToken).toHaveBeenCalledWith("valid-bearer");
  });

  it("returns 401 for invalid token", async () => {
    mockExtractBearerToken.mockReturnValueOnce("bad-token");
    mockVerifyToken.mockResolvedValueOnce(false);

    const req = makeRequest({ authorization: "Bearer bad-token" });
    const result = await requireAuth(req);

    expect(result?.status).toBe(401);
    await expect(result?.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("uses cookie token when Bearer token is absent", async () => {
    mockExtractBearerToken.mockReturnValueOnce(null);
    mockVerifyToken.mockResolvedValueOnce(true);

    const req = makeRequest({ cookieToken: "cookie-token" });
    const result = await requireAuth(req);

    expect(result).toBeNull();
    expect(mockVerifyToken).toHaveBeenCalledWith("cookie-token");
  });

  it("skips verification when x-auth-verified=1 and no Bearer token", async () => {
    mockExtractBearerToken.mockReturnValueOnce(null);

    const req = makeRequest({ authVerified: "1", cookieToken: "cookie-token" });
    const result = await requireAuth(req);

    expect(result).toBeNull();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("returns 401 when no token is present", async () => {
    mockExtractBearerToken.mockReturnValueOnce(null);

    const req = makeRequest();
    const result = await requireAuth(req);

    expect(result?.status).toBe(401);
    await expect(result?.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });
});
