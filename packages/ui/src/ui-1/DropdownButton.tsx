'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn';
import { type ButtonVariant, type ButtonSize } from './Button';

export interface DropdownAction {
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

interface DropdownButtonProps {
  label: string;
  actions: DropdownAction[];
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: React.ReactNode;
  disabled?: boolean;
  align?: 'left' | 'right';
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:   'bg-[var(--accent)] text-[#051a12] font-semibold border-transparent hover:opacity-90',
  secondary: 'bg-[var(--hover-md)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--hover-strong)]',
  ghost:     'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]',
  danger:    'bg-[#ff6b6b]/10 text-[#ff6b6b] border-[#ff6b6b]/25 hover:bg-[#ff6b6b]/20',
  outline:   'bg-transparent text-[var(--text-primary)] border-[var(--border-strong)] hover:bg-[var(--hover-md)]',
};

const sizeStyles: Record<ButtonSize, { button: string; icon: string; chevron: string }> = {
  sm:   { button: 'h-7  px-3   text-[11px] gap-1.5 rounded-[var(--radius-md)]', icon: 'h-7  w-7  rounded-[var(--radius-md)]',  chevron: 'h-3   w-3'   },
  md:   { button: 'h-8  px-3.5 text-[12px] gap-2   rounded-[var(--radius-lg)]', icon: 'h-8  w-8  rounded-[var(--radius-lg)]',  chevron: 'h-3.5 w-3.5' },
  lg:   { button: 'h-9  px-4   text-[13px] gap-2   rounded-[var(--radius-lg)]', icon: 'h-9  w-9  rounded-[var(--radius-lg)]',  chevron: 'h-4   w-4'   },
  icon: { button: 'h-7  w-7    rounded-[var(--radius-md)] p-0 justify-center',  icon: 'h-7  w-7  rounded-[var(--radius-md)]',  chevron: 'h-3   w-3'   },
};

const dividerStyle: Record<ButtonVariant, string> = {
  primary:   'bg-[#051a12]/20',
  secondary: 'bg-[var(--border)]',
  ghost:     'bg-[var(--border-subtle)]',
  danger:    'bg-[#ff6b6b]/25',
  outline:   'bg-[var(--border-strong)]',
};

export function DropdownButton({
  label,
  actions,
  variant = 'secondary',
  size = 'md',
  iconLeft,
  disabled,
  align = 'right',
  className,
}: DropdownButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sz = sizeStyles[size];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const baseClass = cn(
    'inline-flex items-center border transition-[background,opacity,transform] duration-100',
    'disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]',
    variantStyles[variant],
  );

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      {/* Primary label button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(baseClass, sz.button, 'rounded-r-none border-r-0')}
      >
        {iconLeft && (
          <span className="flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{iconLeft}</span>
        )}
        <span>{label}</span>
      </button>

      {/* Divider */}
      <span className={cn('self-stretch w-px shrink-0', dividerStyle[variant])} />

      {/* Chevron toggle button */}
      <button
        type="button"
        disabled={disabled}
        aria-label="Відкрити список дій"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(baseClass, sz.icon, 'rounded-l-none border-l-0 px-0')}
      >
        <ChevronDown className={cn(sz.chevron, 'transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-1 min-w-[180px]',
            'rounded-[var(--radius-lg)] border border-[var(--border-strong)]',
            'bg-[var(--bg-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.55)]',
            'py-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {actions.map((action, index) => (
            <React.Fragment key={index}>
              {action.separator && index > 0 && (
                <div className="my-1 h-px bg-[var(--border-subtle)]" />
              )}
              <button
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  action.onClick();
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  action.danger
                    ? 'text-[#ff6b6b] hover:bg-[#ff6b6b]/10'
                    : 'text-[var(--text-primary)] hover:bg-[var(--hover-md)]',
                )}
              >
                {action.icon && (
                  <span className="flex-shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5 text-[var(--text-muted)]">
                    {action.icon}
                  </span>
                )}
                <span className="flex-1">{action.label}</span>
                {action.badge !== undefined && (
                  <span className="ml-auto flex-shrink-0 rounded-full bg-[var(--hover-strong)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--text-muted)]">
                    {action.badge}
                  </span>
                )}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
