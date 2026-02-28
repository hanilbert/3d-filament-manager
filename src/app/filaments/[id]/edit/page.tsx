import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CatalogForm } from "@/components/CatalogForm";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCatalogPage({ params }: Props) {
  const { id } = await params;
  const item = await prisma.filament.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <PageShell size="form">
      <PageHeader title="编辑耗材" />
      <CatalogForm
        catalogId={id}
        initialValues={{
          brand: item.brand,
          material: item.material,
          variant: item.variant ?? "",
          color_name: item.color_name,
          upc_gtin: item.upc_gtin ?? "",
          color_hex: item.color_hex ?? "",
          nozzle_temp: item.nozzle_temp ?? "",
          bed_temp: item.bed_temp ?? "",
          print_speed: item.print_speed ?? "",
          logo_url: item.logo_url ?? "",
        }}
      />
    </PageShell>
  );
}
