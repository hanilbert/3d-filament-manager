"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  DesktopSpoolTable,
  MobileSpoolList,
  Spool,
  SortField,
  SortOrder,
  groupSpools,
  sortGroupedSpools,
} from "@/components/spools/spool-list-views";
import { Pagination } from "@/components/ui/pagination";
import { apiFetch } from "@/lib/fetch";

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

function SpoolsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeSpools, setActiveSpools] = useState<Spool[]>([]);
  const [emptySpools, setEmptySpools] = useState<Spool[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSortBy, setActiveSortBy] = useState<SortField>("created_at");
  const [activeSortOrder, setActiveSortOrder] = useState<SortOrder>("desc");
  const [emptySortBy, setEmptySortBy] = useState<SortField>("updated_at");
  const [emptySortOrder, setEmptySortOrder] = useState<SortOrder>("desc");

  const currentPage = Number(searchParams.get("page")) || 1;
  const pageSize = 20;

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`/spools?${params.toString()}`);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [activeRes, emptyRes] = await Promise.all([
          apiFetch<PaginatedResponse<Spool>>(`/api/spools?status=ACTIVE&page=${currentPage}&pageSize=${pageSize}`),
          apiFetch<PaginatedResponse<Spool>>(`/api/spools?status=EMPTY&page=1&pageSize=10`)
        ]);
        if (!cancelled) {
          setActiveSpools(activeRes.data);
          setTotalActive(activeRes.total);
          setEmptySpools(emptyRes.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败，请重试");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => { cancelled = true; };
  }, [currentPage]);

  const activeGroups = useMemo(
    () => sortGroupedSpools(groupSpools(activeSpools), activeSortBy, activeSortOrder),
    [activeSpools, activeSortBy, activeSortOrder]
  );

  const emptyGroups = useMemo(
    () => sortGroupedSpools(groupSpools(emptySpools), emptySortBy, emptySortOrder),
    [emptySpools, emptySortBy, emptySortOrder]
  );

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
    <PageShell size="wide">
      <PageHeader
        title="我的线轴"
        subtitle="线轴数按耗材聚合展示"
      />

      <div className="app-content">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="md:hidden">
          <Tabs defaultValue="active">
            <TabsList className="w-full">
              <TabsTrigger value="active" className="flex-1">
                使用中 ({activeGroups.length})
              </TabsTrigger>
              <TabsTrigger value="empty" className="flex-1">
                已归档线轴 ({emptyGroups.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <MobileSpoolList
                mode="active"
                loading={loading}
                groups={activeGroups}
                empty={
                  <span className="text-sm text-muted-foreground/60">
                    可通过&quot;全局扫描&quot;或从&quot;耗材目录&quot;添加线轴
                  </span>
                }
              />
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalActive / pageSize)}
                onPageChange={handlePageChange}
              />
            </TabsContent>

            <TabsContent value="empty" className="mt-4">
              <MobileSpoolList
                mode="empty"
                loading={loading}
                groups={emptyGroups}
                empty={<span>暂无已归档线轴</span>}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="hidden space-y-8 md:block">
          <DesktopSpoolTable
            title="使用中"
            mode="active"
            loading={loading}
            groups={activeGroups}
            sortBy={activeSortBy}
            sortOrder={activeSortOrder}
            onToggleSort={toggleActiveSort}
            empty={
              <span className="text-sm text-muted-foreground/60">
                可通过&quot;全局扫描&quot;或从&quot;耗材目录&quot;添加线轴
              </span>
            }
            onRowClick={(filamentId) => router.push(`/spools/details/${filamentId}`)}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalActive / pageSize)}
            onPageChange={handlePageChange}
          />

          <DesktopSpoolTable
            title="已归档线轴"
            mode="empty"
            loading={loading}
            groups={emptyGroups}
            sortBy={emptySortBy}
            sortOrder={emptySortOrder}
            onToggleSort={toggleEmptySort}
            empty={<span>暂无已归档线轴</span>}
            onRowClick={(filamentId) => router.push(`/spools/details/${filamentId}`)}
          />
        </div>
      </div>
    </PageShell>
  );
}

export default function SpoolsPage() {
  return (
    <Suspense fallback={
      <PageShell size="wide">
        <PageHeader title="我的线轴" subtitle="加载中..." />
        <div className="app-content">
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        </div>
      </PageShell>
    }>
      <SpoolsContent />
    </Suspense>
  );
}
