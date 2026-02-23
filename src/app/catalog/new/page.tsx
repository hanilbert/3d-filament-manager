import { CatalogForm } from "@/components/CatalogForm";

export default function NewCatalogPage() {
  return (
    <div className="mx-auto max-w-lg md:max-w-2xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">新建耗材</h1>
      </div>
      <CatalogForm />
    </div>
  );
}
