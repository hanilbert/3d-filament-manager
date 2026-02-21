"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/fetch";

interface Location {
  id: string;
  name: string;
  _count: { spools: number };
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<Location[]>("/api/locations");
      setLocations(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/locations", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      setShowAdd(false);
      await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">位置管理</h1>
        <button
          className="text-sm text-primary font-medium"
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? "取消" : "+ 新建"}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {showAdd && (
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="位置名称，如：防潮箱 A"
              className="h-12 flex-1"
              autoFocus
            />
            <Button type="submit" disabled={creating || !newName.trim()} className="h-12 px-5">
              {creating ? "..." : "创建"}
            </Button>
          </form>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : locations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">暂无位置，点击右上角新建</p>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <Link key={loc.id} href={`/location/${loc.id}`}>
                <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg active:bg-muted transition-colors">
                  <div>
                    <p className="font-medium">{loc.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {loc._count.spools} 卷活跃料卷
                    </p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
