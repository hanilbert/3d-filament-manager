"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LocationForm } from "@/components/LocationForm";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { apiFetch } from "@/lib/fetch";

interface LocationData {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  printer_name?: string | null;
  ams_unit?: string | null;
  ams_slot?: string | null;
}

export default function EditLocationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const loc = await apiFetch<LocationData>(`/api/locations/${id}`);
        setData(loc);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
  if (!data) return <div className="p-4 text-center text-muted-foreground">位置不存在</div>;

  return (
    <PageShell size="form">
      <PageHeader
        title="编辑位置"
        back={
          <button onClick={() => router.back()} className="text-muted-foreground">
            <ArrowLeft className="size-5" />
          </button>
        }
      />
      <LocationForm
        locationId={id}
        initialValues={{
          name: data.name,
          type: data.type as "shelf" | "printer" | "ams_slot" | "dryer" | "custom",
          is_default: data.is_default,
          printer_name: data.printer_name ?? "",
          ams_unit: data.ams_unit ?? "",
          ams_slot: data.ams_slot ?? "",
        }}
      />
    </PageShell>
  );
}
