import { describe, expect, it } from "vitest";
import {
  FixedWindowRateLimiter,
  normalizeClientIp,
} from "@/lib/rate-limit";

describe("normalizeClientIp", () => {
  it("prefers first valid x-forwarded-for ip", () => {
    const headers = new Headers({
      "x-forwarded-for": " 192.168.1.10:8080, 10.0.0.1 ",
      "x-real-ip": "172.16.0.1",
    });
    expect(normalizeClientIp(headers)).toBe("192.168.1.10");
  });

  it("falls back to x-real-ip when x-forwarded-for is invalid", () => {
    const headers = new Headers({
      "x-forwarded-for": "not-an-ip",
      "x-real-ip": "2001:db8::1",
    });
    expect(normalizeClientIp(headers)).toBe("2001:db8::1");
  });

  it("returns unknown when no valid ip is available", () => {
    const headers = new Headers();
    expect(normalizeClientIp(headers)).toBe("unknown");
  });
});

describe("FixedWindowRateLimiter", () => {
  it("limits after max attempts in window", () => {
    const limiter = new FixedWindowRateLimiter({
      windowMs: 1000,
      maxAttempts: 2,
      maxKeys: 100,
    });

    expect(limiter.hit("ip-1", 1000).limited).toBe(false);
    expect(limiter.hit("ip-1", 1001).limited).toBe(false);
    expect(limiter.hit("ip-1", 1002).limited).toBe(true);
  });

  it("resets after window expires", () => {
    const limiter = new FixedWindowRateLimiter({
      windowMs: 1000,
      maxAttempts: 1,
      maxKeys: 100,
    });

    expect(limiter.hit("ip-1", 1000).limited).toBe(false);
    expect(limiter.hit("ip-1", 1001).limited).toBe(true);
    expect(limiter.hit("ip-1", 2002).limited).toBe(false);
  });

  it("enforces max key bound", () => {
    const limiter = new FixedWindowRateLimiter({
      windowMs: 10000,
      maxAttempts: 5,
      maxKeys: 2,
      cleanupIntervalMs: 1,
    });

    limiter.hit("ip-1", 1000);
    limiter.hit("ip-2", 1001);
    limiter.hit("ip-3", 1002);

    expect(limiter.size()).toBe(2);
  });
});
