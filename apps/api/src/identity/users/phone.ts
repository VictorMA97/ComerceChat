/** Normaliza un teléfono a E.164. Los números españoles sin prefijo (6, 7, 8 o 9 + 8 cifras) reciben +34. */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s().-]/g, '');
  const withPrefix = /^[6789]\d{8}$/.test(compact)
    ? `+34${compact}`
    : compact.startsWith('00')
      ? `+${compact.slice(2)}`
      : compact;
  return /^\+[1-9]\d{7,14}$/.test(withPrefix) ? withPrefix : null;
}

/** «+34 6•• ••• •01»: lo justo para que el usuario reconozca su número. */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 3)} ${e164.slice(3, 4)}•• ••• •${e164.slice(-2)}`;
}
