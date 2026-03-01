/**
 * 统一结构化日志模块
 *
 * 环境行为：
 * - test：完全静默
 * - development：人类可读格式 → stdout
 * - production：JSON 格式 → stdout + /app/data/logs/app.log
 *
 * 日志级别（LOG_LEVEL 环境变量控制，默认 "info"）：
 *   debug < info < warn < error
 *
 * 注意：此模块仅供服务端使用（依赖 Node.js fs/os 模块）。
 */

import fs from "fs";
import path from "path";
import os from "os";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMeta = Record<string, unknown>;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const VALID_LEVELS = new Set<string>(["debug", "info", "warn", "error"]);

function parseLogLevel(input: string | undefined, fallback: LogLevel): LogLevel {
  if (input && VALID_LEVELS.has(input)) return input as LogLevel;
  return fallback;
}

// ─── 敏感字段脱敏 ────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  "password",
  "passwd",
  "token",
  "secret",
  "authorization",
  "cookie",
  "set-cookie",
  "x-auth-token",
  "api_key",
  "apikey",
]);

function redactMeta(meta: LogMeta | undefined): LogMeta | undefined {
  if (!meta) return undefined;
  const result: LogMeta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      result[k] = "[REDACTED]";
    } else if (v instanceof Error || (typeof v === "object" && v !== null && "message" in v)) {
      result[k] = serializeError(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export interface SerializedError {
  name?: string;
  message: string;
  stack?: string;
  code?: string;
}

function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: (err as NodeJS.ErrnoException).code,
    };
  }
  return { message: String(err) };
}

// ─── JSON 安全序列化 ─────────────────────────────────────────────────────────

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    try {
      return JSON.stringify(String(value));
    } catch {
      return '"[unserializable]"';
    }
  }
}

// ─── 生产环境文件写入 ───────────────────────────────────────────────────────

const LOG_FILE_PATH = "/app/data/logs/app.log";
let logDirReady = false;
let logDirFailed = false;

function ensureLogDir(): boolean {
  if (logDirReady) return true;
  if (logDirFailed) return false;
  try {
    fs.mkdirSync(path.dirname(LOG_FILE_PATH), { recursive: true });
    logDirReady = true;
    return true;
  } catch (err) {
    logDirFailed = true;
    // 降级告警：目录创建失败时输出到 stderr
    try {
      process.stderr.write(`[logger] 无法创建日志目录，文件写入已禁用: ${String(err)}\n`);
    } catch {
      // ignore
    }
    return false;
  }
}

// 防递归标记：写入日志时若失败，用 stderr 降级，但不再调用 logger
let _writeFailing = false;

function writeToFile(line: string): void {
  if (!ensureLogDir()) return;
  try {
    fs.appendFileSync(LOG_FILE_PATH, line + "\n");
  } catch (err) {
    if (!_writeFailing) {
      _writeFailing = true;
      try {
        process.stderr.write(`[logger] 写入日志文件失败，降级至 stderr: ${String(err)}\n`);
        process.stderr.write(line + "\n");
      } catch {
        // ignore
      }
      _writeFailing = false;
    }
  }
}

// ─── 格式化 ────────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";

function formatDev(level: LogLevel, context: string, message: string, meta?: LogMeta): string {
  const ts = new Date().toISOString();
  const color = LEVEL_COLOR[level];
  const lvl = `${color}${level.toUpperCase().padEnd(5)}${RESET}`;
  const metaStr = meta ? " " + safeJsonStringify(meta) : "";
  return `[${ts}] ${lvl} [${context}] ${message}${metaStr}`;
}

function formatProd(level: LogLevel, context: string, message: string, meta?: LogMeta): string {
  const record: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    pid: process.pid,
    hostname: os.hostname(),
  };
  if (meta) record.meta = meta;
  return safeJsonStringify(record);
}

// ─── Logger 核心 ────────────────────────────────────────────────────────────

function createLog(
  env: string,
  minLevel: LogLevel,
): (level: LogLevel, context: string, message: string, meta?: LogMeta) => void {
  const isTest = env === "test";
  const isProd = env === "production";
  const minRank = LEVEL_RANK[minLevel];

  return function log(level: LogLevel, context: string, message: string, meta?: LogMeta): void {
    if (isTest) return;
    if (LEVEL_RANK[level] < minRank) return;

    const redacted = redactMeta(meta);

    if (isProd) {
      const line = formatProd(level, context, message, redacted);
      try {
        process.stdout.write(line + "\n");
      } catch {
        // ignore stdout failure
      }
      writeToFile(line);
    } else {
      const line = formatDev(level, context, message, redacted);
      try {
        process.stdout.write(line + "\n");
      } catch {
        // ignore stdout failure
      }
    }
  };
}

const _env = process.env.NODE_ENV ?? "development";
const _minLevel = parseLogLevel(process.env.LOG_LEVEL, "info");
const _log = createLog(_env, _minLevel);

export const logger = {
  debug: (context: string, message: string, meta?: LogMeta) => _log("debug", context, message, meta),
  info:  (context: string, message: string, meta?: LogMeta) => _log("info",  context, message, meta),
  warn:  (context: string, message: string, meta?: LogMeta) => _log("warn",  context, message, meta),
  error: (context: string, message: string, meta?: LogMeta) => _log("error", context, message, meta),
};
