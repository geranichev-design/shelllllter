'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Filter, Download, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredAuth } from '@/lib/auth';
import { AppShell } from '@/app/components/AppShell';
import { Alert, AppStatusBadge, Card, PageHeader, Pagination, SearchInput, Select, Table, Button, Input } from '@repo/ui';

type ShelterRequestRow = {
  id: string;
  createdAt: string;
  status: 'NEW' | 'APPROVED' | 'REJECTED';
  createdBy: {
    id: string;
    email: string;
    role: string;
    orgId: string | null;
  };
  data: {
    name: string;
    type: string;
    accessType: string;
    capacity: number;
    responsible?: string;
    contactLastName?: string;
    contactFirstName?: string;
    contactMiddleName?: string;
    contactPhone?: string;
    contactEmail?: string;
  };
};

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  { value: 'NEW', label: 'Нова' },
  { value: 'APPROVED', label: 'Схвалена' },
  { value: 'REJECTED', label: 'Відхилена' },
];

const STATUS_MAP: Record<string, string> = {
  NEW: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

const REQUESTS_PAGE_SIZE = 15;

const DEFAULT_FILTERS = {
  status: '',
  type: '',
  accessType: '',
  dateFrom: '',
  dateTo: '',
  capacityFrom: '',
  capacityTo: '',
};

type RequestFilters = typeof DEFAULT_FILTERS;

function getApplicantName(row: ShelterRequestRow) {
  const fullName = [
    row.data.contactLastName,
    row.data.contactFirstName,
    row.data.contactMiddleName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || row.data.responsible || '—';
}

function getApplicantContacts(row: ShelterRequestRow) {
  const contacts = [row.data.contactPhone, row.data.contactEmail, row.createdBy.email].filter(Boolean);
  return contacts.length ? contacts.join(' · ') : '—';
}

export default function ShelterRequestsPage() {
  const [items, setItems] = useState<ShelterRequestRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<RequestFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<RequestFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  async function loadRequests(nextStatus = filters.status) {
    setLoading(true);
    setError('');
    try {
      const query = nextStatus ? `?status=${encodeURIComponent(nextStatus)}` : '';
      const data = await apiFetch<ShelterRequestRow[]>(`/shelter-requests${query}`);
      setItems(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити пропозиції');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setRole(getStoredAuth()?.user.role ?? '');
    void loadRequests();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uk-UA');

    return items.filter((row) => {
      const searchMatch = !query || [
        row.data.name,
        row.data.type,
        row.data.accessType,
        getApplicantName(row),
        getApplicantContacts(row),
      ].some((value) => value.toLocaleLowerCase('uk-UA').includes(query));
      const statusMatch = !filters.status || row.status === filters.status;
      const typeMatch = !filters.type || row.data.type === filters.type;
      const accessTypeMatch = !filters.accessType || row.data.accessType === filters.accessType;
      const createdDate = row.createdAt.slice(0, 10);
      const dateFromMatch = !filters.dateFrom || createdDate >= filters.dateFrom;
      const dateToMatch = !filters.dateTo || createdDate <= filters.dateTo;
      const capacityFrom = Number(filters.capacityFrom);
      const capacityTo = Number(filters.capacityTo);
      const capacityFromMatch = !filters.capacityFrom || row.data.capacity >= capacityFrom;
      const capacityToMatch = !filters.capacityTo || row.data.capacity <= capacityTo;

      return (
        searchMatch &&
        statusMatch &&
        typeMatch &&
        accessTypeMatch &&
        dateFromMatch &&
        dateToMatch &&
        capacityFromMatch &&
        capacityToMatch
      );
    });
  }, [items, search, filters]);

  const typeOptions = useMemo(
    () => [
      { value: '', label: 'Всі типи' },
      ...Array.from(new Set(items.map((row) => row.data.type).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'uk-UA'))
        .map((value) => ({ value, label: value })),
    ],
    [items]
  );

  const accessTypeOptions = useMemo(
    () => [
      { value: '', label: 'Всі типи доступу' },
      ...Array.from(new Set(items.map((row) => row.data.accessType).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'uk-UA'))
        .map((value) => ({ value, label: value })),
    ],
    [items]
  );

  const activeFilterCount =
    Number(Boolean(filters.status)) +
    Number(Boolean(filters.type)) +
    Number(Boolean(filters.accessType)) +
    Number(Boolean(filters.dateFrom)) +
    Number(Boolean(filters.dateTo)) +
    Number(Boolean(filters.capacityFrom)) +
    Number(Boolean(filters.capacityTo));

  const totalPages = Math.max(1, Math.ceil(filtered.length / REQUESTS_PAGE_SIZE));
  const paginated = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * REQUESTS_PAGE_SIZE;

    return filtered.slice(start, start + REQUESTS_PAGE_SIZE);
  }, [filtered, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openFilters() {
    setDraftFilters(filters);
    setShowFilters((current) => !current);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setShowFilters(false);
    void loadRequests(draftFilters.status);
  }

  function resetFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setShowFilters(false);
    void loadRequests('');
  }

  const columns = [
    {
      key: 'name',
      header: 'Назва / Тип',
      cell: (row: ShelterRequestRow) => (
        <div>
          <p className="text-[13px] font-medium text-[var(--text-primary)]">{row.data.name}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{row.data.type}</p>
        </div>
      ),
    },
    {
      key: 'accessType',
      header: 'Тип доступу',
      cell: (row: ShelterRequestRow) => (
        <span className="text-[12px] text-[var(--text-secondary)]">{row.data.accessType}</span>
      ),
    },
    {
      key: 'applicant',
      header: 'Заявник',
      cell: (row: ShelterRequestRow) => (
        <div>
          <p className="text-[12px] font-medium text-[var(--text-primary)]">{getApplicantName(row)}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{getApplicantContacts(row)}</p>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Місткість',
      cell: (row: ShelterRequestRow) => (
        <span className="text-[12px] text-[var(--text-primary)]">{row.data.capacity}</span>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      cell: (row: ShelterRequestRow) => (
        <AppStatusBadge status={STATUS_MAP[row.status] ?? row.status} />
      ),
    },
    {
      key: 'createdAt',
      header: 'Дата',
      cell: (row: ShelterRequestRow) => (
        <span className="text-[11px] text-[var(--text-muted)]">
          {new Date(row.createdAt).toLocaleDateString('uk-UA')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row: ShelterRequestRow) => (
        <div className="flex items-center gap-2">
          <Link href={`/shelter-requests/${row.id}`}>
            <Button variant="ghost" size="sm">Деталі</Button>
          </Link>
          {role === 'REGIONAL' && row.status === 'NEW' && (
            <Link href={`/shelter-requests/${row.id}`}>
              <Button variant="outline" size="sm">Розглянути</Button>
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Список укриттів"
        subtitle="Реєстр / Укриття"
        actions={
          <>
            <Button
              variant={showFilters || activeFilterCount > 0 ? 'secondary' : 'outline'}
              size="md"
              iconLeft={<Filter />}
              onClick={openFilters}
            >
              {activeFilterCount > 0 ? `Фільтри (${activeFilterCount})` : 'Фільтри'}
            </Button>
            <Button variant="outline" size="md" iconLeft={<Download />}>Експорт</Button>
            <Link href="/shelter-requests/new">
              <Button variant="primary" size="md" iconLeft={<Plus />}>Додати укриття</Button>
            </Link>
          </>
        }
      />

      {showFilters ? (
        <div className="fixed left-4 right-4 top-[104px] z-40 md:left-[224px] md:right-6">
          <div className="ml-auto w-full max-w-[680px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">Фільтри</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Статус, дата, тип, доступ і місткість</p>
              </div>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                  >
                    <X className="h-3 w-3" />
                    Скинути
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]"
                  aria-label="Закрити фільтри"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
              <Select
                label="Статус"
                options={STATUS_OPTIONS}
                value={draftFilters.status}
                onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
              />
              <Select
                label="Тип укриття"
                options={typeOptions}
                value={draftFilters.type}
                onChange={(event) => setDraftFilters((current) => ({ ...current, type: event.target.value }))}
              />
              <Select
                label="Тип доступу"
                options={accessTypeOptions}
                value={draftFilters.accessType}
                onChange={(event) => setDraftFilters((current) => ({ ...current, accessType: event.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Дата від"
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                />
                <Input
                  label="Дата до"
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <Input
                  label="Місткість від"
                  type="number"
                  min="0"
                  value={draftFilters.capacityFrom}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, capacityFrom: event.target.value }))}
                />
                <Input
                  label="Місткість до"
                  type="number"
                  min="0"
                  value={draftFilters.capacityTo}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, capacityTo: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
              <Button type="button" variant="ghost" size="md" onClick={() => setShowFilters(false)}>
                Скасувати
              </Button>
              <Button type="button" variant="primary" size="md" onClick={applyFilters}>
                Застосувати
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Пошук укриттів..."
          />
        </div>

        {error && <Alert severity="danger">{error}</Alert>}

        <Card padding="none">
          <Table
            data={paginated}
            columns={columns}
            keyExtractor={(row) => row.id}
            loading={loading}
            emptyMessage="Пропрозицій не знайдено"
          />
        </Card>
        {filtered.length > REQUESTS_PAGE_SIZE ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            limit={REQUESTS_PAGE_SIZE}
            onChange={setPage}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
