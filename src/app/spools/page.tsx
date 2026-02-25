"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorSwatch } from "@/components/ColorSwatch";
import { apiFetch } from "@/lib/fetch";

interface Spool {
  id: string;
  status: "ACTIVE" | "EMPTY";
  global_filament_id: string;
  created_at: string;
  updated_at: string;
  globalFilament: {
    brand: string;
    material: string;
    material_type?: string | null;
    color_name: string;
    color_hex?: string | null;
  };
  location: { id: string; name: string } | null;
}

interface GroupedSpool {
  globalFilamentId: string;
  brand: string;
  material: string;
  material_type: string | null | undefined;
  color_name: string;
  color_hex: string | null | undefined;
  count: number;
  locationLabel: string;
  latestCreatedAt: string;
  latestUpdatedAt: string;
  spools: Spool[];
}

function groupSpools(spools: Spool[]): GroupedSpool[] {
  const map = new Map<string, GroupedSpool>();
  for (const spool of spools) {
    const key = spool.global_filament_id;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.spools.push(spool);
      if (spool.created_at > existing.latestCreatedAt) existing.latestCreatedAt = spool.created_at;
      if (spool.updated_at > existing.latestUpdatedAt) existing.latestUpdatedAt = spool.updated_at;
    } else {
      map.set(key, {
        globalFilamentId: key,
        brand: spool.globalFilament.brand,
        material: spool.globalFilament.material,
        material_type: spool.globalFilament.material_type,
        color_name: spool.globalFilament.color_name,
        color_hex: spool.globalFilament.color_hex,
        count: 1,
        locationLabel: "",
        latestCreatedAt: spool.created_at,
        latestUpdatedAt: spool.updated_at,
        spools: [spool],
      });
    }
  }
  for (const group of map.values()) {
    if (group.count === 1) {
      group.locationLabel = group.spools[0].location?.name ?? "未分配位置";
    } else {
      group.locationLabel = "多个位置";
    }
  }
  return Array.from(map.values());
}

type SortField = "brand" | "material" | "material_type" | "color_name" | "count" | "created_at" | "updated_at";
type SortOrder = "asc" | "desc";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN");
}

