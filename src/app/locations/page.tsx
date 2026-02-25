"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch";
import { ColorSwatch } from "@/components/ColorSwatch";

interface SpoolInfo {
  id: string;
  globalFilament: {
    brand: string;
    material: string;
    color_name: string;
    color_hex?: string | null;
    nominal_weight?: string | null;
  };
}

interface Location {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  printer_name?: string | null;
  ams_unit?: string | null;
  ams_slot?: string | null;
  _count: { spools: number };
  spools: SpoolInfo[];
}

// AMS 层级：打印机 > AMS 单元 > 插槽
interface AmsSlotView {
  location: Location;
  slotNumber: string;
  spool: SpoolInfo | null;
}

interface AmsUnitView {
  unitName: string;
  slots: AmsSlotView[];
}

interface PrinterView {
  printerName: string;
  units: AmsUnitView[];
}

function buildAmsHierarchy(amsLocations: Location[]): PrinterView[] {
  const printerMap = new Map<string, Map<string, AmsSlotView[]>>();

  for (const loc of amsLocations) {
    const printer = loc.printer_name || "未知打印机";
    const unit = loc.ams_unit || "1";
    const slot = loc.ams_slot || "1";

    if (!printerMap.has(printer)) printerMap.set(printer, new Map());
    const unitMap = printerMap.get(printer)!;
    if (!unitMap.has(unit)) unitMap.set(unit, []);
    unitMap.get(unit)!.push({
      location: loc,
      slotNumber: slot,
      spool: loc.spools[0] || null,
    });
  }

  const printers: PrinterView[] = [];
  for (const [printerName, unitMap] of printerMap) {
    const units: AmsUnitView[] = [];
    for (const [unitName, slots] of unitMap) {
      slots.sort((a, b) => Number(a.slotNumber) - Number(b.slotNumber));
      units.push({ unitName, slots });
    }
    units.sort((a, b) => a.unitName.localeCompare(b.unitName));
    printers.push({ printerName, units });
  }
  printers.sort((a, b) => a.printerName.localeCompare(b.printerName));
  return printers;
}

function SpoolCard({ spool, onRemove }: { spool: SpoolInfo; onRemove?: () => void }) {
  const f = spool.globalFilament;
  return (
    <div className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg">
      <ColorSwatch colorHex={f.color_hex} size="lg" className="rounded-md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{f.brand} {f.material}</p>
        <p className="text-xs text-muted-foreground truncate">
          {f.color_name}
          {f.nominal_weight ? ` · ${f.nominal_weight}` : ""}
        </p>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground p-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <Link href={`/spool/${spool.id}`} className="text-muted-foreground hover:text-foreground p-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </Link>
    </div>
  );
}

// AMS 插槽卡片
function AmsSlotCard({ slot }: { slot: AmsSlotView }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium">插槽 {slot.slotNumber}</span>
        {!slot.spool && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">空</span>
        )}
      </div>
      {slot.spool ? (
        <SpoolCard spool={slot.spool} />
      ) : (
        <div className="border border-dashed border-border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">未加载线轴</p>
        </div>
      )}
    </div>
  );
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Location[]>("/api/locations");
        setLocations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 分离 AMS 和非 AMS 位置
  const amsLocations = locations.filter((l) => l.type === "ams_slot");
  const otherLocations = locations.filter((l) => l.type !== "ams_slot");
  const printers = buildAmsHierarchy(amsLocations);

  // 非 AMS 按类型分组
  const otherGrouped = otherLocations.reduce<Record<string, Location[]>>((acc, loc) => {
    const key = loc.type || "custom";
    if (!acc[key]) acc[key] = [];
    acc[key].push(loc);
    return acc;
  }, {});

  const typeLabels: Record<string, { label: string; icon: string }> = {
    shelf: { label: "货架", icon: "📦" },
    printer: { label: "打印机", icon: "🖨️" },
    dryer: { label: "耗材干燥机", icon: "💨" },
    custom: { label: "自定义位置", icon: "📍" },
  };

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">位置</h1>
        <Link href="/locations/new" className="text-sm text-primary font-medium">
          + 新建
        </Link>
      </div>

      <div className="p-4 space-y-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : error ? (
          <p className="text-center text-destructive py-8">{error}</p>
        ) : locations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            暂无位置，
            <Link href="/locations/new" className="text-primary underline">新建位置</Link>
          </p>
        ) : (
          <>
            {/* 带 AMS 的打印机 */}
            {printers.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold text-primary">带 AMS 的打印机</h2>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {printers.length} 台
                  </span>
                </div>
                <div className="space-y-4">
                  {printers.map((printer) => (
                    <div key={printer.printerName} className="space-y-3">
                      {printer.units.map((unit) => (
                        <div key={unit.unitName} className="bg-card border border-border rounded-xl p-4">
                          <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                            <span>🖨️</span>
                            {printer.printerName} - AMS 单元 {unit.unitName}
                          </h3>
                          <div className="space-y-2">
                            {unit.slots.map((slot) => (
                              <AmsSlotCard key={slot.location.id} slot={slot} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 其他类型位置 */}
            {Object.entries(otherGrouped).map(([type, locs]) => {
              const info = typeLabels[type] || typeLabels.custom;
              return (
                <section key={type}>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-base font-semibold">{info.icon} {info.label}</h2>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {locs.length} 个
                    </span>
                  </div>
                  <div className="space-y-3">
                    {locs.map((loc) => (
                      <div key={loc.id} className="bg-card border border-border rounded-xl p-4">
                        <Link href={`/location/${loc.id}`} className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{info.icon}</span>
                          <h3 className="text-sm font-semibold">{loc.name}</h3>
                        </Link>
                        {loc.spools.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-3 text-center">未分配线轴</p>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground mb-2">
                              {loc.spools.length} 已存储线轴：
                            </p>
                            <div className="space-y-2">
                              {loc.spools.map((s) => (
                                <SpoolCard key={s.id} spool={s} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
