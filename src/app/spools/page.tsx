"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { apiFetch } from "@/lib/fetch";

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

  useEffect(() => {
    let cancelled = false;

    async function loadActive() {
      setLoadingActive(true);
      try {
        const data = await apiFetch<Spool[]>("/api/spools?status=ACTIVE");
        if (!cancelled) setActiveSpools(data);
      } finally {
        if (!cancelled) setLoadingActive(false);
      }
    }

    void loadActive();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEmpty() {
      setLoadingEmpty(true);
      try {
        const data = await apiFetch<Spool[]>("/api/spools?status=EMPTY");
        if (!cancelled) setEmptySpools(data);
      } finally {
        if (!cancelled) setLoadingEmpty(false);
      }
    }

    void loadEmpty();
    return () => {
      cancelled = true;
    };
  }, []);

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
        actions={
          <Link href="/filaments" className="text-sm font-medium text-primary">
            + 新增
          </Link>
        }
      />

      <div className="app-content">
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
                loading={loadingActive}
                groups={activeGroups}
                empty={
                  <>
                    <span>暂无使用中的线轴，</span>
                    <Link href="/filaments" className="text-primary underline">
                      去添加
                    </Link>
                  </>
                }
              />
            </TabsContent>

            <TabsContent value="empty" className="mt-4">
              <MobileSpoolList
                mode="empty"
                loading={loadingEmpty}
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
            loading={loadingActive}
            groups={activeGroups}
            sortBy={activeSortBy}
            sortOrder={activeSortOrder}
            onToggleSort={toggleActiveSort}
            empty={
              <>
                <span>暂无使用中的线轴，</span>
                <Link href="/filaments" className="text-primary underline">
                  去添加
                </Link>
              </>
            }
            onRowClick={(filamentId) => router.push(`/filaments/${filamentId}`)}
          />

          <DesktopSpoolTable
            title="已归档线轴"
            mode="empty"
            loading={loadingEmpty}
            groups={emptyGroups}
            sortBy={emptySortBy}
            sortOrder={emptySortOrder}
            onToggleSort={toggleEmptySort}
            empty={<span>暂无已归档线轴</span>}
            onRowClick={(filamentId) => router.push(`/filaments/${filamentId}`)}
          />
        </div>
      </div>
    </PageShell>
  );
}
