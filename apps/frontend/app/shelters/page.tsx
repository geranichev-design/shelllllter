'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, Download, Filter, Plus, Shield, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredAuth } from '@/lib/auth';
import { AppShell } from '@/app/components/AppShell';
import { Alert, Button, Card, PageHeader, SearchInput, Select, ShelterStatusBadge, ShelterTypeBadge, Table, ToggleButton } from '@repo/ui';

type ShelterRow = {
  id: string;
  shelterNumber: string | null;
  name: string;
  type: string;
  accessType: string;
  capacity: number;
  address: string | null;
  latitude: number;
  longitude: number;
  status: string;
  ownerOrgId: string;
  sourceRequestId: string | null;
  createdAt: string;
};

const STATUS_OPTIONS = [
  { value: '', label: 'Усі статуси' },
  { value: 'NEED', label: 'Потреба' },
  { value: 'PROJECT', label: 'Проєкт' },
  { value: 'CONSTRUCTION', label: 'Будівництво' },
  { value: 'OPERATION', label: 'Експлуатація' },
  { value: 'MODERNIZATION', label: 'Модернізація' },
  { value: 'REPAIR', label: 'Ремонт' },
  { value: 'CONSERVATION', label: 'Консервація' },
  { value: 'MISUSE', label: 'Нецільове використання' },
  { value: 'DESTROYED', label: 'Знищено' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Усі типи' },
  { value: 'STATIC', label: 'Стаціонарне' },
  { value: 'MOBILE', label: 'Мобільне' },
];

const ACCESS_OPTIONS = [
  { value: '', label: 'Будь-який доступ' },
  { value: 'PUBLIC', label: 'Публічний' },
  { value: 'PRIVATE', label: 'Приватний' },
];

const DEMO_SHELTER_NUMBERS = [
  { number: '001-КВ', patterns: ['хрещатик', 'майдан'] },
  { number: '002-КВ', patterns: ['лесі українки', 'поштова'] },
  { number: '003-КВ', patterns: ['городецького', 'університет'] },
  { number: '004-КВ', patterns: ['перемоги'] },
  { number: '005-ХА', patterns: ['б. хмельницького', 'богдана хмельницького', 'салтівка'] },
  { number: '006-ХА', patterns: ['свободи'] },
  { number: '007-ЛВ', patterns: ['шевченка', 'форум львів', 'під дубом'] },
  { number: '008-ЛВ', patterns: ['городоцька'] },
];

function demoShelterNumber(row: ShelterRow) {
  const text = `${row.name} ${row.address ?? ''}`.toLocaleLowerCase('uk-UA');
  return DEMO_SHELTER_NUMBERS.find((item) => item.patterns.some((pattern) => text.includes(pattern)))?.number ?? null;
}

function displayShelterNumber(row: ShelterRow) {
  const demoNumber = demoShelterNumber(row);
  if (demoNumber) return demoNumber;
  if (row.shelterNumber?.trim()) return row.shelterNumber.trim();
  return `УКР-${row.id.slice(0, 8).toUpperCase()}`;
}

export default function SheltersPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShelterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAccess, setFilterAccess] = useState('');
  const [filterCapMin, setFilterCapMin] = useState('');
  const [filterCapMax, setFilterCapMax] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('shelter_favorites');
      return new Set(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  function toggleFavorite(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem('shelter_favorites', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const activeFilterCount = [filterStatus, filterType, filterAccess, filterCapMin, filterCapMax, onlyFavorites ? '1' : ''].filter(Boolean).length;

  function resetFilters() {
    setFilterStatus('');
    setFilterType('');
    setFilterAccess('');
    setFilterCapMin('');
    setFilterCapMax('');
    setOnlyFavorites(false);
  }

  useEffect(() => {
    setRole(getStoredAuth()?.user.role ?? '');

    void (async () => {
      try {
        const data = await apiFetch<ShelterRow[]>('/shelters');
        setItems(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити укриття');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const capMin = filterCapMin ? Number(filterCapMin) : null;
    const capMax = filterCapMax ? Number(filterCapMax) : null;
    const query = search.toLowerCase();

    return items.filter((row) => {
      const shelterNumber = displayShelterNumber(row).toLowerCase();
      if (search && !(
        shelterNumber.includes(query) ||
        row.name.toLowerCase().includes(query) ||
        row.type.toLowerCase().includes(query) ||
        row.accessType.toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query)
      )) return false;
      if (filterStatus && row.status !== filterStatus) return false;
      if (filterType && row.type !== filterType) return false;
      if (filterAccess && row.accessType !== filterAccess) return false;
      if (capMin !== null && row.capacity < capMin) return false;
      if (capMax !== null && row.capacity > capMax) return false;
      if (onlyFavorites && !favorites.has(row.id)) return false;
      return true;
    });
  }, [items, search, filterStatus, filterType, filterAccess, filterCapMin, filterCapMax, onlyFavorites, favorites]);

  const columns = [
    {
      key: 'index',
      header: '№',
      width: '48px',
      cell: (_row: ShelterRow, index: number) => (
        <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{index + 1}</span>
      ),
    },
    {
      key: 'favorite',
      header: '',
      width: '36px',
      cell: (row: ShelterRow) => {
        const isFav = favorites.has(row.id);
        return (
          <button
            onClick={(e) => toggleFavorite(row.id, e)}
            className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-md)] transition-colors hover:bg-[var(--hover-strong)]"
            title={isFav ? 'Прибрати з обраних' : 'Додати до обраних'}
          >
            <Bookmark
              className="w-3.5 h-3.5 transition-colors"
              style={isFav ? { fill: 'var(--accent)', stroke: 'var(--accent)' } : { stroke: 'var(--text-muted)' }}
            />
          </button>
        );
      },
    },
    {
      key: 'shelterNumber',
      header: 'Номер укриття',
      width: '132px',
      cell: (row: ShelterRow) => (
        <span className="text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">
          {displayShelterNumber(row)}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Назва / Статус',
      cell: (row: ShelterRow) => (
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">{row.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ShelterTypeBadge type={row.type} />
            <ShelterStatusBadge status={row.status} />
          </div>
        </div>
      ),
    },
    {
      key: 'accessType',
      header: 'Доступ',
      cell: (row: ShelterRow) => <span className="text-[12px] text-[var(--text-secondary)]">{row.accessType}</span>,
    },
    {
      key: 'capacity',
      header: 'Місткість',
      cell: (row: ShelterRow) => <span className="text-[12px] text-[var(--text-primary)]">{row.capacity}</span>,
    },
    {
      key: 'address',
      header: 'Адреса',
      cell: (row: ShelterRow) => (
        <span className="text-[12px] text-[var(--text-secondary)]">
          {row.address || '—'}
        </span>
      ),
    },
    {
      key: 'sourceRequestId',
      header: 'Джерело',
      cell: (row: ShelterRow) => (
        <span className="text-[11px] text-[var(--text-muted)]">
          {row.sourceRequestId ? row.sourceRequestId.slice(0, 8) : 'ручне'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Створено',
      cell: (row: ShelterRow) => (
        <span className="text-[11px] text-[var(--text-muted)]">
          {new Date(row.createdAt).toLocaleDateString('uk-UA')}
        </span>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Список укриттів"
        subtitle="Реєстр / Укриття"
        className="shrink-0"
        actions={
          <>
            <ToggleButton active={showFilters} onClick={() => setShowFilters((v) => !v)} iconLeft={<Filter />}>
              Фільтри
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-[var(--color-on-accent)]">
                  {activeFilterCount}
                </span>
              )}
            </ToggleButton>
            <Button variant="outline" size="md" iconLeft={<Download />}>Експорт</Button>
            <Link href="/shelter-requests/new">
              <Button variant="primary" size="md" iconLeft={<Plus />}>Додати укриття</Button>
            </Link>
          </>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 [scrollbar-gutter:stable]">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Пошук укриттів..."
          />
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
            {role ? `Роль: ${role}` : 'Користувач не авторизований'}
          </div>
        </div>

        {showFilters && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Фільтри</span>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  <X className="w-3 h-3" />
                  Скинути
                </button>
              )}
            </div>
            <div className="mb-3">
              <ToggleButton size="sm" active={onlyFavorites} onClick={() => setOnlyFavorites((v) => !v)} iconLeft={<Bookmark style={onlyFavorites ? { fill: 'var(--accent)', stroke: 'var(--accent)' } : {}} />}>
                Тільки обрані
              </ToggleButton>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Select
                options={STATUS_OPTIONS}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Статус"
              />
              <Select
                options={TYPE_OPTIONS}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Тип"
              />
              <Select
                options={ACCESS_OPTIONS}
                value={filterAccess}
                onChange={(e) => setFilterAccess(e.target.value)}
                label="Доступ"
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Місткість</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    placeholder="від"
                    value={filterCapMin}
                    onChange={(e) => setFilterCapMin(e.target.value)}
                    className="w-full h-8 px-2 text-[12px] text-[var(--text-primary)] bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[var(--radius-lg)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-[border-color] duration-100"
                  />
                  <span className="text-[11px] text-[var(--text-muted)]">—</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="до"
                    value={filterCapMax}
                    onChange={(e) => setFilterCapMax(e.target.value)}
                    className="w-full h-8 px-2 text-[12px] text-[var(--text-primary)] bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[var(--radius-lg)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-[border-color] duration-100"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {error ? <Alert severity="danger">{error}</Alert> : null}

        <Card padding="none">
          <Table
            data={filtered}
            columns={columns}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => router.push(`/shelters/${row.id}`)}
            loading={loading}
            emptyMessage="Укриттів не знайдено"
          />
        </Card>

        {!loading && !error && items.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 text-[var(--text-ghost)] [&>svg]:h-10 [&>svg]:w-10">
                <Shield />
              </div>
              <p className="text-[14px] font-medium text-[var(--text-secondary)]">Укриттів поки немає</p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Додайте перше укриття або завантажте мок-дані через `pnpm prisma:seed`.
              </p>
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
