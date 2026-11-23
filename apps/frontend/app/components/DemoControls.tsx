'use client';

import { useEffect, useState } from 'react';
import { getStoredAuth, setStoredAuth } from '@/lib/auth';
import { createDemoAuth, demoAccounts, isDemoMode } from '@/lib/demo/config';

export function DemoControls() {
  const [role, setRole] = useState('DSNS');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isDemoMode) setRole(getStoredAuth()?.user.role ?? 'DSNS');
  }, []);

  if (!isDemoMode) return null;

  return (
    <aside aria-label="Керування демоверсією" className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-[11px] text-[var(--text-secondary)] md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-[var(--accent)]">Демоверсія</span>
        <span>Тестові дані</span>
        <label className="flex items-center gap-2">
          Роль
          <select
            aria-label="Роль у демоверсії"
            value={role}
            className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-[var(--text-primary)]"
            onChange={event => {
              setStoredAuth(createDemoAuth(event.target.value));
              window.location.assign('/dashboard');
            }}
          >
            {demoAccounts.map(account => <option key={account.role} value={account.role}>{account.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="ml-auto rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--hover)]"
          onClick={async () => {
            try {
              const { resetDemoData } = await import('@/lib/demo/api');
              resetDemoData();
              window.location.assign('/dashboard');
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Не вдалося відновити приклад.');
            }
          }}
        >
          Відновити приклад
        </button>
      </div>
      {error ? <p role="alert" className="mt-2">{error}</p> : null}
    </aside>
  );
}
