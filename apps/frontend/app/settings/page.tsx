'use client';

import { AppShell } from '@/app/components/AppShell';
import { PageHeader, Card } from '@repo/ui';
import { useTheme } from '@/app/providers/ThemeProvider';
import { clearStoredAuth } from '@/lib/auth';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const router = useRouter();

  function handleLogout() {
    clearStoredAuth();
    router.replace('/login');
  }

  return (
    <AppShell>
      <PageHeader title="Налаштування" subtitle="Система / Налаштування" />
      <div className="p-6">
        <div className="max-w-2xl space-y-6">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-ghost)] uppercase tracking-[0.08em] mb-3">
              Зовнішній вигляд
            </p>
            <Card>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[var(--radius-lg)] bg-[var(--hover-md)] flex items-center justify-center flex-shrink-0">
                    {theme === 'dark'
                      ? <Moon className="w-4 h-4 text-[var(--text-secondary)]" />
                      : <Sun className="w-4 h-4 text-[var(--text-secondary)]" />
                    }
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">Тема інтерфейсу</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {theme === 'dark' ? 'Темна тема' : 'Світла тема'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  role="switch"
                  aria-checked={theme === 'light'}
                  aria-label="Перемкнути тему інтерфейсу"
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    theme === 'light' ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                      theme === 'light' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </Card>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-ghost)] uppercase tracking-[0.08em] mb-3">
              Обліковий запис
            </p>
            <Card>
              <div className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[var(--radius-lg)] bg-[#ff6b6b]/10 flex items-center justify-center flex-shrink-0">
                    <LogOut className="w-4 h-4 text-[var(--color-danger)]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">Завершити сесію</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Вийти з поточного облікового запису.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[#ff6b6b]/20 bg-[#ff6b6b]/10 px-4 text-[12px] font-medium text-[var(--color-danger)] transition-colors hover:bg-[#ff6b6b]/15 hover:border-[#ff6b6b]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b6b]/35"
                  aria-label="Вийти з системи"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Вийти</span>
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
