'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Map,
  List,
  ClipboardList,
  FileText,
  Settings,
  Home,
  HelpCircle,
  HandHeart,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Bell,
  Check,
  ClipboardCheck,
} from 'lucide-react';
import { Sidebar, Logo } from '@repo/ui';
import { ApiError, apiFetch } from '@/lib/api';
import { clearStoredAuth, hasStoredAuth } from '@/lib/auth';

type NavGroup = {
  label: string;
  items: {
    key: string;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: 'green' | 'amber' | 'red';
    href?: string;
  }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Огляд',
    items: [
      { key: '/dashboard', label: 'Дашборд', icon: <LayoutDashboard />, href: '/dashboard' },
      { key: '/coverage-map', label: 'Мапа', icon: <Map />, href: '/coverage-map' },
    ],
  },
  {
    label: 'Облік',
    items: [
      { key: '/shelters', label: 'Список укриттів', icon: <List />, badgeColor: 'green', href: '/shelters' },
      { key: '/shelter-requests', label: 'Пропрозиції', icon: <ClipboardList />, badgeColor: 'amber', href: '/shelter-requests' },
      { key: '/documents', label: 'Документи', icon: <FileText />, href: '/documents' },
    ],
  },
  {
    label: 'Обстеження',
    items: [
      { key: '/inspections/shelter-list', label: 'Огляди об\'єктів', icon: <ClipboardCheck />, href: '/inspections/shelter-list' },
    ],
  },
];

// ── FAQ ─────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'Як додати нове укриття?',
    a: 'Перейдіть до "Список укриттів" → натисніть "Додати укриття" та заповніть форму.',
  },
  {
    q: 'Як змінити статус укриття?',
    a: 'Відкрийте картку укриття та оберіть новий статус у відповідному полі.',
  },
  {
    q: 'Хто може подавати пропозиції?',
    a: 'Користувачі з роллю "Регіональний" або "ДСНС".',
  },
  {
    q: 'Де знайти звіти?',
    a: 'Розділ "Звіти" у бічному меню.',
  },
];

function FaqSection() {
  const [open, setOpen] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-lg)] text-[12.5px] text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)] transition-colors"
      >
        <span className="w-4 h-4 flex-shrink-0 opacity-60 [&>svg]:w-4 [&>svg]:h-4"><HelpCircle /></span>
        <span className="flex-1 text-left">FAQ</span>
        <span className="w-4 h-4 opacity-40 [&>svg]:w-4 [&>svg]:h-4">
          {open ? <ChevronDown /> : <ChevronRight />}
        </span>
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-2">
          {FAQ_ITEMS.map((item, idx) => (
            <div key={idx}>
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full flex items-start gap-2 px-2.5 py-1.5 rounded-[var(--radius-md)] text-[11.5px] text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)] transition-colors text-left"
              >
                <span className="flex-1 leading-tight">{item.q}</span>
                <span className="w-3 h-3 mt-0.5 opacity-40 flex-shrink-0 [&>svg]:w-3 [&>svg]:h-3">
                  {openIdx === idx ? <ChevronDown /> : <ChevronRight />}
                </span>
              </button>
              {openIdx === idx && (
                <p className="px-2.5 pb-2 text-[11px] text-[var(--text-muted)] leading-relaxed">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── More Links ───────────────────────────────────────────────────────────────

const MORE_LINKS = [
  { label: 'Посилання 1', href: '#' },
  { label: 'Посилання 2', href: '#' },
  { label: 'Посилання 3', href: '#' },
];

function MoreLinksSection() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-lg)] text-[12.5px] text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)] transition-colors"
      >
        <span className="w-4 h-4 flex-shrink-0 opacity-60 [&>svg]:w-4 [&>svg]:h-4"><ExternalLink /></span>
        <span className="flex-1 text-left">Більше</span>
        <span className="w-4 h-4 opacity-40 [&>svg]:w-4 [&>svg]:h-4">
          {open ? <ChevronDown /> : <ChevronRight />}
        </span>
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-2">
          {MORE_LINKS.map((link, idx) => (
            <a
              key={idx}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-md)] text-[11.5px] text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)] transition-colors"
            >
              <span className="flex-1">{link.label}</span>
              <ExternalLink className="w-3 h-3 opacity-40" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sponsors ────────────────────────────────────────────────────────────────

const SPONSOR_LOGOS = [
  { name: 'USAID', src: '/sponsors/usaid.svg', tileClass: 'border-[#d8e0ea] bg-[#f8fafc]' },
  { name: 'МВС України', src: '/sponsors/mvs.svg', tileClass: 'border-[var(--border-strong)] bg-[var(--bg-surface-2)]' },
  { name: 'ДСНС України', src: '/sponsors/dsns.svg', tileClass: 'border-[var(--border-strong)] bg-[var(--bg-surface-2)]' },
];

