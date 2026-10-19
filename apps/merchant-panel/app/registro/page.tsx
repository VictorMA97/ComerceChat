import Link from 'next/link';
import { RegisterForm } from '@/components/register-form';

export default function RegisterPage() {
  return (
    <main className="card login">
      <h1>Registra tu comercio</h1>
      <p className="muted">
        Después activarás el doble factor con una app de autenticación (Google Authenticator,
        1Password, Authy…).
      </p>
      <RegisterForm />
      <p className="muted small">
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </main>
  );
}
