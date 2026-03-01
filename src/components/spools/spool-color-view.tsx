"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  classifyHueGroup,
  HUE_GROUP_ORDER,
  HUE_GROUP_LABELS,
  parseGroupMode,
  GROUP_MODE_LABELS,
  type GroupMode,
} from "@/lib/color-hue";
import { type GroupedSpool } from "@/components/spools/spool-list-views";

// ─── 色块卡片 ───────────────────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function SpoolColorCard({ group }: { group: GroupedSpool }) {
  const isValid = group.color_hex && HEX_RE.test(group.color_hex);
  const bg = isValid ? group.color_hex! : undefined;
  const hex = isValid ? group.color_hex!.toUpperCase() : null;
  const label = [group.material, group.variant].filter(Boolean).join(" · ");

  return (
    <Link href={`/filaments/${group.filamentId}`} className="group block">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card transition-shadow hover:shadow-md">
        {/* 色块 */}
        <div
          className="aspect-square w-full"
          style={bg ? { backgroundColor: bg } : undefined}
        >
          {!bg && (
            <div className="flex h-full items-center justify-center bg-muted/40">
              <svg className="h-7 w-7 text-muted-foreground/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <line x1="4" y1="4" x2="20" y2="20" />
                <rect x="3" y="3" width="18" height="18" rx="1" />
              </svg>
            </div>
          )}
        </div>
        {/* 文字 */}
        <div className="p-2">
          <p className="truncate text-[11px] font-medium leading-tight">{group.brand}</p>
          {label && <p className="truncate text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>}
          <p className="truncate text-[10px] text-muted-foreground leading-tight mt-0.5">{group.color_name}</p>
          <div className="mt-1 flex items-center justify-between gap-1">
            {hex
              ? <p className="font-mono text-[9px] text-muted-foreground/60 leading-tight">{hex}</p>
              : <span />}
            <span className="inline-flex h-4 items-center rounded-full bg-muted px-1.5 text-[9px] font-medium">×{group.count}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── 分组逻辑 ─────────────────────────────────────────────────────────────────

interface ColorSection {
  key: string;
  label: string;
  items: GroupedSpool[];
}

function buildSections(groups: GroupedSpool[], mode: GroupMode): ColorSection[] {
  if (mode === "brand") {
    const map = new Map<string, GroupedSpool[]>();
    for (const g of groups) {
      const key = g.brand.trim() || "未知";
      (map.get(key) ?? (map.set(key, []), map.get(key)!)).push(g);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({ key, label: key, items }));
  }

  if (mode === "hue") {
    const map = new Map<string, GroupedSpool[]>();
    for (const g of groups) {
      const hue = classifyHueGroup(g.color_hex);
      (map.get(hue) ?? (map.set(hue, []), map.get(hue)!)).push(g);
    }
    return HUE_GROUP_ORDER
      .filter((h) => map.has(h))
      .map((h) => ({ key: h, label: HUE_GROUP_LABELS[h], items: map.get(h)! }));
  }

  // 按材料（默认）
  const map = new Map<string, GroupedSpool[]>();
  for (const g of groups) {
    const key = g.material.trim() || "未知材料";
    (map.get(key) ?? (map.set(key, []), map.get(key)!)).push(g);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({ key, label: key, items }));
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

const COLS_OPTIONS = [3, 4, 5, 6] as const;
type ColsOption = typeof COLS_OPTIONS[number];

const COLS_CLASS: Record<ColsOption, string> = {
  3: "grid-cols-3 sm:grid-cols-3",
  4: "grid-cols-3 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
};

const LS_GROUPMODE = "spools.colorView.groupMode";
const LS_COLS = "spools.colorView.cols";

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export interface SpoolColorViewProps {
  groups: GroupedSpool[];
  loading: boolean;
  empty: React.ReactNode;
}

export function SpoolColorView({ groups, loading, empty }: SpoolColorViewProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>(() =>
    parseGroupMode(readLS(LS_GROUPMODE, "material"))
  );
  const [cols, setCols] = useState<ColsOption>(() => {
    const v = parseInt(readLS(LS_COLS, "4"), 10);
    return (COLS_OPTIONS as readonly number[]).includes(v) ? (v as ColsOption) : 4;
  });

  const sections = useMemo(() => buildSections(groups, groupMode), [groups, groupMode]);

  function changeGroupMode(mode: GroupMode) {
    setGroupMode(mode);
    try { localStorage.setItem(LS_GROUPMODE, mode); } catch { /* ignore */ }
  }

  function changeCols(c: ColsOption) {
    setCols(c);
    try { localStorage.setItem(LS_COLS, String(c)); } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className={`grid gap-2 ${COLS_CLASS[cols]}`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border/40 animate-pulse">
            <div className="aspect-square bg-muted/50" />
            <div className="space-y-1.5 p-2">
              <div className="h-2.5 w-3/4 rounded bg-muted" />
              <div className="h-2 w-1/2 rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return <div className="py-10 text-center text-muted-foreground text-sm">{empty}</div>;
  }

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Group By */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">分组方式</span>
          <div className="relative">
            <select
              value={groupMode}
              onChange={(e) => changeGroupMode(parseGroupMode(e.target.value))}
              className="h-7 appearance-none rounded-md border border-border bg-background pl-2.5 pr-6 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {(Object.entries(GROUP_MODE_LABELS) as [GroupMode, string][]).map(([m, l]) => (
                <option key={m} value={m}>{l}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* 列数 */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">列数</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            {COLS_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => changeCols(c)}
                className={`h-7 w-7 text-xs transition-colors ${
                  cols === c
                    ? "bg-foreground text-background font-semibold"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">{groups.length} 种颜色</span>
      </div>

      {/* 分组 */}
      {sections.map((section) => (
        <section key={section.key}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{section.label}</h3>
            <span className="text-xs text-muted-foreground">{section.items.length}</span>
          </div>
          <div className={`grid gap-2 ${COLS_CLASS[cols]}`}>
            {section.items.map((g) => (
              <SpoolColorCard key={g.filamentId} group={g} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
