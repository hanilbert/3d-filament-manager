import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { SpoolLabelPrinter } from "./spool-label-printer";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SpoolPrintPage({ params }: Props) {
  const { id } = await params;
  const spool = await prisma.spool.findUnique({
    where: { id },
    include: { globalFilament: true },
  });

  if (!spool) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const qrUrl = `${baseUrl}/spool/${id}`;

  return (
    <SpoolLabelPrinter
      globalFilament={spool.globalFilament}
      qrUrl={qrUrl}
    />
  );
}
