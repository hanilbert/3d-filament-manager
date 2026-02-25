"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRScanner } from "@/components/QRScanner";
import { apiFetch } from "@/lib/fetch";
import { isValidUpcGtin, normalizeUpcGtin } from "@/lib/upc-gtin";

interface ActiveSpool {
  id: string;
  globalFilament: {
    brand: string;
    material: string;
    material_type?: string | null;
    color_name: string;
  };
  location: { id: string; name: string } | null;
}

interface CatalogLookupItem {
  id: string;
}

interface GlobalScanDialogProps {
  trigger: ReactNode;
}

type ScanStep = "scan" | "pick-spool" | "barcode-not-found";

const UUID_REGEX = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SPOOL_PATH_RE = new RegExp(`/spool/(${UUID_REGEX})(?:[/?#]|$)`, "i");
const LOCATION_PATH_RE = new RegExp(`/location/(${UUID_REGEX})(?:[/?#]|$)`, "i");
const UUID_ONLY_RE = new RegExp(`^(${UUID_REGEX})$`, "i");

function parseScanTarget(rawText: string):
  | { type: "spool"; spoolId: string }
  | { type: "location"; locationId: string }
  | { type: "upc_gtin"; upcGtin: string }
  | { type: "unknown" } {
  const text = rawText.trim();

  try {
    const pathname = new URL(text).pathname;
    const spoolMatch = pathname.match(SPOOL_PATH_RE);
    if (spoolMatch?.[1]) return { type: "spool", spoolId: spoolMatch[1] };

    const locationMatch = pathname.match(LOCATION_PATH_RE);
    if (locationMatch?.[1]) return { type: "location", locationId: locationMatch[1] };
  } catch {
    // 非 URL 内容继续按路径/纯文本解析
  }

  const spoolMatch = text.match(SPOOL_PATH_RE);
  if (spoolMatch?.[1]) return { type: "spool", spoolId: spoolMatch[1] };

  const locationMatch = text.match(LOCATION_PATH_RE);
  if (locationMatch?.[1]) return { type: "location", locationId: locationMatch[1] };

  const uuidMatch = text.match(UUID_ONLY_RE);
  if (uuidMatch?.[1]) return { type: "location", locationId: uuidMatch[1] };

  const normalizedUpcGtin = normalizeUpcGtin(text);
  if (isValidUpcGtin(normalizedUpcGtin)) {
    return { type: "upc_gtin", upcGtin: normalizedUpcGtin };
  }

  return { type: "unknown" };
}

