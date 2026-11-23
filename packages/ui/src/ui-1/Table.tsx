// packages/ui/src/components/data/Table.tsx
import React, { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Checkbox } from '../forms/Input'
import { Button } from '../primitives/Button'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key:       string
  header:    string
  width?:    string
  sortable?: boolean
  className?: string
  cell:      (row: T, index: number) => React.ReactNode
}

export interface TableProps<T> {
  data:        T[]
  columns:     Column<T>[]
  keyExtractor: (row: T) => string
  onRowClick?:  (row: T) => void

  // Sorting
  sortBy?:      string
  sortDir?:     'asc' | 'desc'
  onSort?:      (key: string) => void

  // Selection
  selectable?:  boolean
  selected?:    string[]
  onSelect?:    (ids: string[]) => void

  // State
  loading?:     boolean
  emptyMessage?: string

  className?:   string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function Table<T>({
  data, columns, keyExtractor, onRowClick,
  sortBy, sortDir, onSort,
  selectable, selected = [], onSelect,
  loading, emptyMessage = 'Дані відсутні',
  className,
}: TableProps<T>) {

  const allSelected = data.length > 0 && data.every(r => selected.includes(keyExtractor(r)))
  const someSelected = selected.length > 0 && !allSelected

  const toggleAll = () => {
    if (!onSelect) return
    allSelected ? onSelect([]) : onSelect(data.map(keyExtractor))
  }

  const toggleRow = (id: string) => {
    if (!onSelect) return
    selected.includes(id)
      ? onSelect(selected.filter(s => s !== id))
      : onSelect([...selected, id])
  }

  return (
    <div className={cn('w-full overflow-auto', className)}>
      <table className="w-full border-collapse text-[12px]" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {selectable && (
              <th className="w-9 py-2.5 px-2.5 border-b border-[var(--border)]">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                data-migra-column-key={col.key}
                style={{ width: col.width }}
                className={cn(
                  'text-left py-2.5 px-2.5 text-[10px] font-semibold text-[var(--text-secondary)]',
                  'uppercase tracking-[0.06em] border-b border-[var(--border)]',
                  'whitespace-nowrap',
                  col.sortable && 'cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors',
                  col.className
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    sortBy === col.key
                      ? sortDir === 'asc'
                        ? <ChevronUp   className="w-3 h-3 text-[var(--accent)] flex-shrink-0" />
                        : <ChevronDown className="w-3 h-3 text-[var(--accent)] flex-shrink-0" />
                      : <ChevronsUpDown className="w-3 h-3 opacity-30 flex-shrink-0" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-12 text-center text-[var(--text-muted)]">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                  Завантаження...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-12 text-center text-[var(--text-muted)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const id = keyExtractor(row)
              const isSelected = selected.includes(id)
              return (
                <tr
                  key={id}
                  className={cn(
                    'border-b border-[var(--border-subtle)] transition-colors duration-75 group',
                    onRowClick && 'cursor-pointer',
                    isSelected ? 'bg-[var(--accent-04)]' : 'hover:bg-[var(--hover)]'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td className="py-2.5 px-2.5">
                      <Checkbox checked={isSelected} onChange={() => toggleRow(id)} />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} data-migra-column-key={col.key} className={cn('py-2.5 px-2.5 align-middle', col.className)}>
                      {col.cell(row, rowIndex)}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────────

interface PaginationProps {
  page:       number
  totalPages: number
  total:      number
  limit:      number
  onChange:   (page: number) => void
}

export function Pagination({ page, totalPages, total, limit, onChange }: PaginationProps) {
  const from = (page - 1) * limit + 1
  const to   = Math.min(page * limit, total)

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between pt-3 text-[11px] text-[var(--text-muted)]">
      <span>{from}–{to} з {total.toLocaleString('uk')}</span>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="text-[11px]"
        >
          ‹
        </Button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="w-7 text-center">···</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={cn(
                'w-7 h-7 rounded-[var(--radius-md)] text-[11px] transition-colors',
                p === page
                  ? 'bg-[var(--accent)] text-[#051a12] font-bold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover-md)]'
              )}
            >
              {p}
            </button>
          )
        )}
        <Button
          size="icon"
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="text-[11px]"
        >
          ›
        </Button>
      </div>
    </div>
  )
}

// ── CapacityBar ────────────────────────────────────────────────────────────────

export function CapacityBar({ capacity, status }: { capacity: number; status: string }) {
  const max = 10000
  const pct = Math.min((capacity / max) * 100, 100)
  const statusColors: Record<string, string> = {
    NEED: '#f59e0b',
    PROJECT: '#60a5fa',
    CONSTRUCTION: '#f59e0b',
    OPERATION: 'var(--accent)',
    MODERNIZATION: '#60a5fa',
    REPAIR: '#f59e0b',
    CONSERVATION: '#8892a4',
    MISUSE: '#ff6b6b',
    DESTROYED: '#ff6b6b',
    ACTIVE: 'var(--accent)',
    UNDER_INSPECTION: '#f59e0b',
    INACTIVE: '#ff6b6b',
    DECOMMISSIONED: '#8892a4'
  }
  const color = statusColors[status] ?? '#ff6b6b'
  const label = capacity >= 1000 ? `${(capacity / 1000).toFixed(capacity >= 10000 ? 0 : 1)}K` : String(capacity)

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <span className="text-[12px] font-semibold text-[var(--text-primary)] w-10 shrink-0 tabular-nums">{label}</span>
      <div className="flex-1 h-[3px] bg-[var(--border)] rounded-full">
        <div className="h-[3px] rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
