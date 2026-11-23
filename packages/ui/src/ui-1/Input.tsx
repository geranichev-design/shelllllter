// packages/ui/src/components/forms/Input.tsx
import React from 'react'
import { cn } from '../../utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:   string
  required?: boolean
  error?:   string
  hint?:    string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label, required, error, hint, iconLeft, iconRight, className, id, ...props
}, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          <span>{label}</span>
          {required ? <span className="ml-1 text-[#ff6b6b]">*</span> : null}
        </label>
      )}
      <div className="relative flex items-center">
        {iconLeft && (
          <span className="absolute left-3 text-[var(--text-muted)] [&>svg]:w-3.5 [&>svg]:h-3.5 pointer-events-none">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full h-8 px-3 text-[13px] text-[var(--text-primary)]',
            'bg-[var(--bg-surface-2)] border rounded-[var(--radius-lg)]',
            'placeholder:text-[var(--text-muted)]',
            'transition-[border-color,box-shadow] duration-100',
            error
              ? 'border-[#ff6b6b]/50 focus:border-[#ff6b6b] focus:shadow-[0_0_0_3px_rgba(255,107,107,0.12)]'
              : 'border-[var(--border-strong)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-10)]',
            'outline-none',
            iconLeft  && 'pl-9',
            iconRight && 'pr-9',
            className
          )}
          {...props}
        />
        {iconRight && (
          <span className="absolute right-3 text-[var(--text-muted)] [&>svg]:w-3.5 [&>svg]:h-3.5 pointer-events-none">
            {iconRight}
          </span>
        )}
      </div>
      {error && <p className="text-[11px] text-[#ff6b6b]">{error}</p>}
      {hint && !error && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  )
})
Input.displayName = 'Input'

// ── Select ─────────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:   string
  required?: boolean
  error?:   string
  options:  { value: string; label: string }[]
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label, required, error, options, placeholder, className, id, ...props
}, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          <span>{label}</span>
          {required ? <span className="ml-1 text-[#ff6b6b]">*</span> : null}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={cn(
          'w-full h-8 px-3 text-[13px] text-[var(--text-primary)]',
          'bg-[var(--bg-surface-2)] border rounded-[var(--radius-lg)]',
          'transition-[border-color] duration-100 outline-none',
          'appearance-none cursor-pointer',
          error
            ? 'border-[#ff6b6b]/50 focus:border-[#ff6b6b]'
            : 'border-[var(--border-strong)] focus:border-[var(--accent)]',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-[#ff6b6b]">{error}</p>}
    </div>
  )
})
Select.displayName = 'Select'

// ── Textarea ───────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  required?: boolean
  error?: string
  hint?:  string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label, required, error, hint, className, id, ...props
}, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          <span>{label}</span>
          {required ? <span className="ml-1 text-[#ff6b6b]">*</span> : null}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={4}
        className={cn(
          'w-full px-3 py-2 text-[13px] text-[var(--text-primary)]',
          'bg-[var(--bg-surface-2)] border rounded-[var(--radius-lg)]',
          'placeholder:text-[var(--text-muted)] resize-y',
          'transition-[border-color] duration-100 outline-none',
          error
            ? 'border-[#ff6b6b]/50 focus:border-[#ff6b6b]'
            : 'border-[var(--border-strong)] focus:border-[var(--accent)]',
          className
        )}
        {...props}
      />
      {error && <p className="text-[11px] text-[#ff6b6b]">{error}</p>}
      {hint && !error && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  )
})
Textarea.displayName = 'Textarea'

// ── SearchInput ────────────────────────────────────────────────────────────────

import { Search, X } from 'lucide-react'

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onChange: (val: string) => void
  onSearch?: () => void
}

export function SearchInput({ value, onChange, onSearch, ...props }: SearchInputProps) {
  return (
    <div className="relative flex items-center max-w-xs w-full">
      <Search className="absolute left-3 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSearch?.()}
        className="w-full h-8 pl-9 pr-8 text-[12px] text-[var(--text-primary)] bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[var(--radius-lg)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-[border-color] duration-100"
        {...props}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Checkbox ───────────────────────────────────────────────────────────────────

import { Check } from 'lucide-react'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  indeterminate?: boolean
}

export function Checkbox({ checked, onChange, label, indeterminate }: CheckboxProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer group">
      <div
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all duration-100',
          checked || indeterminate
            ? 'bg-[var(--accent)] border-[var(--accent)]'
            : 'bg-transparent border-[var(--border-strong)] group-hover:border-[var(--border-hover)]'
        )}
      >
        {(checked || indeterminate) && (
          <Check className="w-2.5 h-2.5 text-[#051a12]" strokeWidth={3} />
        )}
      </div>
      {label && <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>}
    </label>
  )
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  size?: 'sm' | 'md'
}

export function Toggle({ checked, onChange, label, size = 'md' }: ToggleProps) {
  const track = size === 'sm' ? 'w-7 h-4' : 'w-9 h-5'
  const thumb = size === 'sm' ? 'w-3 h-3 top-0.5' : 'w-4 h-4 top-0.5'
  const on    = size === 'sm' ? 'translate-x-3.5' : 'translate-x-4'

  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer">
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative rounded-full transition-colors duration-150',
          track,
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
        )}
      >
        <div className={cn(
          'absolute left-0.5 rounded-full bg-white transition-transform duration-150',
          thumb,
          checked ? on : 'translate-x-0'
        )} />
      </div>
      {label && <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>}
    </label>
  )
}
