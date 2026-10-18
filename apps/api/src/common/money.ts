const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** Formato para mensajes de error dirigidos al comensal. */
export const formatEur = (cents: number): string => eur.format(cents / 100);
