import { CatalogForm } from "@/components/CatalogForm";
import { isValidUpcGtin, normalizeUpcGtin } from "@/lib/upc-gtin";

interface Props {
  searchParams: Promise<{ upc_gtin?: string | string[] }>;
}

export default async function NewCatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawUpcGtin = Array.isArray(params.upc_gtin) ? params.upc_gtin[0] : params.upc_gtin;
  const normalizedUpcGtin = rawUpcGtin ? normalizeUpcGtin(rawUpcGtin) : "";
  const initialUpcGtin = normalizedUpcGtin && isValidUpcGtin(normalizedUpcGtin)
    ? normalizedUpcGtin
    : "";

  return (
    <div className="mx-auto max-w-lg md:max-w-2xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">新建耗材</h1>
      </div>
      <CatalogForm initialValues={initialUpcGtin ? { upc_gtin: initialUpcGtin } : undefined} />
    </div>
  );
}
