import { CatalogForm } from "@/components/CatalogForm";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { isValidUpcGtin, normalizeUpcGtin } from "@/lib/upc-gtin";

interface Props {
  searchParams: Promise<{ upc_gtin?: string | string[]; brand?: string | string[] }>;
}

export default async function NewCatalogPage({ searchParams }: Props) {
  const params = await searchParams;

  const rawUpcGtin = Array.isArray(params.upc_gtin) ? params.upc_gtin[0] : params.upc_gtin;
  const normalizedUpcGtin = rawUpcGtin ? normalizeUpcGtin(rawUpcGtin) : "";
  const initialUpcGtin = normalizedUpcGtin && isValidUpcGtin(normalizedUpcGtin)
    ? normalizedUpcGtin
    : "";

  const initialBrand = Array.isArray(params.brand) ? params.brand[0] : (params.brand ?? "");

  const initialValues: Parameters<typeof CatalogForm>[0]["initialValues"] = {};
  if (initialUpcGtin) initialValues.upc_gtin = initialUpcGtin;
  if (initialBrand) initialValues.brand = initialBrand;

  return (
    <PageShell size="form">
      <PageHeader title="新建耗材" />
      <CatalogForm initialValues={Object.keys(initialValues).length > 0 ? initialValues : undefined} />
    </PageShell>
  );
}
