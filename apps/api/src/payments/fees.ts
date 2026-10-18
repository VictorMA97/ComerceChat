/** Comisión de plataforma (FR-PAY-10): solo sobre el importe, nunca sobre la propina. */
export function platformFeeCents(amountCents: number, bps: number, fixedCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round((amountCents * bps) / 10_000) + fixedCents;
}

/** Texto del extracto bancario (FR-PAY-11): `COMERCECHAT*<COMERCIO>`, ASCII y máximo 22 caracteres. */
export function statementDescriptor(brandName: string): string {
  const brand = brandName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toUpperCase();
  return `COMERCECHAT*${brand}`.slice(0, 22).trim();
}
