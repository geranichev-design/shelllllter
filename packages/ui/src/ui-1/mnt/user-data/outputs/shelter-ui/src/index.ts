// packages/ui/src/index.ts
// ─── Single entry point for the entire @shelter/ui design system ───────────────

// Tokens & constants
export * from './tokens'
export { cn } from './utils/cn'

// Hooks
export { useDebounce }      from './utils/cn'  // re-exported below properly
export { useLocalStorage }  from './utils/cn'

// Primitives
export { Button }           from './components/primitives/Button'
export type { ButtonVariant, ButtonSize } from './components/primitives/Button'

export { Badge, ShelterStatusBadge, ShelterTypeBadge, AppStatusBadge }
  from './components/primitives/Badge'

// Forms
export { Input, Select, Textarea, SearchInput, Checkbox, Toggle }
  from './components/forms/Input'

// Layout
export { Card, StatCard, PageHeader, SectionLabel, Divider, EmptyState }
  from './components/layout/Card'

export { Sidebar, Logo, UserFooter }
  from './components/layout/Sidebar'
export type { NavItem, NavGroup }
  from './components/layout/Sidebar'

// Data
export { Table, Pagination, CapacityBar }
  from './components/data/Table'
export type { Column, TableProps }
  from './components/data/Table'

// Feedback
export { Spinner, Skeleton, SkeletonRow, Alert, Progress, CoverageIndicator }
  from './components/feedback'

// CSS — import this in apps/web/src/app/globals.css
// import '@shelter/ui/src/tokens/globals.css'
