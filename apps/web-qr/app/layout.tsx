import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ComerceChat',
  description: 'Paga sin esperar desde la mesa',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f766e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
