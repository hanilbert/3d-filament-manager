import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// logger 模块在导入时读取 process.env，需在导入前设置环境变量

describe("logger - 测试环境静默", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("NODE_ENV=test 时不输出任何内容", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.resetModules();

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const { logger } = await import("@/lib/logger");
    logger.error("test-context", "should be silent");
    logger.info("test-context", "should be silent");

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});

describe("logger - 日志级别过滤", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("LOG_LEVEL=warn 时 debug/info 不输出，warn/error 输出", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", "warn");
    vi.resetModules();

    const { logger } = await import("@/lib/logger");

    logger.debug("ctx", "debug message");
    logger.info("ctx", "info message");
    expect(stdoutSpy).not.toHaveBeenCalled();

    logger.warn("ctx", "warn message");
    expect(stdoutSpy).toHaveBeenCalledTimes(1);

    logger.error("ctx", "error message");
    expect(stdoutSpy).toHaveBeenCalledTimes(2);
  });

  it("LOG_LEVEL=debug 时所有级别均输出", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.resetModules();

    const { logger } = await import("@/lib/logger");

    logger.debug("ctx", "d");
    logger.info("ctx", "i");
    logger.warn("ctx", "w");
    logger.error("ctx", "e");
    expect(stdoutSpy).toHaveBeenCalledTimes(4);
  });

  it("无效 LOG_LEVEL 回退为 info", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", "invalid_level");
    vi.resetModules();

    const { logger } = await import("@/lib/logger");

    logger.debug("ctx", "debug should be filtered");
    expect(stdoutSpy).not.toHaveBeenCalled();

    logger.info("ctx", "info should pass");
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
  });
});

describe("logger - 生产环境 JSON 格式", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.unmock("fs");
  });

  it("生产环境输出有效 JSON 且包含必要字段", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");
    vi.resetModules();

    vi.mock("fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("fs")>();
      return {
        ...actual,
        mkdirSync: vi.fn(),
        appendFileSync: vi.fn(),
      };
    });

    const stdoutLines: string[] = [];
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutLines.push(String(chunk).trim());
      return true;
    });

    const { logger } = await import("@/lib/logger");
    logger.info("api/spools", "GET success", { count: 3 });

    expect(stdoutLines.length).toBeGreaterThan(0);
    const record = JSON.parse(stdoutLines[0]);
    expect(record).toMatchObject({
      level: "info",
      context: "api/spools",
      message: "GET success",
    });
    expect(record.timestamp).toBeTruthy();
    expect(record.pid).toBeTypeOf("number");

    stdoutSpy.mockRestore();
  });
});

describe("logger - 敏感字段脱敏", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("meta 中的 password/token/authorization 字段被替换为 [REDACTED]", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.resetModules();

    const outputs: string[] = [];
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      outputs.push(String(chunk));
      return true;
    });

    const { logger } = await import("@/lib/logger");
    logger.error("api/auth", "login failed", {
      password: "mysecret",
      token: "my-jwt-token",
      authorization: "Bearer xyz",
      userId: "user-123",
    });

    expect(outputs.length).toBeGreaterThan(0);
    const output = outputs[0];
    expect(output).not.toContain("mysecret");
    expect(output).not.toContain("my-jwt-token");
    expect(output).not.toContain("Bearer xyz");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("user-123");

    stdoutSpy.mockRestore();
  });
});

describe("logger - 循环引用/不可序列化 meta 安全处理", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("meta 含循环引用时不抛错", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.resetModules();

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    const { logger } = await import("@/lib/logger");

    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;

    expect(() => {
      logger.error("ctx", "circular ref test", { data: circular });
    }).not.toThrow();

    stdoutSpy.mockRestore();
  });
});
