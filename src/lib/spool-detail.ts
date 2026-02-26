export interface SpoolDetailIdentity {
  id: string;
  filament_id: string;
  filament: {
    id: string;
    brand: string;
    logo_url: string | null;
  };
}

export async function withFallbackFilamentLogo<T extends SpoolDetailIdentity>(
  spool: T,
  resolveLogo: (brand: string, filamentId: string) => Promise<string | null>
): Promise<T> {
  if (spool.filament.logo_url) return spool;

  const logoUrl = await resolveLogo(spool.filament.brand, spool.filament.id);
  if (!logoUrl) return spool;

  return {
    ...spool,
    filament: {
      ...spool.filament,
      logo_url: logoUrl,
    },
  };
}
