// packages/ui/src/components/layout/Sidebar.tsx
'use client'
import React from 'react'
import { cn } from '../../utils/cn'

// ── Nav item ───────────────────────────────────────────────────────────────────

export interface NavItem {
  key:      string
  label:    string
  icon:     React.ReactNode
  badge?:   string | number
  badgeColor?: 'green' | 'amber' | 'red'
  href?:    string
}

interface NavItemProps extends NavItem {
  active:  boolean
  onClick: () => void
}

const badgeColors = {
  green: 'bg-[var(--accent-15)] text-[var(--accent)]',
  amber: 'bg-[#f59e0b]/15 text-[#f59e0b]',
  red:   'bg-[#ff6b6b]/15 text-[#ff6b6b]',
}

function NavItemRow({ label, icon, badge, badgeColor = 'green', active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      data-migra-component={`Layout/NavItem/${active ? 'active' : 'default'}`}
      data-migra-state={active ? 'active' : 'default'}
      data-migra-title={label}
      data-migra-badge={badge}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-lg)]',
        'text-[12.5px] transition-[background,color,border] duration-100',
        'border border-transparent',
        active
          ? 'bg-gradient-to-r from-[var(--accent-10)] to-[#6c63ff]/07 text-[var(--accent)] font-medium border-[var(--accent-15)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]'
      )}
    >
      <span className={cn('w-4 h-4 flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4', active ? 'opacity-100' : 'opacity-60')}>
        {icon}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      {badge !== undefined && (
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', badgeColors[badgeColor])}>
          {badge}
        </span>
      )}
    </button>
  )
}

// ── Nav group ──────────────────────────────────────────────────────────────────

export interface NavGroup {
  label: string
  items: NavItem[]
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  logo:             React.ReactNode
  groups:           NavGroup[]
  activeKey:        string
  onNavigate:       (key: string) => void
  footer?:          React.ReactNode
  className?:       string
  extraNavContent?: React.ReactNode
}

export function Sidebar({ logo, groups, activeKey, onNavigate, footer, className, extraNavContent }: SidebarProps) {
  return (
    <aside
      data-migra-component="Layout/Sidebar"
      className={cn(
        'flex flex-col w-full flex-shrink-0 md:w-[224px]',
        'bg-[var(--bg-surface)] border-b border-[var(--border)] md:border-r md:border-b-0',
        'h-auto md:h-dvh',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-[88px] shrink-0 items-center border-b border-[var(--border)] px-4">{logo}</div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 max-h-[40dvh] md:max-h-none">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-[var(--text-ghost)] uppercase tracking-[0.08em] px-2.5 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItemRow
                  key={item.key}
                  label={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  badgeColor={item.badgeColor}
                  href={item.href}
                  active={activeKey === item.key}
                  onClick={() => onNavigate(item.key)}
                />
              ))}
            </div>
          </div>
        ))}
        {extraNavContent}
      </nav>

      {/* Footer */}
      {footer && <div className="px-2.5 py-3 border-t border-[var(--border)]">{footer}</div>}
    </aside>
  )
}

// ── Logo component ─────────────────────────────────────────────────────────────

interface LogoProps {
  name:    string
  subtitle?: string
  icon?:   React.ReactNode
}

export function Logo({ name, subtitle, icon }: LogoProps) {
  return (
    <div
      data-migra-component="Layout/Logo"
      data-migra-title={name}
      data-migra-subtitle={subtitle}
      className="flex items-center gap-2.5"
    >
      <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
        {icon ?? <span className="text-[#051a12] font-bold text-[13px]">Р</span>}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[var(--text-primary)] tracking-tight leading-tight">{name}</p>
        {subtitle && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── User footer ────────────────────────────────────────────────────────────────

interface UserFooterProps {
  firstName: string
  lastName:  string
  role:      string
}

export function UserFooter({ firstName, lastName, role }: UserFooterProps) {
  const letter = (firstName?.[0] ?? lastName?.[0] ?? 'U').toUpperCase()
  return (
    <div
      data-migra-component="Layout/UserFooter"
      data-migra-user={`${firstName} ${lastName}`.trim()}
      data-migra-role={role}
      className="flex items-center gap-2.5 px-1"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6c63ff] to-[var(--accent)] flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0 shadow-[0_0_0_1px_var(--ring)]">
        {letter}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{firstName} {lastName}</p>
        <p className="text-[10px] text-[var(--text-muted)] truncate">{role}</p>
      </div>
    </div>
  )
}
