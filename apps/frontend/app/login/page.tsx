import { Home } from 'lucide-react';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import { isDemoMode } from '@/lib/demo/config';

export default function LoginPage() {
  if (isDemoMode) redirect('/dashboard');

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[var(--bg-base)] px-6 py-12">
      <section className="w-full max-w-sm rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--bg-surface)] p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <Home className="w-4 h-4 text-[var(--color-on-accent)]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">Реєстр укриттів</p>
            <p className="text-[10px] text-[var(--text-muted)]">ДСНС України · v2.4</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-[18px] font-semibold text-[var(--text-primary)]">Вхід до системи</h1>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">Введіть свої облікові дані для доступу</p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
