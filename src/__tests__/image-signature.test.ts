import { describe, expect, it } from "vitest";
import { detectImageExtension } from "@/lib/image-signature";

describe("detectImageExtension", () => {
  it("识别 JPEG 签名", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x11]);
    expect(detectImageExtension(bytes)).toBe("jpg");
  });

  it("识别 PNG 签名", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageExtension(bytes)).toBe("png");
  });

  it("识别 WEBP 签名", () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
    ]);
    expect(detectImageExtension(bytes)).toBe("webp");
  });

  it("未知签名返回 null", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(detectImageExtension(bytes)).toBeNull();
  });
});
