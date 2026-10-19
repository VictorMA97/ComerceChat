import Link from 'next/link';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="card login">
      <h1>ComerceChat</h1>
      <p className="muted">Panel del comercio</p>
      <LoginForm />
      <p className="muted small">
        ¿Aún no tienes cuenta? <Link href="/registro">Registra tu comercio</Link>
      </p>
      <p className="muted small">
        PoC: <code>owner@casapepe.test</code> / <code>poc1234</code>. Código del doble factor:{' '}
        <code>pnpm poc:totp</code>.
      </p>
    </main>
  );
}
