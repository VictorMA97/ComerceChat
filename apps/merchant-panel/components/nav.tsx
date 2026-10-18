import Link from 'next/link';
import { logout } from '@/lib/actions';

const LINKS = [
  { href: '/sala', label: 'Sala' },
  { href: '/analitica', label: 'Analítica' },
  { href: '/promociones', label: 'Promociones' },
  { href: '/', label: 'Mesas y QR' },
  { href: '/pos-simulator', label: 'Simulador de caja' },
] as const;

export function Nav({ current }: { current: (typeof LINKS)[number]['href'] }) {
  return (
    <nav className="nav no-print" aria-label="Secciones del panel">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="nav-item"
          aria-current={l.href === current ? 'page' : undefined}
        >
          {l.label}
        </Link>
      ))}
      <form action={logout} className="nav-logout">
        <button type="submit">Salir</button>
      </form>
    </nav>
  );
}
