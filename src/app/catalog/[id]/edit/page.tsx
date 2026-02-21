import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CatalogForm } from "@/components/CatalogForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCatalogPage({ params }: Props) {
  const { id } = await params;
  const item = await prisma.globalFilament.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">编辑耗材字典</h1>
      </div>
      <CatalogForm
        catalogId={id}
        initialValues={{
          brand: item.brand,
          material: item.material,
          color_name: item.color_name,
          color_hex: item.color_hex ?? "",
          nozzle_temp: item.nozzle_temp,
          bed_temp: item.bed_temp,
          print_speed: item.print_speed,
          logo_url: item.logo_url ?? "",
        }}
      />
    </div>
  );
}
