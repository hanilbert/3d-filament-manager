import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";
import { ColorSwatch } from "@/components/ColorSwatch";
import { SortHeader } from "@/components/SortHeader";
import { formatDate } from "@/lib/utils";

export interface Spool {
  id: string;
  status: "ACTIVE" | "EMPTY";
  filament_id: string;
  created_at: string;
  updated_at: string;
  filament: {
    id: string;
    brand: string;
    material: string;
    variant: string;
    color_name: string;
    color_hex?: string | null;
  };
  location: { id: string; name: string } | null;
}

export interface GroupedSpool {
  filamentId: string;
  brand: string;
  material: string;
  variant: string;
  color_name: string;
  color_hex: string | null | undefined;
  count: number;
  locationLabel: string;
  latestCreatedAt: string;
  latestUpdatedAt: string;
  spools: Spool[];
}

export type SortField =
  | "brand"
  | "material"
  | "variant"
  | "color_name"
  | "count"
  | "created_at"
  | "updated_at";

export type SortOrder = "asc" | "desc";

export function groupSpools(spools: Spool[]): GroupedSpool[] {
  const map = new Map<string, GroupedSpool>();

  for (const spool of spools) {
    const key = spool.filament_id;
    const existing = map.get(key);

    if (existing) {
      existing.count += 1;
      existing.spools.push(spool);
      if (spool.created_at > existing.latestCreatedAt) {
        existing.latestCreatedAt = spool.created_at;
      }
      if (spool.updated_at > existing.latestUpdatedAt) {
        existing.latestUpdatedAt = spool.updated_at;
      }
      continue;
    }

    map.set(key, {
      filamentId: key,
      brand: spool.filament.brand,
      material: spool.filament.material,
      variant: spool.filament.variant,
      color_name: spool.filament.color_name,
      color_hex: spool.filament.color_hex,
      count: 1,
      locationLabel: "",
      latestCreatedAt: spool.created_at,
      latestUpdatedAt: spool.updated_at,
      spools: [spool],
    });
  }

  for (const group of map.values()) {
    group.locationLabel =
      group.count === 1
        ? group.spools[0].location?.name ?? "未分配位置"
        : "多个位置";
  }

  return Array.from(map.values());
}

export function sortGroupedSpools(
  groups: GroupedSpool[],
  field: SortField,
  order: SortOrder
): GroupedSpool[] {
  return [...groups].sort((a, b) => {
    let cmp = 0;

    switch (field) {
      case "brand":
        cmp = a.brand.localeCompare(b.brand);
        break;
      case "material":
        cmp = (a.material || "").localeCompare(b.material || "");
        break;
      case "variant":
        cmp = (a.variant || "").localeCompare(b.variant || "");
        break;
      case "color_name":
        cmp = a.color_name.localeCompare(b.color_name);
        break;
      case "count":
        cmp = a.count - b.count;
        break;
      case "created_at":
        cmp = a.latestCreatedAt.localeCompare(b.latestCreatedAt);
        break;
      case "updated_at":
        cmp = a.latestUpdatedAt.localeCompare(b.latestUpdatedAt);
        break;
    }

    return order === "asc" ? cmp : -cmp;
  });
}

export function MobileSpoolList({
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
    return <p className="py-8 text-center text-muted-foreground">加载中...</p>;
  }

  if (groups.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">{empty}</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {groups.map((group) => (
        <Link key={group.filamentId} href={`/filaments/${group.filamentId}`}>
          <div className="flex items-start gap-3 border-b border-border/60 px-3 py-3 last:border-0">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{group.brand}</p>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  ×{group.count}
                </span>
              </div>

              <p className="truncate text-xs text-muted-foreground">
                {group.material || "-"} · {group.variant || "-"}
              </p>

              <div className="flex items-center gap-2">
                <ColorSwatch colorHex={group.color_hex} size="sm" />
                <p className="truncate text-xs text-muted-foreground">
                  {group.color_name}
                </p>
              </div>

              <p className="truncate text-xs text-muted-foreground">
                {group.locationLabel} ·
                {mode === "active"
                  ? ` 入库：${formatDate(group.latestCreatedAt)}`
                  : ` 归档：${formatDate(group.latestUpdatedAt)}`}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function DesktopSpoolTable({
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
  onRowClick: (filamentId: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {title} ({groups.length})
      </h2>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">加载中...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-border py-8 text-center text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-[22%] px-4 py-3 text-left font-medium">
                  <SortHeader
                    field="brand"
                    label="品牌"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={onToggleSort}
                  />
                </th>
                <th className="w-[10%] px-4 py-3 text-left font-medium">
                  <SortHeader
                    field="material"
                    label="材料"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={onToggleSort}
                  />
                </th>
                <th className="w-[10%] px-4 py-3 text-left font-medium">
                  <SortHeader
                    field="variant"
                    label="类型"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={onToggleSort}
                  />
                </th>
                <th className="w-[14%] px-4 py-3 text-left font-medium">
                  <SortHeader
                    field="color_name"
                    label="颜色"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={onToggleSort}
                  />
                </th>
                <th className="w-[7%] px-4 py-3 text-left font-medium text-muted-foreground">
                  RGB
                </th>
                <th className="w-[12%] px-4 py-3 text-left font-medium text-muted-foreground">
                  RGB #
                </th>
                <th className="w-[7%] px-4 py-3 text-center font-medium">
                  <SortHeader
                    field="count"
                    label="线轴数"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={onToggleSort}
                  />
                </th>
                <th className="w-[12%] px-4 py-3 text-left font-medium">
                  <SortHeader
                    field={mode === "active" ? "created_at" : "updated_at"}
                    label={mode === "active" ? "入库时间" : "归档时间"}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={onToggleSort}
                  />
                </th>
                <th className="w-[6%] px-4 py-3 text-right font-medium text-muted-foreground">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr
                  key={group.filamentId}
                  className="cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/30 last:border-0"
                  onClick={() => onRowClick(group.filamentId)}
                >
                  <td className="truncate px-4 py-3">{group.brand}</td>
                  <td className="truncate px-4 py-3">{group.material || "-"}</td>
                  <td className="truncate px-4 py-3">{group.variant || "-"}</td>
                  <td className="truncate px-4 py-3">{group.color_name}</td>
                  <td className="px-4 py-3">
                    <ColorSwatch colorHex={group.color_hex} size="sm" />
                  </td>
                  <td className="truncate px-4 py-3 font-mono text-xs">
                    {group.color_hex || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">{group.count}</td>
                  <td className="truncate px-4 py-3">
                    {mode === "active"
                      ? formatDate(group.latestCreatedAt)
                      : formatDate(group.latestUpdatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="inline-flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/filaments/${group.filamentId}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted"
                        title="查看详情"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/filaments/${group.filamentId}/edit`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted"
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </div>
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
