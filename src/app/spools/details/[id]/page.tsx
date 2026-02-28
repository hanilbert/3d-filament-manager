import { redirect } from "next/navigation";

export default async function SpoolsDetailsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/filaments/${id}`);
}
