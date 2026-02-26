import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SpoolLabelPrinter } from "./spool-label-printer";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SpoolPrintPage({ params }: Props) {
  const { id } = await params;
  const spool = await prisma.spool.findUnique({
    where: { id },
    include: { filament: true },
  });

  if (!spool) notFound();

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  const origin = host
    ? `${protocol}://${host}`
    : process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const qrUrl = `${origin}/spools/${id}`;

  return (
    <SpoolLabelPrinter
      filament={spool.filament}
      qrUrl={qrUrl}
    />
  );
}
