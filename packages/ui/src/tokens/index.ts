export const colors = {
  bg: {
    base: '#0a0b0e',
    surface: '#111318',
    raised: '#181c23',
    overlay: '#1e2330',
    hover: 'rgba(255,255,255,0.04)',
    active: 'rgba(255,255,255,0.07)'
  },
  border: {
    subtle: 'rgba(255,255,255,0.06)',
    default: 'rgba(255,255,255,0.10)',
    strong: 'rgba(255,255,255,0.18)',
    focus: '#00e5a0'
  },
  text: {
    primary: '#f0f2f8',
    secondary: '#8892a4',
    tertiary: '#4a5568',
    disabled: '#2d3748',
    inverse: '#0a0b0e'
  },
  accent: '#00e5a0',
  purple: '#6c63ff',
  amber: '#f59e0b',
  red: '#ff6b6b',
  blue: '#60a5fa',
  status: {
    ok: {
      text: '#00e5a0',
      bg: 'rgba(0,229,160,0.10)',
      border: 'rgba(0,229,160,0.25)',
      dot: '#00e5a0'
    },
    warning: {
      text: '#f59e0b',
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.25)',
      dot: '#f59e0b'
    },
    danger: {
      text: '#ff6b6b',
      bg: 'rgba(255,107,107,0.10)',
      border: 'rgba(255,107,107,0.25)',
      dot: '#ff6b6b'
    },
    neutral: {
      text: '#8892a4',
      bg: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.10)',
      dot: '#4a5568'
    },
    info: {
      text: '#60a5fa',
      bg: 'rgba(96,165,250,0.10)',
      border: 'rgba(96,165,250,0.25)',
      dot: '#60a5fa'
    }
  }
} as const;

export const typography = {
  fontSans: "'Geist', 'Inter', system-ui, sans-serif",
  fontMono: "'Geist Mono', 'JetBrains Mono', monospace",
  size: {
    '2xs': '10px',
    xs: '11px',
    sm: '12px',
    md: '13px',
    base: '14px',
    lg: '15px',
    xl: '16px',
    '2xl': '18px',
    '3xl': '20px',
    '4xl': '24px'
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  leading: {
    tight: 1.2,
    snug: 1.4,
    normal: 1.6,
    loose: 1.8
  }
} as const;

export const spacing = {
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px'
} as const;

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px'
} as const;

export const shadow = {
  sm: '0 1px 3px rgba(0,0,0,0.4)',
  md: '0 4px 12px rgba(0,0,0,0.5)',
  lg: '0 8px 24px rgba(0,0,0,0.6)',
  glow: {
    accent: '0 0 20px rgba(0,229,160,0.15)',
    purple: '0 0 20px rgba(108,99,255,0.15)',
    red: '0 0 20px rgba(255,107,107,0.15)'
  }
} as const;

export const transition = {
  fast: 'all 0.1s ease',
  normal: 'all 0.15s ease',
  slow: 'all 0.25s ease'
} as const;

export const SHELTER_TYPES = {
  STATIC: { label: 'Стаціонарне', shortLabel: 'Стац.' },
  MOBILE: { label: 'Пересувне', shortLabel: 'Мобільне' }
} as const;

export const SHELTER_STATUSES = {
  NEED: { label: 'Потреба', severity: 'warning' },
  PROJECT: { label: 'Проєкт', severity: 'info' },
  CONSTRUCTION: { label: 'Будівництво', severity: 'warning' },
  OPERATION: { label: 'Експлуатація', severity: 'ok' },
  MODERNIZATION: { label: 'Модернізація', severity: 'info' },
  REPAIR: { label: 'Ремонт', severity: 'warning' },
  CONSERVATION: { label: 'Консервація', severity: 'neutral' },
  MISUSE: { label: 'Не за призначенням', severity: 'danger' },
  DESTROYED: { label: 'Знищено', severity: 'danger' }
} as const;

export const ACCOUNTING_STATUSES = {
  NEW: { label: 'Новий', severity: 'neutral' },
  IN_PROGRESS: { label: 'В обробці', severity: 'warning' },
  ACCOUNTED: { label: 'Обліковується', severity: 'ok' },
  REMOVED: { label: 'Вилучений з обліку', severity: 'danger' },
  REJECTED: { label: 'Відхилено', severity: 'danger' }
} as const;

export const RECORD_STATUSES = {
  DRAFT: { label: 'Чернетка', severity: 'neutral' },
  ACTIVE: { label: 'Активний', severity: 'ok' },
  SUSPENDED: { label: 'Призупинений', severity: 'warning' },
  DELETED: { label: 'Видалений', severity: 'danger' }
} as const;

export const APPLICATION_STATUSES = {
  SUBMITTED: { label: 'Подана', severity: 'neutral' },
  DOCUMENT_REVIEW: { label: 'Перевірка доків', severity: 'info' },
  INSPECTION_ASSIGNED: { label: 'Призначено виїзд', severity: 'warning' },
  INSPECTION_DONE: { label: 'Інспекцію проведено', severity: 'info' },
  APPROVED: { label: 'Схвалена', severity: 'ok' },
  REJECTED: { label: 'Відхилена', severity: 'danger' },
  RETURNED: { label: 'На доопрацювання', severity: 'warning' }
} as const;

export const USER_ROLES = {
  SUPER_ADMIN: { label: 'Суперадмін', level: 0 },
  REGION_ADMIN: { label: 'Обласний адмін', level: 1 },
  DISTRICT_ADMIN: { label: 'Районний адмін', level: 2 },
  ANALYST: { label: 'Аналітик', level: 3 },
  INSPECTOR: { label: 'Інспектор', level: 3 }
} as const;

export type SeverityLevel = 'ok' | 'warning' | 'danger' | 'neutral' | 'info';
export type ShelterType = keyof typeof SHELTER_TYPES;
export type ShelterStatus = keyof typeof SHELTER_STATUSES;
export type AccountingStatus = keyof typeof ACCOUNTING_STATUSES;
export type RecordStatus = keyof typeof RECORD_STATUSES;
export type AppStatus = keyof typeof APPLICATION_STATUSES;
export type UserRole = keyof typeof USER_ROLES;
