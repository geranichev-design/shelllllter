// packages/ui/src/components/primitives/Button.tsx
import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize    = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:  'bg-[var(--accent)] text-[var(--color-on-accent)] font-semibold hover:opacity-90 border-transparent',
  secondary:'bg-[var(--hover-md)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--hover-strong)]',
  ghost:    'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]',
  danger:   'bg-[#ff6b6b]/10 text-[var(--color-danger)] border-[#ff6b6b]/25 hover:bg-[#ff6b6b]/20',
  outline:  'bg-transparent text-[var(--text-primary)] border-[var(--border-strong)] hover:bg-[var(--hover-md)]',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm:   'h-7  px-3   text-[11px] gap-1.5 rounded-[var(--radius-md)]',
  md:   'h-8  px-3.5 text-[12px] gap-2   rounded-[var(--radius-lg)]',
  lg:   'h-9  px-4   text-[13px] gap-2   rounded-[var(--radius-lg)]',
  icon: 'h-7  w-7    rounded-[var(--radius-md)] p-0 justify-center',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'secondary', size = 'md', loading, iconLeft, iconRight,
  className, children, disabled, ...props
}, ref) => {
  const migraText = typeof children === 'string' || typeof children === 'number' ? String(children) : undefined
  const migraState = loading ? 'loading' : disabled ? 'disabled' : 'default'
  const migraStateSuffix = migraState === 'default' ? '' : `/${migraState}`

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      data-migra-component={`Button/${variant}/${size}${migraStateSuffix}`}
      data-migra-state={migraState}
      data-migra-text={migraText}
      className={cn(
        'inline-flex items-center border transition-[background,opacity,transform] duration-100',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'active:scale-[0.97]',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        : iconLeft && <span className="flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{iconLeft}</span>
      }
      {children && <span>{children}</span>}
      {iconRight && !loading && (
        <span className="flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{iconRight}</span>
      )}
    </button>
  )
})
Button.displayName = 'Button'

// ── ToggleButton ───────────────────────────────────────────────────────────────

interface ToggleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  size?: 'sm' | 'md';
  iconLeft?: React.ReactNode;
  children?: React.ReactNode;
}

export function ToggleButton({ active, size = 'md', iconLeft, children, className, ...props }: ToggleButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 border font-medium transition-colors duration-100 outline-none',
        size === 'md'
          ? 'h-8 px-3 text-[12px] rounded-[var(--radius-lg)]'
          : 'h-7 px-2.5 text-[11px] rounded-[var(--radius-md)]',
        active
          ? 'bg-[var(--accent-10)] border-[var(--accent-40)] text-[var(--accent)]'
          : 'bg-transparent border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
        className
      )}
      {...props}
    >
      {iconLeft && <span className="flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{iconLeft}</span>}
      {children}
    </button>
  )
}