export function GlobalScanDialog({ trigger }: GlobalScanDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ScanStep>("scan");
  const [scannerKey, setScannerKey] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [processing, setProcessing] = useState(false);
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const [activeSpools, setActiveSpools] = useState<ActiveSpool[]>([]);
  const [loadingSpools, setLoadingSpools] = useState(false);
  const [assigningSpoolId, setAssigningSpoolId] = useState<string | null>(null);
  const [missingUpcGtin, setMissingUpcGtin] = useState<string | null>(null);

  function resetDialogState() {
    setStep("scan");
    setScannerKey(0);
    setStatusMsg("");
    setErrorMsg("");
    setProcessing(false);
    setPendingLocationId(null);
    setActiveSpools([]);
    setLoadingSpools(false);
    setAssigningSpoolId(null);
    setMissingUpcGtin(null);
  }

  function restartScanner(clearMessages = true) {
    setStep("scan");
    if (clearMessages) {
      setStatusMsg("");
      setErrorMsg("");
    }
    setPendingLocationId(null);
    setActiveSpools([]);
    setMissingUpcGtin(null);
    setScannerKey((prev) => prev + 1);
  }

  useEffect(() => {
    if (!open) {
      resetDialogState();
    }
  }, [open]);

  async function handleScanResult(text: string) {
    if (processing) return;
    setProcessing(true);
    setStatusMsg("");
    setErrorMsg("");

    const target = parseScanTarget(text);

    if (target.type === "spool") {
      setOpen(false);
      router.push(`/spool/${target.spoolId}`);
      return;
    }

    if (target.type === "location") {
      setPendingLocationId(target.locationId);
      setLoadingSpools(true);
      try {
        const spools = await apiFetch<ActiveSpool[]>("/api/spools?status=ACTIVE");
        setActiveSpools(spools);
        setStep("pick-spool");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "加载线轴失败，请重试");
        restartScanner(false);
      } finally {
        setLoadingSpools(false);
        setProcessing(false);
      }
      return;
    }

    if (target.type === "upc_gtin") {
      try {
        const items = await apiFetch<CatalogLookupItem[]>(
          `/api/catalog?upc_gtin=${encodeURIComponent(target.upcGtin)}`
        );
        if (items.length > 0) {
          setOpen(false);
          router.push(`/catalog/${items[0].id}`);
          return;
        }
        setMissingUpcGtin(target.upcGtin);
        setStatusMsg(`数据库未收录 UPC/GTIN：${target.upcGtin}`);
        setStep("barcode-not-found");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "UPC/GTIN 查询失败，请重试");
        restartScanner(false);
      } finally {
        setProcessing(false);
      }
      return;
    }

    setErrorMsg("无法识别的二维码/条码");
    setProcessing(false);
    setScannerKey((prev) => prev + 1);
  }

  async function handleAssignLocation(spoolId: string) {
    if (!pendingLocationId) {
      setErrorMsg("缺少位置信息，请重新扫码");
      restartScanner();
      return;
    }

    setAssigningSpoolId(spoolId);
    setErrorMsg("");

    try {
      await apiFetch(`/api/spools/${spoolId}`, {
        method: "PATCH",
        body: JSON.stringify({ location_id: pendingLocationId }),
      });
      setOpen(false);
      router.push(`/spool/${spoolId}?statusMsg=${encodeURIComponent("位置已更新")}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "分配位置失败，请重试");
    } finally {
      setAssigningSpoolId(null);
    }
  }

  function handleCreateCatalog() {
    if (!missingUpcGtin) return;
    setOpen(false);
    router.push(`/catalog/new?upc_gtin=${encodeURIComponent(missingUpcGtin)}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>扫描二维码或 UPC/GTIN 条码</DialogTitle>
          <DialogDescription>
            扫描线轴码可直接打开线轴；扫描位置码可将位置分配给线轴；扫描 UPC/GTIN 可查询耗材是否已收录。
          </DialogDescription>
        </DialogHeader>

        {step === "scan" && (
          <div className="space-y-3">
            {statusMsg ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {statusMsg}
              </div>
            ) : null}
            {errorMsg ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            ) : null}
            <QRScanner
              key={scannerKey}
              onResult={handleScanResult}
              onClose={() => setOpen(false)}
              mode="qr-and-barcode"
              onStartError={setErrorMsg}
            />
          </div>
        )}

        {step === "pick-spool" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              已识别位置二维码，请选择要分配该位置的线轴。
            </p>
            {errorMsg ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            ) : null}
            {loadingSpools ? (
              <p className="py-4 text-center text-sm text-muted-foreground">加载线轴中...</p>
            ) : activeSpools.length === 0 ? (
              <p className="rounded-md border border-border px-3 py-6 text-center text-sm text-muted-foreground">
                当前没有 ACTIVE 线轴可分配。
              </p>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                {activeSpools.map((spool) => (
                  <div
                    key={spool.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {spool.globalFilament.brand} ·{" "}
                        {[spool.globalFilament.material_type, spool.globalFilament.material]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {spool.globalFilament.color_name} · 当前：{spool.location?.name ?? "未分配"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAssignLocation(spool.id)}
                      disabled={assigningSpoolId !== null}
                    >
                      {assigningSpoolId === spool.id ? "分配中..." : "分配"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" className="w-full" onClick={() => restartScanner()}>
              继续扫码
            </Button>
          </div>
        )}

        {step === "barcode-not-found" && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {statusMsg || "数据库中未找到该 UPC/GTIN"}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" onClick={handleCreateCatalog}>
                去新建耗材
              </Button>
              <Button type="button" variant="outline" onClick={() => restartScanner()}>
                继续扫码
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
