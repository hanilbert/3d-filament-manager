import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();
const transactionMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: queryRawMock,
    $transaction: transactionMock,
    filament: {
      upsert: upsertMock,
    },
  },
}));

async function importDataRepairModule() {
  return import("@/lib/data-repair");
}

describe("data-repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 0 and skips transaction when no orphan spool filaments exist", async () => {
    queryRawMock.mockResolvedValueOnce([]);

    const { repairOrphanSpoolFilaments } = await importDataRepairModule();
    const repaired = await repairOrphanSpoolFilaments();

    expect(repaired).toBe(0);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("repairs orphan filaments and returns repaired row count", async () => {
    queryRawMock.mockResolvedValueOnce([
      { filament_id: "fil-1" },
      { filament_id: "fil-2" },
    ]);
    upsertMock.mockImplementation((payload: unknown) => payload);
    transactionMock.mockResolvedValueOnce(undefined);

    const { repairOrphanSpoolFilaments } = await importDataRepairModule();
    const repaired = await repairOrphanSpoolFilaments();

    expect(repaired).toBe(2);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "fil-1" },
        update: {},
        create: expect.objectContaining({
          id: "fil-1",
          brand: "Recovered",
          material: "UNKNOWN",
          variant: "",
          color_name: "待核对",
          color_hex: "#9CA3AF",
        }),
      })
    );
    expect(upsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "fil-2" },
      })
    );
    expect(transactionMock).toHaveBeenCalledTimes(1);
    const txOperations = transactionMock.mock.calls[0][0] as unknown[];
    expect(txOperations).toHaveLength(2);
  });

  it("uses TTL debounce to skip repeated repairs within 5 minutes", async () => {
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000_000)
      .mockReturnValueOnce(1_000_000)
      .mockReturnValueOnce(1_000_000 + 60_000);
    queryRawMock.mockResolvedValueOnce([]);

    const { ensureOrphanSpoolFilamentsRepaired } = await importDataRepairModule();

    await expect(ensureOrphanSpoolFilamentsRepaired()).resolves.toBe(0);
    await expect(ensureOrphanSpoolFilamentsRepaired()).resolves.toBe(0);

    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("reuses in-flight repair promise for concurrent calls", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000_000);

    let resolveRows!: (rows: Array<{ filament_id: string }>) => void;
    queryRawMock.mockReturnValueOnce(
      new Promise<Array<{ filament_id: string }>>((resolve) => {
        resolveRows = resolve;
      })
    );

    const { ensureOrphanSpoolFilamentsRepaired } = await importDataRepairModule();

    const first = ensureOrphanSpoolFilamentsRepaired();
    const second = ensureOrphanSpoolFilamentsRepaired();

    // 两次并发调用应共享同一 in-flight Promise，底层只查询一次
    expect(queryRawMock).toHaveBeenCalledTimes(1);

    resolveRows([]);

    const [r1, r2] = await Promise.all([first, second]);
    expect(r1).toBe(0);
    expect(r2).toBe(0);
    // in-flight 完成后 lastRepairAt 已更新，TTL 内不会再次查询
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("clears in-flight state after failure so subsequent calls can retry", async () => {
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(3_000_000)
      .mockReturnValueOnce(3_000_100);

    queryRawMock
      .mockRejectedValueOnce(new Error("query failed"))
      .mockResolvedValueOnce([]);

    const { ensureOrphanSpoolFilamentsRepaired } = await importDataRepairModule();

    await expect(ensureOrphanSpoolFilamentsRepaired()).rejects.toThrow(
      "query failed"
    );
    await expect(ensureOrphanSpoolFilamentsRepaired()).resolves.toBe(0);

    expect(queryRawMock).toHaveBeenCalledTimes(2);
  });
});
