const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export const formatCents = (cents: number): string => eur.format(cents / 100);
