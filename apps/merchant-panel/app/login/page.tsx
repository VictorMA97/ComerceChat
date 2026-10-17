import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="card login">
      <h1>ComerceChat</h1>
      <p className="muted">Panel del comercio</p>
      <LoginForm />
      <p className="muted" style={{ fontSize: '.85rem' }}>
        PoC: <code>owner@casapepe.test</code> / <code>poc1234</code>
      </p>
    </main>
  );
}
