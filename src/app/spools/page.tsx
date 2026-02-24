"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorSwatch } from "@/components/ColorSwatch";
import { StatusBadge } from "@/components/StatusBadge";
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

type SortField = "brand" | "material" | "material_type" | "color_name" | "status" | "created_at" | "updated_at";
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
  spools,
  empty,
  onRestock,
  onDelete,
}: {
  mode: "active" | "empty";
  loading: boolean;
  spools: Spool[];
  empty: React.ReactNode;
  onRestock?: (spool: Spool) => void;
  onDelete?: (spool: Spool) => void;
}) {
  if (loading) {
    return <p className="text-center text-muted-foreground py-8">加载中...</p>;
  }

  if (spools.length === 0) {
    return <div className="text-center text-muted-foreground py-8">{empty}</div>;
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {spools.map((spool) => (
        <div key={spool.id} className="px-3 py-3 border-b border-border/60 last:border-0 flex items-start gap-3">
          <Link href={`/spool/${spool.id}`} className="flex-1 min-w-0">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{spool.globalFilament.brand}</p>
                <StatusBadge status={spool.status} />
              </div>

              <p className="text-xs text-muted-foreground truncate">
                {spool.globalFilament.material_type || "-"} · {spool.globalFilament.material || "-"}
              </p>

              <div className="flex items-center gap-2">
                <ColorSwatch colorHex={spool.globalFilament.color_hex} size="sm" />
                <p className="text-xs text-muted-foreground truncate">{spool.globalFilament.color_name}</p>
              </div>

              {mode === "active" ? (
                <p className="text-xs text-muted-foreground truncate">
                  {spool.location ? spool.location.name : "未分配位置"} · 入库：{formatDate(spool.created_at)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground truncate">
                  {spool.location ? spool.location.name : "未分配位置"} · 归档：{formatDate(spool.updated_at)}
                </p>
              )}
            </div>
          </Link>

          {mode === "active" ? (
            <Link
              href={`/spool/${spool.id}`}
              className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted transition-colors"
            >
              查看/修改
            </Link>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => onRestock?.(spool)}
                className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted transition-colors whitespace-nowrap"
              >
                重新入库
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(spool)}
                className="inline-flex h-8 items-center justify-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap"
              >
                删除
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DesktopSpoolTable({
  title,
  mode,
  loading,
  spools,
  sortBy,
  sortOrder,
  onToggleSort,
  empty,
  onRowClick,
  onRestock,
  onDelete,
}: {
  title: string;
  mode: "active" | "empty";
  loading: boolean;
  spools: Spool[];
  sortBy: SortField;
  sortOrder: SortOrder;
  onToggleSort: (field: SortField) => void;
  empty: React.ReactNode;
  onRowClick: (id: string) => void;
  onRestock?: (spool: Spool) => void;
  onDelete?: (spool: Spool) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title} ({spools.length})</h2>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : spools.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 border border-border rounded-lg">{empty}</div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="brand" label="品牌" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="material_type" label="类型" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="material" label="材质" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="color_name" label="颜色" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">位置</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  <SortHeader field="status" label="状态" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
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
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {spools.map((spool) => (
                <tr
                  key={spool.id}
                  className="border-b border-border/70 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onRowClick(spool.id)}
                >
                  <td className="px-4 py-3">{spool.globalFilament.brand}</td>
                  <td className="px-4 py-3">{spool.globalFilament.material_type || "-"}</td>
                  <td className="px-4 py-3">{spool.globalFilament.material || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ColorSwatch colorHex={spool.globalFilament.color_hex} size="sm" />
                      <span className="truncate">{spool.globalFilament.color_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{spool.location ? spool.location.name : "未分配位置"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={spool.status} />
                  </td>
                  <td className="px-4 py-3">{mode === "active" ? formatDate(spool.created_at) : formatDate(spool.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {mode === "active" ? (
                      <Link
                        href={`/spool/${spool.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted transition-colors"
                      >
                        查看/修改
                      </Link>
                    ) : (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestock?.(spool);
                          }}
                          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted transition-colors"
                        >
                          重新入库
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete?.(spool);
                          }}
                          className="inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </td>
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
        const params = new URLSearchParams({
          status: "ACTIVE",
          sortBy: activeSortBy,
          sortOrder: activeSortOrder,
        });
        const data = await apiFetch<Spool[]>(`/api/spools?${params.toString()}`);
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
  }, [activeSortBy, activeSortOrder, reloadKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmpty() {
      setLoadingEmpty(true);
      try {
        const params = new URLSearchParams({
          status: "EMPTY",
          sortBy: emptySortBy,
          sortOrder: emptySortOrder,
        });
        const data = await apiFetch<Spool[]>(`/api/spools?${params.toString()}`);
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
  }, [emptySortBy, emptySortOrder, reloadKey]);

  async function handleRestock(spool: Spool) {
    try {
      const newSpool = await apiFetch<{ id: string }>("/api/spools", {
        method: "POST",
        body: JSON.stringify({ global_filament_id: spool.global_filament_id }),
      });
      setReloadKey((prev) => prev + 1);
      router.push(`/spool/${newSpool.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "重新入库失败，请重试");
    }
  }

  async function handleDelete(spool: Spool) {
    if (!window.confirm("确认删除此空卷轴？此操作不可撤销。")) {
      return;
    }
    try {
      await apiFetch(`/api/spools/${spool.id}`, { method: "DELETE" });
      setReloadKey((prev) => prev + 1);
    } catch (error) {
      alert(error instanceof Error ? error.message : "删除失败，请重试");
    }
  }

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
                使用中 ({activeSpools.length})
              </TabsTrigger>
              <TabsTrigger value="empty" className="flex-1">
                空卷轴 ({emptySpools.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <MobileSpoolList
                mode="active"
                loading={loadingActive}
                spools={activeSpools}
                empty={<><span>暂无使用中的料卷，</span><Link href="/catalog" className="text-primary underline">去添加</Link></>}
              />
            </TabsContent>

            <TabsContent value="empty" className="mt-4">
              <MobileSpoolList
                mode="empty"
                loading={loadingEmpty}
                spools={emptySpools}
                empty={<span>暂无空卷轴</span>}
                onRestock={handleRestock}
                onDelete={handleDelete}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="hidden md:block space-y-8">
          <DesktopSpoolTable
            title="使用中"
            mode="active"
            loading={loadingActive}
            spools={activeSpools}
            sortBy={activeSortBy}
            sortOrder={activeSortOrder}
            onToggleSort={toggleActiveSort}
            empty={<><span>暂无使用中的料卷，</span><Link href="/catalog" className="text-primary underline">去添加</Link></>}
            onRowClick={(id) => router.push(`/spool/${id}`)}
          />

          <DesktopSpoolTable
            title="空卷轴"
            mode="empty"
            loading={loadingEmpty}
            spools={emptySpools}
            sortBy={emptySortBy}
            sortOrder={emptySortOrder}
            onToggleSort={toggleEmptySort}
            empty={<span>暂无空卷轴</span>}
            onRowClick={(id) => router.push(`/spool/${id}`)}
            onRestock={handleRestock}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}
