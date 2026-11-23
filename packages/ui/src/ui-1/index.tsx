// packages/ui/src/components/feedback/index.tsx
import React from 'react'
import { cn } from '../../utils/cn'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { type SeverityLevel } from '../../tokens'

// ── Spinner ────────────────────────────────────────────────────────────────────

interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; className?: string }
const spinnerSize = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-7 h-7' }

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full border-2 border-white/10 border-t-[var(--accent)] animate-spin',
        spinnerSize[size],
        className
      )}
    />
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white/[0.06] rounded-[var(--radius-md)] animate-pulse', className)} />
  )
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-white/[0.04]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-2.5">
          <Skeleton className="h-3.5" style={{ width: `${60 + Math.random() * 30}%` } as React.CSSProperties} />
        </td>
      ))}
    </tr>
  )
}

// ── Alert ──────────────────────────────────────────────────────────────────────

interface AlertProps {
  severity?:  SeverityLevel
  title?:     string
  children:   React.ReactNode
  onClose?:   () => void
  className?: string
}

const alertIcons: Record<SeverityLevel, React.ElementType> = {
  ok:      CheckCircle,
  warning: AlertTriangle,
  danger:  AlertCircle,
  info:    Info,
  neutral: Info,
}

const alertStyles: Record<SeverityLevel, { wrap: string; icon: string }> = {
  ok:      { wrap: 'bg-[var(--accent-08)] border-[var(--accent-25)]',      icon: 'text-[var(--accent)]' },
  warning: { wrap: 'bg-[#f59e0b]/[0.08] border-[#f59e0b]/25',              icon: 'text-[var(--color-warning)]' },
  danger:  { wrap: 'bg-[#ff6b6b]/[0.08] border-[#ff6b6b]/25',              icon: 'text-[var(--color-danger)]' },
  info:    { wrap: 'bg-[#60a5fa]/[0.08] border-[#60a5fa]/25',              icon: 'text-[var(--color-info)]' },
  neutral: { wrap: 'bg-white/[0.04] border-white/10',                      icon: 'text-[var(--text-secondary)]' },
}

export function Alert({ severity = 'neutral', title, children, onClose, className }: AlertProps) {
  const Icon = alertIcons[severity]
  const styles = alertStyles[severity]
  return (
    <div className={cn('flex gap-3 p-3.5 rounded-[var(--radius-lg)] border', styles.wrap, className)}>
      <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', styles.icon)} />
      <div className="flex-1 min-w-0">
        {title && <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-0.5">{title}</p>}
        <div className="text-[12px] text-[var(--text-secondary)]">{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-[#4a5568] hover:text-[#8892a4] flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────────────────────

interface ProgressProps {
  value:     number  // 0–100
  max?:      number
  color?:    string
  showLabel?: boolean
  className?: string
}

export function Progress({ value, max = 100, color, showLabel, className }: ProgressProps) {
  const pct = Math.round(Math.min((value / max) * 100, 100))
  const barColor = color ?? (pct >= 80 ? 'var(--accent)' : pct >= 50 ? '#f59e0b' : '#ff6b6b')

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: barColor }}>
          {pct}%
        </span>
      )}
    </div>
  )
}

// ── Coverage indicator (for map sidebar) ──────────────────────────────────────

interface CoverageIndicatorProps {
  value:     number  // 0–100
  label:     string
  sublabel?: string
  className?: string
}

export function CoverageIndicator({ value, label, sublabel, className }: CoverageIndicatorProps) {
  const color =
    value >= 80 ? 'var(--accent)' :
    value >= 60 ? '#5DCAA5' :
    value >= 40 ? '#f59e0b' :
    value >= 20 ? '#D85A30' : '#ff6b6b'

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[#f0f2f8] truncate">{label}</span>
        <span className="text-[12px] font-bold tabular-nums ml-2 flex-shrink-0" style={{ color }}>{value}%</span>
      </div>
      <div className="h-[3px] bg-white/[0.07] rounded-full">
        <div className="h-[3px] rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      {sublabel && <p className="text-[10px] text-[#4a5568]">{sublabel}</p>}
    </div>
  )
}
