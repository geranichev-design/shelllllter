import { type ReactNode } from 'react';
import { InspectionModeSwitch, type InspectionMode } from './InspectionModeSwitch';

export function InspectionHeader({ active, actions }: { active: InspectionMode; actions?: ReactNode }) {
  return (
    <div className="sticky top-0 z-30 flex min-h-[88px] shrink-0 flex-col gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 py-4 md:h-[88px] md:flex-row md:items-center md:justify-between md:overflow-visible">
      <InspectionModeSwitch active={active} />
      {actions ? <div className="flex min-h-9 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
