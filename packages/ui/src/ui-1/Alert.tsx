import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { type SeverityLevel } from '../../tokens';

interface AlertProps {
  severity?: SeverityLevel;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const alertIcons: Record<SeverityLevel, React.ElementType> = {
  ok: CheckCircle,
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Info,
  neutral: Info,
};

const alertStyles: Record<SeverityLevel, { wrap: string; icon: string }> = {
  ok: { wrap: 'bg-[var(--accent-08)] border-[var(--accent-25)]', icon: 'text-[var(--accent)]' },
  warning: { wrap: 'bg-[#f59e0b]/[0.08] border-[#f59e0b]/25', icon: 'text-[var(--color-warning)]' },
  danger: { wrap: 'bg-[#ff6b6b]/[0.08] border-[#ff6b6b]/25', icon: 'text-[var(--color-danger)]' },
  info: { wrap: 'bg-[#60a5fa]/[0.08] border-[#60a5fa]/25', icon: 'text-[var(--color-info)]' },
  neutral: { wrap: 'bg-white/[0.04] border-white/10', icon: 'text-[var(--text-secondary)]' },
};

export function Alert({ severity = 'neutral', title, children, onClose, className }: AlertProps) {
  const Icon = alertIcons[severity];
  const styles = alertStyles[severity];

  return (
    <div className={cn('flex gap-3 rounded-[var(--radius-lg)] border p-3.5', styles.wrap, className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', styles.icon)} />
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0.5 text-[12px] font-semibold text-[var(--text-primary)]">{title}</p> : null}
        <div className="text-[12px] text-[var(--text-secondary)]">{children}</div>
      </div>
      {onClose ? (
        <button type="button" onClick={onClose} className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
