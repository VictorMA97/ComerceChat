import 'server-only';
import QRCode from 'qrcode';

/**
 * QR como data URL de SVG, para pintarlo con `<img>`: así no hace falta insertar HTML
 * (`dangerouslySetInnerHTML`) y sigue siendo nítido al imprimir.
 */
export async function qrDataUrl(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
