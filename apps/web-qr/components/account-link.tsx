import Link from 'next/link';
import { userToken } from '@/lib/user';

/** Acceso a «Mis puntos» (o a entrar) en la cabecera de la web QR. */
export async function AccountLink() {
  const loggedIn = Boolean(await userToken());
  return (
    <p className="account-link">
      <Link href="/cuenta">{loggedIn ? 'Mis puntos y cupones →' : 'Entrar con mi móvil →'}</Link>
    </p>
  );
}
