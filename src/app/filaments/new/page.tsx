import { CatalogForm } from "@/components/CatalogForm";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
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
    <PageShell size="form">
      <PageHeader title="新建耗材" />
      <CatalogForm initialValues={initialUpcGtin ? { upc_gtin: initialUpcGtin } : undefined} />
    </PageShell>
  );
}
