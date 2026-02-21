import { CatalogForm } from "@/components/CatalogForm";

export default function NewCatalogPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">新建耗材字典</h1>
      </div>
      <CatalogForm />
    </div>
  );
}