function SortHeader({
  field,
  label,
  sortBy,
  sortOrder,
  onToggle,
}: {
  field: SortField;
  label: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  onToggle: (field: SortField) => void;
}) {
  const isActive = sortBy === field;
  const Icon = !isActive ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      <span>{label}</span>
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function MobileSpoolList({
  mode,
  loading,
  groups,
  empty,
}: {
  mode: "active" | "empty";
  loading: boolean;
  groups: GroupedSpool[];
  empty: React.ReactNode;
}) {
  if (loading) {
    return <p className="text-center text-muted-foreground py-8">加载中...</p>;
  }

  if (groups.length === 0) {
    return <div className="text-center text-muted-foreground py-8">{empty}</div>;
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {groups.map((group) => (
        <Link key={group.globalFilamentId} href={`/catalog/${group.globalFilamentId}`}>
          <div className="px-3 py-3 border-b border-border/60 last:border-0 flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{group.brand}</p>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  ×{group.count}
                </span>
              </div>

              <p className="text-xs text-muted-foreground truncate">
                {group.material || "-"} · {group.material_type || "-"}
              </p>

              <div className="flex items-center gap-2">
                <ColorSwatch colorHex={group.color_hex} size="sm" />
                <p className="text-xs text-muted-foreground truncate">{group.color_name}</p>
              </div>

              <p className="text-xs text-muted-foreground truncate">
                {group.locationLabel} · {mode === "active" ? `入库：${formatDate(group.latestCreatedAt)}` : `归档：${formatDate(group.latestUpdatedAt)}`}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function DesktopSpoolTable({
  title,
  mode,
  loading,
  groups,
  sortBy,
  sortOrder,
  onToggleSort,
  empty,
  onRowClick,
}: {
  title: string;
  mode: "active" | "empty";
  loading: boolean;
  groups: GroupedSpool[];
  sortBy: SortField;
  sortOrder: SortOrder;
  onToggleSort: (field: SortField) => void;
  empty: React.ReactNode;
  onRowClick: (globalFilamentId: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title} ({groups.length})</h2>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : groups.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 border border-border rounded-lg">{empty}</div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="brand" label="品牌" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="material" label="材质" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="material_type" label="类型" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="color_name" label="颜色" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">位置</th>
                <th className="text-center px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="count" label="数量" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader
                    field={mode === "active" ? "created_at" : "updated_at"}
                    label={mode === "active" ? "入库时间" : "归档时间"}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={onToggleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr
                  key={group.globalFilamentId}
                  className="border-b border-border/70 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onRowClick(group.globalFilamentId)}
                >
                  <td className="px-4 py-3">{group.brand}</td>
                  <td className="px-4 py-3">{group.material || "-"}</td>
                  <td className="px-4 py-3">{group.material_type || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ColorSwatch colorHex={group.color_hex} size="sm" />
                      <span className="truncate">{group.color_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{group.locationLabel}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {group.count}
                    </span>
                  </td>
                  <td className="px-4 py-3">{mode === "active" ? formatDate(group.latestCreatedAt) : formatDate(group.latestUpdatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function SpoolsPage() {
  const router = useRouter();
  const [activeSpools, setActiveSpools] = useState<Spool[]>([]);
  const [emptySpools, setEmptySpools] = useState<Spool[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [loadingEmpty, setLoadingEmpty] = useState(true);

  const [activeSortBy, setActiveSortBy] = useState<SortField>("created_at");
  const [activeSortOrder, setActiveSortOrder] = useState<SortOrder>("desc");
  const [emptySortBy, setEmptySortBy] = useState<SortField>("updated_at");
  const [emptySortOrder, setEmptySortOrder] = useState<SortOrder>("desc");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadActive() {
      setLoadingActive(true);
      try {
        const data = await apiFetch<Spool[]>(`/api/spools?status=ACTIVE`);
        if (!cancelled) {
          setActiveSpools(data);
        }
      } finally {
        if (!cancelled) {
          setLoadingActive(false);
        }
      }
    }

    loadActive();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmpty() {
      setLoadingEmpty(true);
      try {
        const data = await apiFetch<Spool[]>(`/api/spools?status=EMPTY`);
        if (!cancelled) {
          setEmptySpools(data);
        }
      } finally {
        if (!cancelled) {
          setLoadingEmpty(false);
        }
      }
    }

    loadEmpty();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function sortGroups(groups: GroupedSpool[], field: SortField, order: SortOrder): GroupedSpool[] {
    return [...groups].sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case "brand": cmp = a.brand.localeCompare(b.brand); break;
        case "material": cmp = (a.material || "").localeCompare(b.material || ""); break;
        case "material_type": cmp = (a.material_type || "").localeCompare(b.material_type || ""); break;
        case "color_name": cmp = a.color_name.localeCompare(b.color_name); break;
        case "count": cmp = a.count - b.count; break;
        case "created_at": cmp = a.latestCreatedAt.localeCompare(b.latestCreatedAt); break;
        case "updated_at": cmp = a.latestUpdatedAt.localeCompare(b.latestUpdatedAt); break;
      }
      return order === "asc" ? cmp : -cmp;
    });
  }

  const activeGroups = sortGroups(groupSpools(activeSpools), activeSortBy, activeSortOrder);
  const emptyGroups = sortGroups(groupSpools(emptySpools), emptySortBy, emptySortOrder);

  function toggleActiveSort(field: SortField) {
    if (activeSortBy === field) {
      setActiveSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setActiveSortBy(field);
    setActiveSortOrder("asc");
  }

  function toggleEmptySort(field: SortField) {
    if (emptySortBy === field) {
      setEmptySortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setEmptySortBy(field);
    setEmptySortOrder("asc");
  }

  return (
    <div className="mx-auto max-w-lg md:max-w-7xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">我的料卷</h1>
        <Link href="/catalog" className="text-sm text-primary font-medium">
          + 新增
        </Link>
      </div>

      <div className="p-4 space-y-6">
        <div className="md:hidden">
          <Tabs defaultValue="active">
            <TabsList className="w-full">
              <TabsTrigger value="active" className="flex-1">
                使用中 ({activeGroups.length})
              </TabsTrigger>
              <TabsTrigger value="empty" className="flex-1">
                空卷轴 ({emptyGroups.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <MobileSpoolList
                mode="active"
                loading={loadingActive}
                groups={activeGroups}
                empty={<><span>暂无使用中的料卷，</span><Link href="/catalog" className="text-primary underline">去添加</Link></>}
              />
            </TabsContent>

            <TabsContent value="empty" className="mt-4">
              <MobileSpoolList
                mode="empty"
                loading={loadingEmpty}
                groups={emptyGroups}
                empty={<span>暂无空卷轴</span>}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="hidden md:block space-y-8">
          <DesktopSpoolTable
            title="使用中"
            mode="active"
            loading={loadingActive}
            groups={activeGroups}
            sortBy={activeSortBy}
            sortOrder={activeSortOrder}
            onToggleSort={toggleActiveSort}
            empty={<><span>暂无使用中的料卷，</span><Link href="/catalog" className="text-primary underline">去添加</Link></>}
            onRowClick={(gfId) => router.push(`/catalog/${gfId}`)}
          />

          <DesktopSpoolTable
            title="空卷轴"
            mode="empty"
            loading={loadingEmpty}
            groups={emptyGroups}
            sortBy={emptySortBy}
            sortOrder={emptySortOrder}
            onToggleSort={toggleEmptySort}
            empty={<span>暂无空卷轴</span>}
            onRowClick={(gfId) => router.push(`/catalog/${gfId}`)}
          />
        </div>
      </div>
    </div>
  );
}
