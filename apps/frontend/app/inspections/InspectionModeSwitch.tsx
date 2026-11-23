import Link from 'next/link';

export type InspectionMode = 'list' | 'planning';

const MODES: { key: InspectionMode; label: string; href: string }[] = [
  { key: 'list', label: 'Список обстежень', href: '/inspections/shelter-list' },
  { key: 'planning', label: 'Планування', href: '/inspections' },
];

export function InspectionModeSwitch({ active }: { active: InspectionMode }) {
  return (
    <div
      className="inline-flex h-9 shrink-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-0.5"
      aria-label="Перемикач режиму обстежень"
    >
      {MODES.map((mode) => {
        const isActive = mode.key === active;
        return (
          <Link
            key={mode.key}
            href={mode.href}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'inline-flex w-[148px] items-center justify-center whitespace-nowrap rounded-[calc(var(--radius-lg)-2px)] px-3.5 text-[12px] font-semibold transition-colors',
              isActive
                ? 'bg-[var(--accent)] text-[var(--color-on-accent)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            {mode.label}
          </Link>
        );
      })}
    </div>
  );
}