function SponsorsSection() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-lg)] text-[12.5px] text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)] transition-colors"
      >
        <span className="w-4 h-4 flex-shrink-0 opacity-60 [&>svg]:w-4 [&>svg]:h-4"><HandHeart /></span>
        <span className="flex-1 text-left">Подяка спонсорам</span>
        <span className="w-4 h-4 opacity-40 [&>svg]:w-4 [&>svg]:h-4">
          {open ? <ChevronDown /> : <ChevronRight />}
        </span>
      </button>
      {open && (
        <ul className="mt-1 grid gap-1 pl-2">
          {SPONSOR_LOGOS.map(sponsor => (
            <li
              key={sponsor.name}
              className={`flex min-h-[58px] items-center justify-center rounded-[var(--radius-md)] border px-2 py-2 shadow-inner shadow-black/10 ${sponsor.tileClass}`}
            >
              <img
                src={sponsor.src}
                alt={`Логотип ${sponsor.name}`}
                loading="lazy"
                className="max-h-12 max-w-full object-contain"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Notifications ────────────────────────────────────────────────────────────

type NotifType = 'system' | 'status' | 'approval';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  currentStatus?: string;
}

type InspectionPlanNotificationEvent = CustomEvent<{
  title: string;
  message: string;
  count: number;
}>;

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'system',
    title: 'Планове технічне обслуговування',
    message: 'Система буде недоступна 5 травня 2026 з 02:00 до 04:00.',
    timestamp: '2026-05-01T09:00:00',
    read: false,
  },
  {
    id: '2',
    type: 'status',
    title: 'Зміна статусу укриття',
    message: 'Укриття "вул. Хрещатик, 1" змінило статус на "Активне".',
    timestamp: '2026-05-01T08:30:00',
    read: false,
    currentStatus: 'active',
  },
  {
    id: '3',
    type: 'status',
    title: 'Нова пропозиція на укриття',
    message: 'Надійшла нова пропозиція від Подільського району.',
    timestamp: '2026-04-30T17:45:00',
    read: true,
  },
];

const SHELTER_STATUSES = [
  { value: 'active', label: 'Активне' },
  { value: 'inactive', label: 'Неактивне' },
  { value: 'maintenance', label: 'На обслуговуванні' },
  { value: 'closed', label: 'Закрите' },
];

function formatNotifTime(ts: string) {
  return new Date(ts).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NotificationBell({ variant = 'topbar' }: { variant?: 'topbar' | 'sidebar' }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [sidebarPanelStyle, setSidebarPanelStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!open || variant !== 'sidebar') return;

    function updatePosition() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const gap = 12;
      const viewportPadding = 16;
      const panelWidth = Math.min(380, window.innerWidth - viewportPadding * 2);
      const panelMaxHeight = Math.min(560, window.innerHeight - viewportPadding * 2);
      const isNarrow = window.innerWidth < 768;
      const preferredLeft = isNarrow ? viewportPadding : triggerRect.right + gap;
      const left = Math.min(
        Math.max(viewportPadding, preferredLeft),
        window.innerWidth - panelWidth - viewportPadding
      );
      const preferredTop = isNarrow ? triggerRect.bottom + 8 : triggerRect.top - 8;
      const top = Math.min(
        Math.max(viewportPadding, preferredTop),
        window.innerHeight - panelMaxHeight - viewportPadding
      );

      setSidebarPanelStyle({
        left,
        top,
        width: panelWidth,
        maxHeight: panelMaxHeight,
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    function handleInspectionPlanSubmitted(event: Event) {
      const detail = (event as InspectionPlanNotificationEvent).detail;
      setNotifications(current => [
        {
          id: `inspection-plan-${Date.now()}`,
          type: 'approval',
          title: detail?.title ?? 'Новий список перевірок',
          message: detail?.message ?? 'Сформовано новий список перевірок на погодження.',
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...current,
      ]);
    }

    window.addEventListener('inspection-plan-submitted', handleInspectionPlanSubmitted);
    return () => window.removeEventListener('inspection-plan-submitted', handleInspectionPlanSubmitted);
  }, []);

  function handleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function handleReact(id: string) {
    setExpandedId(null);
    setComments(c => ({ ...c, [id]: '' }));
  }

  return (
    <div ref={wrapperRef} className="relative">
      {variant === 'sidebar' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-lg)] text-[12.5px] text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)] transition-colors"
        >
          <span className="relative w-4 h-4 flex-shrink-0 opacity-70 [&>svg]:w-4 [&>svg]:h-4">
            <Bell />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[13px] h-[13px] flex items-center justify-center rounded-full bg-[#ff6b6b] text-[8px] font-bold text-white px-0.5 leading-none">
                {unreadCount}
              </span>
            )}
          </span>
          <span className="flex-1 text-left">Повідомлення</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--accent-10)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
              {unreadCount}
            </span>
          )}
          <span className="w-4 h-4 opacity-40 [&>svg]:w-4 [&>svg]:h-4">
            {open ? <ChevronDown /> : <ChevronRight />}
          </span>
        </button>
      ) : (
        <button
          ref={triggerRef}
          onClick={() => setOpen(v => !v)}
          aria-label="Сповіщення"
          className="relative flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[#ff6b6b] text-[9px] font-bold text-white px-1 leading-none">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className={
            variant === 'sidebar'
              ? 'fixed z-50 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl shadow-black/35'
              : 'absolute right-0 top-full mt-2 w-80 rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl shadow-black/40 z-50 overflow-hidden'
          }
          style={variant === 'sidebar' ? sidebarPanelStyle : undefined}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">Сповіщення</p>
            {unreadCount > 0 && (
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                {unreadCount} непрочитаних
              </span>
            )}
          </div>

          <div
            className="overflow-y-auto divide-y divide-[var(--border-subtle)]"
            style={{ maxHeight: variant === 'sidebar' ? 'calc(min(560px, 100vh - 32px) - 49px)' : 420 }}
          >
            {notifications.map(n => (
              <div key={n.id} className={!n.read ? 'bg-[var(--hover)]' : ''}>
                <button
                  onClick={() => handleExpand(n.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[var(--hover-md)] transition-colors text-left"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px] ${
                      n.read ? 'bg-transparent' : 'bg-[var(--accent)]'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium leading-snug text-[var(--text-primary)]">
                      {n.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{formatNotifTime(n.timestamp)}</p>
                  </div>
                  <span className="w-3.5 h-3.5 opacity-30 flex-shrink-0 mt-0.5 [&>svg]:w-3.5 [&>svg]:h-3.5">
                    {expandedId === n.id ? <ChevronDown /> : <ChevronRight />}
                  </span>
                </button>

                {expandedId === n.id && (
                  <div className="px-4 pb-4 space-y-2.5 border-t border-[var(--border-subtle)]">
                    <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed pt-3">{n.message}</p>
                    {n.type === 'approval' && (
                      <div className="rounded-[var(--radius-md)] border border-[var(--accent-25)] bg-[var(--accent-08)] px-3 py-2 text-[11px] font-medium text-[var(--accent)]">
                        Очікує погодження у розділі оглядів об'єктів
                      </div>
                    )}
                    {n.type === 'status' && (
                      <select
                        value={statuses[n.id] ?? n.currentStatus ?? ''}
                        onChange={e => setStatuses(s => ({ ...s, [n.id]: e.target.value }))}
                        className="w-full text-[11.5px] bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-40)]"
                      >
                        <option value="">Змінити статус...</option>
                        {SHELTER_STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    )}
                    <textarea
                      value={comments[n.id] ?? ''}
                      onChange={e => setComments(c => ({ ...c, [n.id]: e.target.value }))}
                      placeholder="Коментар..."
                      rows={2}
                      className="w-full text-[11.5px] bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-ghost)] resize-none focus:outline-none focus:border-[var(--accent-40)]"
                    />
                    <button
                      onClick={() => handleReact(n.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--accent-10)] text-[var(--accent)] text-[11.5px] font-medium hover:bg-[var(--accent-15)] transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Підтвердити
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {notifications.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] text-[var(--text-ghost)]">Немає сповіщень</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── App Shell ────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<{ first: string; last: string; role: string } | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [navCounts, setNavCounts] = useState<{ shelters?: number; shelterRequests?: number }>({});
  const [authState, setAuthState] = useState<'checking' | 'ready' | 'unauthorized' | 'service-unavailable'>('ready');
  const [sessionProbe, setSessionProbe] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      if (!hasStoredAuth()) {
        clearStoredAuth();
        if (!cancelled) {
          setAuthState('unauthorized');
          router.replace('/login');
        }
        return;
      }

      try {
        const currentUser = await apiFetch<{ sub: string; email: string; role: string; orgId: string | null }>('/auth/me');
        if (cancelled) return;

        const parts = currentUser.email.split('@')[0].split('.');
        setCurrentRole(currentUser.role);
        setUserName({
          first: parts[0] ? capitalize(parts[0]) : 'Користувач',
          last: parts[1] ? capitalize(parts[1]) : '',
          role: roleLabel(currentUser.role),
        });
        setAuthState('ready');
      } catch (error) {
        if (cancelled) return;

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearStoredAuth();
          setAuthState('unauthorized');
          router.replace('/login');
          return;
        }

        setAuthState('service-unavailable');
      }
    }

    void validateSession();

    return () => {
      cancelled = true;
    };
  }, [router, sessionProbe]);

  useEffect(() => {
    if (authState !== 'checking') {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAuthState('service-unavailable');
    }, 7000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [authState]);

  useEffect(() => {
    if (authState !== 'ready') return;

    void (async () => {
      try {
        const shelters = await apiFetch<unknown[]>('/shelters');
        setNavCounts(current => ({ ...current, shelters: shelters.length }));
      } catch {
        setNavCounts(current => ({ ...current, shelters: undefined }));
      }

      if (currentRole === 'BALANCE_HOLDER' || currentRole === 'GOV_ORG' || currentRole === 'REGIONAL' || currentRole === 'DSNS') {
        try {
          const requests = await apiFetch<unknown[]>('/shelter-requests');
          setNavCounts(current => ({ ...current, shelterRequests: requests.length }));
        } catch {
          setNavCounts(current => ({ ...current, shelterRequests: undefined }));
        }
      } else {
        setNavCounts(current => ({ ...current, shelterRequests: undefined }));
      }
    })();
  }, [authState, currentRole]);

  function handleNavigate(key: string) {
    router.push(key);
  }

  const activeKey = NAV_GROUPS.flatMap(g => g.items)
    .map(i => i.key)
    .filter(k => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0] ?? '';

  const navGroupsWithCounts = useMemo(
    () =>
      NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.map(item => {
          if (item.key === '/shelters') return { ...item, badge: navCounts.shelters };
          if (item.key === '/shelter-requests') return { ...item, badge: navCounts.shelterRequests };
          return item;
        }),
      })),
    [navCounts]
  );

  const extraNavContent = (
    <>
      <div className="border-t border-[var(--border-subtle)]" />
      <div>
        <p className="text-[10px] font-semibold text-[var(--text-ghost)] uppercase tracking-[0.08em] px-2.5 mb-1.5">
          Події
        </p>
        <div className="space-y-0.5">
          <NotificationBell variant="sidebar" />
        </div>
      </div>
      <div className="border-t border-[var(--border-subtle)]" />
      <div>
        <p className="text-[10px] font-semibold text-[var(--text-ghost)] uppercase tracking-[0.08em] px-2.5 mb-1.5">
          Довідка
        </p>
        <div className="space-y-0.5">
          <FaqSection />
          <MoreLinksSection />
          <SponsorsSection />
        </div>
      </div>
    </>
  );

  if (authState === 'unauthorized') {
    return null;
  }

  if (authState === 'service-unavailable') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-base)] px-6">
        <div className="max-w-md rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">Сервіс тимчасово недоступний</p>
          <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
            Не вдалося підключитися до backend або бази даних. Перевірте, чи запущені `pnpm dev:mock`
            або окремо backend і Postgres.
          </p>
          <button
            type="button"
            onClick={() => {
              setAuthState('checking');
              setSessionProbe(current => current + 1);
            }}
            className="mt-4 rounded-[var(--radius-lg)] bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--color-on-accent)]"
          >
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[var(--bg-base)] md:h-dvh md:flex-row md:overflow-hidden">
      <Sidebar
        logo={
          <Logo
            name="Облік укриттів"
            subtitle="ДСНС України · v2.4"
            icon={<Home className="w-4 h-4 text-[var(--color-on-accent)]" />}
          />
        }
        groups={navGroupsWithCounts}
        activeKey={activeKey}
        onNavigate={handleNavigate}
        className="w-full md:w-[224px] md:shrink-0 md:border-r md:border-b-0"
        extraNavContent={extraNavContent}
        footer={
          userName ? (
            <div
              data-migra-component="Layout/UserFooter"
              data-migra-user={`${userName.first} ${userName.last}`.trim()}
              data-migra-role={userName.role}
              className="flex items-center gap-2.5 px-1"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6c63ff] to-[var(--accent)] flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0 shadow-[0_0_0_1px_var(--ring)]">
                {(userName.first[0] ?? userName.last[0] ?? 'U').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{userName.first} {userName.last}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{userName.role}</p>
              </div>
              <button
                onClick={() => router.push('/settings')}
                aria-label="Налаштування"
                className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          ) : undefined
        }
      />
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto flex flex-col md:h-dvh">
        {authState === 'checking' ? (
          <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--hover)] px-4 py-2 text-[11px] text-[var(--text-secondary)] md:px-6">
            Перевіряємо сесію. Якщо це зависло, банер автоматично зміниться на повідомлення про
            недоступність сервісу.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'Суперадмін',
    REGION_ADMIN: 'Обласний адмін',
    DISTRICT_ADMIN: 'Районний адмін',
    ANALYST: 'Аналітик',
    INSPECTOR: 'Інспектор',
    REGIONAL: 'Регіональний',
    DSNS: 'ДСНС',
  };
  return map[role] ?? role;
}
