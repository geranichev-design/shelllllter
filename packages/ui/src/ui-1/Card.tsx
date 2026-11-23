// packages/ui/src/components/layout/Card.tsx
import React from 'react'
import { cn } from '../../utils/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children:    React.ReactNode
  className?:  string
  accent?:     string  // hex color for top stripe
  padding?:    'none' | 'sm' | 'md' | 'lg'
  hover?:      boolean
}

const paddingMap = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }

export function Card({ children, className, accent, padding = 'md', hover, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'relative bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-xl)] overflow-hidden',
        hover && 'transition-[border-color,background] duration-100 cursor-pointer hover:border-[var(--border-hover)] hover:bg-[var(--hover)]',
        paddingMap[padding],
        className
      )}
      {...props}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      )}
      {children}
    </div>
  )
}

// ── StatCard ───────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:     string
  value:     string | number
  delta?:    string
  deltaDir?: 'up' | 'down' | 'neutral'
  accent?:   string
  className?: string
}

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function StatCard({ label, value, delta, deltaDir = 'neutral', accent, className }: StatCardProps) {
  const DeltaIcon = deltaDir === 'up' ? TrendingUp : deltaDir === 'down' ? TrendingDown : Minus
  const deltaColor = deltaDir === 'up' ? 'text-[var(--accent)]' : deltaDir === 'down' ? 'text-[#ff6b6b]' : 'text-[var(--text-muted)]'

  return (
    <Card accent={accent} className={cn('pt-4', className)}>
      <p className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight leading-none">{value}</p>
      {delta && (
        <div className={cn('flex items-center gap-1 mt-2 text-[11px]', deltaColor)}>
          <DeltaIcon className="w-3 h-3" />
          <span>{delta}</span>
        </div>
      )}
    </Card>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title:     string
  subtitle?: string
  dotColor?: string
  actions?:  React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, dotColor = 'var(--accent)', actions, className }: PageHeaderProps) {
  return (
    <div
      data-migra-component="Layout/PageHeader"
      data-migra-title={title}
      data-migra-subtitle={subtitle}
      className={cn('sticky top-0 z-30 flex min-h-[88px] shrink-0 flex-col gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 py-4 md:h-[88px] md:flex-row md:items-center md:justify-between', className)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight">{title}</h1>
          {subtitle && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}

// ── SectionLabel ───────────────────────────────────────────────────────────────

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.08em] mb-1', className)}>
      {children}
    </p>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <div className={cn('border-t border-[var(--border)]', className)} />
}

// ── Empty state ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?:     React.ReactNode
  title:     string
  message?:  string
  action?:   React.ReactNode
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      {icon && <div className="mb-4 text-[var(--text-ghost)] [&>svg]:w-10 [&>svg]:h-10">{icon}</div>}
      <p className="text-[14px] font-medium text-[var(--text-secondary)] mb-1">{title}</p>
      {message && <p className="text-[12px] text-[var(--text-muted)] mb-4">{message}</p>}
      {action}
    </div>
  )
}
