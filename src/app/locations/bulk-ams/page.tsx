"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/fetch";

const SLOT_COUNT = 4;

export default function BulkAmsPage() {
  const router = useRouter();
  const [printerName, setPrinterName] = useState("");
  const [amsUnit, setAmsUnit] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<boolean[]>(
    Array(SLOT_COUNT).fill(true)
  );
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  function toggleSlot(index: number) {
    setSelectedSlots((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  const selectedCount = selectedSlots.filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedCount === 0) {
      setError("请至少选择一个插槽");
      return;
    }
    setError("");
    setSaving(true);
    setProgress(0);

    try {
      let done = 0;
      for (let i = 0; i < selectedSlots.length; i++) {
        if (!selectedSlots[i]) continue;
        await apiFetch("/api/locations", {
          method: "POST",
          body: JSON.stringify({
            name: printerName.trim(),
            type: "ams_slot",
            is_default: false,
            printer_name: printerName.trim(),
            ams_unit: amsUnit.trim(),
            ams_slot: String(i + 1),
          }),
        });
        done++;
        setProgress(done);
      }
      router.push("/locations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg md:max-w-2xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold">批量添加 AMS 插槽</h1>
          <p className="text-xs text-muted-foreground">快速一次性创建多个 AMS 插槽位置</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {/* 打印机名称 */}
        <div className="space-y-2">
          <Label htmlFor="printer_name">打印机名称 *</Label>
          <Input
            id="printer_name"
            value={printerName}
            onChange={(e) => setPrinterName(e.target.value)}
            placeholder="如：Bambu A1 Mini, Bambu X1C"
            required
            className="h-12"
          />
        </div>

        {/* AMS 单元 */}
        <div className="space-y-2">
          <Label htmlFor="ams_unit">AMS 单元 *</Label>
          <Input
            id="ams_unit"
            value={amsUnit}
            onChange={(e) => setAmsUnit(e.target.value)}
            placeholder="如：1, 2, A, B"
            required
            className="h-12"
          />
        </div>

        {/* 要创建的槽位 */}
        <div className="space-y-3">
          <Label>要创建的槽位</Label>
          <div className="grid grid-cols-4 gap-2">
            {selectedSlots.map((selected, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleSlot(i)}
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                    selected ? "bg-primary border-primary" : "border-muted-foreground/40"
                  }`}
                >
                  {selected && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span>插槽 {i + 1}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 预览 */}
        {selectedCount > 0 && (printerName || amsUnit) && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">将创建以下位置：</p>
            <ul className="space-y-1">
              {selectedSlots.map((selected, i) =>
                selected ? (
                  <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>•</span>
                    <span>
                      打印机：{printerName || "?"} ，AMS：{amsUnit || "?"}-{i + 1}
                    </span>
                  </li>
                ) : null
              )}
            </ul>
            {!printerName && (
              <p className="text-xs text-muted-foreground/60 italic">（填写打印机名称后将显示实际名称）</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          className="w-full h-14 text-base"
          disabled={saving || selectedCount === 0}
        >
          {saving
            ? `创建中... (${progress}/${selectedCount})`
            : `创建 ${selectedCount} 个 AMS 插槽`}
        </Button>
      </form>
    </div>
  );
}
