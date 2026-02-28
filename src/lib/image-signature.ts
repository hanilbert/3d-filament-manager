const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46]; // RIFF
const WEBP_WEBP = [0x57, 0x45, 0x42, 0x50]; // WEBP

function hasSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

export type ImageExtension = "jpg" | "png" | "webp";

export function detectImageExtension(bytes: Uint8Array): ImageExtension | null {
  if (hasSignature(bytes, JPEG_SIGNATURE)) return "jpg";
  if (hasSignature(bytes, PNG_SIGNATURE)) return "png";
  if (hasSignature(bytes, WEBP_RIFF) && hasSignature(bytes, WEBP_WEBP, 8)) return "webp";
  return null;
}
