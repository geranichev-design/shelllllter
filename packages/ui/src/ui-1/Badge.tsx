// packages/ui/src/components/primitives/Badge.tsx
import React from 'react'
import { cn } from '../../utils/cn'
import { colors, type SeverityLevel } from '../../tokens'

interface BadgeProps {
  children: React.ReactNode
  severity?: SeverityLevel
  dot?: boolean
  className?: string
}

const severityStyles: Record<SeverityLevel, string> = {
  ok:      'text-[var(--accent)] bg-[var(--accent-10)] border-[var(--accent-25)]',
  warning: 'text-[var(--color-warning)] bg-[#f59e0b]/10 border-[#f59e0b]/25',
  danger:  'text-[var(--color-danger)] bg-[#ff6b6b]/10 border-[#ff6b6b]/25',
  info:    'text-[var(--color-info)] bg-[#60a5fa]/10 border-[#60a5fa]/25',
  neutral: 'text-[var(--text-secondary)] bg-white/5 border-white/10',
}

const dotColors: Record<SeverityLevel, string> = {
  ok:      'bg-[var(--accent)]',
  warning: 'bg-[var(--color-warning)]',
  danger:  'bg-[var(--color-danger)]',
  info:    'bg-[var(--color-info)]',
  neutral: 'bg-[var(--text-muted)]',
}

export function Badge({ children, severity = 'neutral', dot = false, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5',
      'rounded-[var(--radius-md)] text-[11px] font-semibold border',
      severityStyles[severity],
      className
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[severity])} />}
      {children}
    </span>
  )
}

// ── Shelter-specific badges ────────────────────────────────────────────────────

import {
  ACCOUNTING_STATUSES,
  APPLICATION_STATUSES,
  RECORD_STATUSES,
  SHELTER_STATUSES,
  SHELTER_TYPES,
  type AccountingStatus,
  type AppStatus,
  type RecordStatus,
  type ShelterStatus,
  type ShelterType
} from '../../tokens'

function normalizeShelterStatus(status: string): ShelterStatus | null {
  const aliases: Record<string, ShelterStatus> = {
    ACTIVE: 'OPERATION',
    UNDER_INSPECTION: 'CONSTRUCTION',
    INACTIVE: 'MISUSE',
    DECOMMISSIONED: 'DESTROYED',
    PENDING: 'NEED',
    VERIFIED: 'OPERATION',
    REJECTED: 'DESTROYED'
  };

  if (status in SHELTER_STATUSES) {
    return status as ShelterStatus;
  }

  return aliases[status] ?? null;
}

export function ShelterStatusBadge({ status }: { status: string }) {
  const key = normalizeShelterStatus(status) ?? 'NEED';
  const cfg = SHELTER_STATUSES[key]
  return (
    <Badge severity={cfg.severity as SeverityLevel} dot>
      {cfg.label}
    </Badge>
  )
}

export function AccountingStatusBadge({ status }: { status: string }) {
  const cfg = ACCOUNTING_STATUSES[status as AccountingStatus] ?? ACCOUNTING_STATUSES.NEW
  return (
    <Badge severity={cfg.severity as SeverityLevel} dot>
      {cfg.label}
    </Badge>
  )
}

export function RecordStatusBadge({ status }: { status: string }) {
  const cfg = RECORD_STATUSES[status as RecordStatus] ?? RECORD_STATUSES.DRAFT
  return (
    <Badge severity={cfg.severity as SeverityLevel} dot>
      {cfg.label}
    </Badge>
  )
}

export function ShelterTypeBadge({ type }: { type: string }) {
  const cfg = SHELTER_TYPES[type as ShelterType]
  const isSpecial = type === 'MOBILE'
  return (
    <Badge severity={isSpecial ? 'info' : 'neutral'}>
      {cfg?.shortLabel ?? type}
    </Badge>
  )
}

export function AppStatusBadge({ status }: { status: string }) {
  const cfg = APPLICATION_STATUSES[status as AppStatus] ?? APPLICATION_STATUSES.SUBMITTED
  return (
    <Badge severity={cfg.severity as SeverityLevel} dot>
      {cfg.label}
    </Badge>
  )
}
