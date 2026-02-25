"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LocationForm } from "@/components/LocationForm";

export default function NewLocationPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-lg md:max-w-2xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">新建位置</h1>
      </div>
      <LocationForm />
    </div>
  );
}
