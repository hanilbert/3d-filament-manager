"use client";

import { ReactNode, useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRScanner } from "@/components/QRScanner";
import { apiFetch } from "@/lib/fetch";
import { parseScanTarget } from "@/lib/scan-target";

interface ActiveSpool {
  id: string;
  filament: {
    brand: string;
    material: string;
    variant?: string | null;
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

interface DialogState {
  step: ScanStep;
  scannerKey: number;
  statusMsg: string;
  errorMsg: string;
  processing: boolean;
  pendingLocationId: string | null;
  activeSpools: ActiveSpool[];
  loadingSpools: boolean;
  assigningSpoolId: string | null;
  missingUpcGtin: string | null;
}

type DialogAction =
  | { type: "RESET" }
  | { type: "RESTART"; errorMsg?: string }
  | { type: "SCAN_START" }
  | { type: "SCAN_LOCATION_START"; locationId: string }
  | { type: "SPOOLS_LOADED"; spools: ActiveSpool[] }
  | { type: "SCAN_ERROR"; errorMsg: string }
  | { type: "SET_ERROR"; errorMsg: string }
  | { type: "BARCODE_NOT_FOUND"; upcGtin: string; statusMsg: string }
  | { type: "ASSIGNING_SPOOL"; spoolId: string }
  | { type: "ASSIGN_FAILED"; errorMsg: string };

const INITIAL_STATE: DialogState = {
  step: "scan",
  scannerKey: 0,
  statusMsg: "",
  errorMsg: "",
  processing: false,
  pendingLocationId: null,
  activeSpools: [],
  loadingSpools: false,
  assigningSpoolId: null,
  missingUpcGtin: null,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "RESET":
      return INITIAL_STATE;
    case "RESTART":
      return { ...INITIAL_STATE, scannerKey: state.scannerKey + 1, errorMsg: action.errorMsg ?? "" };
    case "SCAN_START":
      return { ...state, processing: true, statusMsg: "", errorMsg: "" };
    case "SCAN_LOCATION_START":
      return { ...state, processing: true, statusMsg: "", errorMsg: "", pendingLocationId: action.locationId, loadingSpools: true };
    case "SPOOLS_LOADED":
      return { ...state, step: "pick-spool", activeSpools: action.spools, loadingSpools: false, processing: false };
    case "SCAN_ERROR":
      return { ...INITIAL_STATE, scannerKey: state.scannerKey + 1, errorMsg: action.errorMsg };
    case "SET_ERROR":
      return { ...state, errorMsg: action.errorMsg };
    case "BARCODE_NOT_FOUND":
      return { ...state, step: "barcode-not-found", missingUpcGtin: action.upcGtin, statusMsg: action.statusMsg, processing: false };
    case "ASSIGNING_SPOOL":
      return { ...state, assigningSpoolId: action.spoolId, errorMsg: "" };
    case "ASSIGN_FAILED":
      return { ...state, assigningSpoolId: null, errorMsg: action.errorMsg };
  }
}

export function GlobalScanDialog({ trigger }: GlobalScanDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(dialogReducer, INITIAL_STATE);

  useEffect(() => {
    if (!open) dispatch({ type: "RESET" });
  }, [open]);

  async function handleScanResult(text: string) {
    if (state.processing) return;

    const target = parseScanTarget(text);

    if (target.type === "spool") {
      setOpen(false);
      router.push(`/spools/${target.spoolId}`);
      return;
    }

    if (target.type === "location") {
      dispatch({ type: "SCAN_LOCATION_START", locationId: target.locationId });
      try {
        const spools = await apiFetch<ActiveSpool[]>("/api/spools?status=ACTIVE");
        dispatch({ type: "SPOOLS_LOADED", spools });
      } catch (err) {
        dispatch({ type: "SCAN_ERROR", errorMsg: err instanceof Error ? err.message : "加载线轴失败，请重试" });
      }
      return;
    }

    if (target.type === "upc_gtin") {
      dispatch({ type: "SCAN_START" });
      try {
        const items = await apiFetch<CatalogLookupItem[]>(
          `/api/filaments?upc_gtin=${encodeURIComponent(target.upcGtin)}`
        );
        if (items.length > 0) {
          setOpen(false);
          router.push(`/filaments/${items[0].id}`);
          return;
        }
        dispatch({ type: "BARCODE_NOT_FOUND", upcGtin: target.upcGtin, statusMsg: `数据库未收录 UPC/GTIN：${target.upcGtin}` });
      } catch (err) {
        dispatch({ type: "SCAN_ERROR", errorMsg: err instanceof Error ? err.message : "UPC/GTIN 查询失败，请重试" });
      }
      return;
    }

    dispatch({ type: "SCAN_ERROR", errorMsg: "无法识别的二维码/条码" });
  }

  async function handleAssignLocation(spoolId: string) {
    if (!state.pendingLocationId) {
      dispatch({ type: "RESTART", errorMsg: "缺少位置信息，请重新扫码" });
      return;
    }

    dispatch({ type: "ASSIGNING_SPOOL", spoolId });

    try {
      await apiFetch(`/api/spools/${spoolId}`, {
        method: "PATCH",
        body: JSON.stringify({ location_id: state.pendingLocationId }),
      });
      setOpen(false);
      router.push(`/spools/${spoolId}?statusMsg=${encodeURIComponent("位置已更新")}`);
    } catch (err) {
      dispatch({ type: "ASSIGN_FAILED", errorMsg: err instanceof Error ? err.message : "分配位置失败，请重试" });
    }
  }

  function handleCreateFilament() {
    if (!state.missingUpcGtin) return;
    setOpen(false);
    router.push(`/filaments/new?upc_gtin=${encodeURIComponent(state.missingUpcGtin)}`);
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

        {state.step === "scan" && (
          <div className="space-y-3">
            {state.statusMsg && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {state.statusMsg}
              </div>
            )}
            {state.errorMsg && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {state.errorMsg}
              </div>
            )}
            <QRScanner
              key={state.scannerKey}
              onResult={handleScanResult}
              onClose={() => setOpen(false)}
              mode="qr-and-barcode"
              onStartError={(msg) => dispatch({ type: "SET_ERROR", errorMsg: msg })}
            />
          </div>
        )}

        {state.step === "pick-spool" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              已识别位置二维码，请选择要分配该位置的线轴。
            </p>
            {state.errorMsg && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {state.errorMsg}
              </div>
            )}
            {state.loadingSpools ? (
              <p className="py-4 text-center text-sm text-muted-foreground">加载线轴中...</p>
            ) : state.activeSpools.length === 0 ? (
              <p className="rounded-md border border-border px-3 py-6 text-center text-sm text-muted-foreground">
                当前没有 ACTIVE 线轴可分配。
              </p>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                {state.activeSpools.map((spool) => (
                  <div
                    key={spool.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {spool.filament.brand} ·{" "}
                        {[spool.filament.material, spool.filament.variant]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {spool.filament.color_name} · 当前：{spool.location?.name ?? "未分配"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAssignLocation(spool.id)}
                      disabled={state.assigningSpoolId !== null}
                    >
                      {state.assigningSpoolId === spool.id ? "分配中..." : "分配"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" className="w-full" onClick={() => dispatch({ type: "RESTART" })}>
              继续扫码
            </Button>
          </div>
        )}

        {state.step === "barcode-not-found" && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {state.statusMsg || "数据库中未找到该 UPC/GTIN"}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" onClick={handleCreateFilament}>
                去新建耗材
              </Button>
              <Button type="button" variant="outline" onClick={() => dispatch({ type: "RESTART" })}>
                继续扫码
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
