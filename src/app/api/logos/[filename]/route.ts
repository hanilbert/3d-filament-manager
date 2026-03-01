import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, basename } from "path";

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const LOGO_FILE_RE = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  // 防路径穿越：只取文件名部分
  const safe = basename(filename);
  if (!LOGO_FILE_RE.test(safe)) {
    return NextResponse.json({ error: "无效文件名" }, { status: 400 });
  }
  const ext = safe.split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME_MAP[ext];

  if (!contentType) {
    return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
  }

  try {
    const filePath = join(process.cwd(), "data", "logos", safe);
    const fileStat = await stat(filePath);
    const etag = `W/"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`;
    const lastModified = fileStat.mtime.toUTCString();

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
      "Last-Modified": lastModified,
    };

    // 304 缓存协商：匹配 ETag 时跳过磁盘读取
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    const buffer = await readFile(filePath);
    return new NextResponse(buffer, { headers });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }
    if (process.env.NODE_ENV !== "test") {
      console.error("[api/logos/[filename]] read failed", error);
    }
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
}
