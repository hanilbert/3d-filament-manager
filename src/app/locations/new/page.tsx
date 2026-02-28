"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LocationForm } from "@/components/LocationForm";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function NewLocationPage() {
  const router = useRouter();

  return (
    <PageShell size="form">
      <PageHeader
        title="新建位置"
        back={
          <button onClick={() => router.back()} className="text-muted-foreground">
            <ArrowLeft className="size-5" />
          </button>
        }
      />
      <LocationForm />
    </PageShell>
  );
}
