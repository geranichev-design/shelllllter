'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bookmark, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, ClipboardCheck, Eye, Filter, List, Plus, Search, ShieldCheck, Shield, X } from 'lucide-react';
import { AppShell } from '@/app/components/AppShell';
import { Badge, Button, Card, DropdownButton, EmptyState, Input, SectionLabel, Select, ToggleButton } from '@repo/ui';
import { InspectionHeader } from '../InspectionHeader';

type ShelterInspectionType = 'PLANNED' | 'UNPLANNED' | 'CONTROL';
type ShelterInspectionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
type InspectionListView = 'list' | 'calendar';
type CalendarDetail = 'month' | 'year';

type ShelterInspectionRow = {
  id: string;
  shelterId: string;
  shelterNumber: string;
  shelterName: string;
  shelterAddress: string;
  date: string;
  type: ShelterInspectionType;
  status: ShelterInspectionStatus;
  inspector: string;
  result: string;
};

type AppliedSearchFilters = {
  search: string;
  dateFrom: string;
  dateTo: string;
  type: string;
  status: string;
  onlyFavorites: boolean;
  selectedShelterIds: Set<string>;
};

type ShelterInspectionSummary = {
  total: number;
  completed: number;
  overdue: number;
  shelters: number;
};

const TYPE_OPTIONS = [
  { value: '', label: 'Усі типи' },
  { value: 'PLANNED', label: 'Планове' },
  { value: 'UNPLANNED', label: 'Позапланове' },
  { value: 'CONTROL', label: 'Контрольне' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Усі статуси' },
  { value: 'PLANNED', label: 'Заплановане' },
  { value: 'IN_PROGRESS', label: 'В процесі' },
  { value: 'COMPLETED', label: 'Завершене' },
  { value: 'OVERDUE', label: 'Прострочене' },
];

const MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const INITIAL_INSPECTIONS: ShelterInspectionRow[] = [
  {
    id: 'INS-2026-001',
    shelterId: 'kyiv-1',
    shelterNumber: '001-КВ',
    shelterName: 'Укриття на Хрещатику',
    shelterAddress: 'м. Київ, вул. Хрещатик, 1',
    date: '2026-02-12',
    type: 'PLANNED',
    status: 'COMPLETED',
    inspector: 'regional@example.com',
    result: 'Плановий огляд завершено, є зауваження щодо вентиляції.',
  },
  {
    id: 'INS-2026-002',
    shelterId: 'kyiv-1',
    shelterNumber: '001-КВ',
    shelterName: 'Укриття на Хрещатику',
    shelterAddress: 'м. Київ, вул. Хрещатик, 1',
    date: '2026-03-02',
    type: 'CONTROL',
    status: 'COMPLETED',
    inspector: 'inspector.kyiv@example.com',
    result: 'Контрольне обстеження підтвердило усунення зауважень.',
  },
  {
    id: 'INS-2026-003',
    shelterId: 'kyiv-2',
    shelterNumber: '002-КВ',
    shelterName: 'Укриття на Лесі Українки',
    shelterAddress: 'м. Київ, вул. Лесі Українки, 26',
    date: '2026-05-22',
    type: 'UNPLANNED',
    status: 'IN_PROGRESS',
    inspector: 'regional@example.com',
    result: 'Позапланове обстеження за зверненням балансоутримувача.',
  },
  {
    id: 'INS-2026-004',
    shelterId: 'kyiv-3',
    shelterNumber: '003-КВ',
    shelterName: 'Укриття на Городецького',
    shelterAddress: 'м. Київ, вул. Городецького, 5',
    date: '2026-06-18',
    type: 'PLANNED',
    status: 'PLANNED',
    inspector: 'inspection.team@example.com',
    result: 'Очікує проведення планового огляду.',
  },
  {
    id: 'INS-2026-005',
    shelterId: 'kharkiv-5',
    shelterNumber: '005-ХА',
    shelterName: 'Укриття Б. Хмельницького',
    shelterAddress: 'Харківська обл., м. Харків, вул. Б. Хмельницького, 3',
    date: '2026-01-19',
    type: 'PLANNED',
    status: 'OVERDUE',
    inspector: 'kharkiv.inspect@example.com',
    result: 'Планове обстеження прострочене, потрібне перепланування.',
  },
  {
    id: 'INS-2026-006',
    shelterId: 'lviv-7',
    shelterNumber: '007-ЛВ',
    shelterName: 'Укриття на Шевченка',
    shelterAddress: 'Львівська обл., м. Львів, вул. Шевченка, 12',
    date: '2026-04-09',
    type: 'CONTROL',
    status: 'COMPLETED',
    inspector: 'lviv.region@example.com',
    result: 'Контрольне обстеження завершено без критичних зауважень.',
  },
];

function typeLabel(type: ShelterInspectionType) {
  const labels: Record<ShelterInspectionType, string> = {
    PLANNED: 'Планове',
    UNPLANNED: 'Позапланове',
    CONTROL: 'Контрольне',
  };
  return labels[type];
}

function statusLabel(status: ShelterInspectionStatus) {
  const labels: Record<ShelterInspectionStatus, string> = {
    PLANNED: 'Заплановане',
    IN_PROGRESS: 'В процесі',
    COMPLETED: 'Завершене',
    OVERDUE: 'Прострочене',
  };
  return labels[status];
}

function statusSeverity(status: ShelterInspectionStatus): 'ok' | 'warning' | 'neutral' | 'info' {
  const severities: Record<ShelterInspectionStatus, 'ok' | 'warning' | 'neutral' | 'info'> = {
    PLANNED: 'info',
    IN_PROGRESS: 'warning',
    COMPLETED: 'ok',
    OVERDUE: 'warning',
  };
  return severities[status];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function InspectionSummaryDock({
  summary,
  selectedShelterCount,
}: {
  summary: ShelterInspectionSummary;
  selectedShelterCount: number;
}) {
  const metrics = [
    { key: 'shelters', label: 'Укриттів', value: summary.shelters, icon: <ClipboardCheck className="h-3.5 w-3.5 text-[var(--text-muted)]" /> },
    { key: 'total', label: 'Обстежень', value: summary.total, icon: <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" /> },
    { key: 'completed', label: 'Завершені', value: summary.completed, icon: <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" /> },
    { key: 'overdue', label: 'Прострочені', value: summary.overdue, icon: <CalendarPlus className="h-3.5 w-3.5 text-[var(--color-warning)]" /> },
  ];

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 md:left-[248px]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
          {metrics.map((metric) => (
            <div key={metric.key} className="inline-flex items-center gap-2">
              {metric.icon}
              <span className="text-[11px] text-[var(--text-muted)]">{metric.label}</span>
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">{metric.value}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">
          {selectedShelterCount ? `Обрано ${selectedShelterCount}` : 'Усі укриття'}
        </div>
      </div>
    </div>
  );
}

export default function ShelterInspectionListPage() {
  const [items, setItems] = useState<ShelterInspectionRow[]>(INITIAL_INSPECTIONS);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [shelterSearch, setShelterSearch] = useState('');
  const [selectedShelterIds, setSelectedShelterIds] = useState<Set<string>>(new Set());
  const [favoriteInspectionIds, setFavoriteInspectionIds] = useState<Set<string>>(new Set());
  const [appliedFilters, setAppliedFilters] = useState<AppliedSearchFilters>({
    search: '',
    dateFrom: '',
    dateTo: '',
    type: '',
    status: '',
    onlyFavorites: false,
    selectedShelterIds: new Set(),
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inspectionView, setInspectionView] = useState<InspectionListView>('list');
  const [calendarDetail, setCalendarDetail] = useState<CalendarDetail>('month');
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [openedInspection, setOpenedInspection] = useState<ShelterInspectionRow | null>(null);
  const [createInspectionType, setCreateInspectionType] = useState<Exclude<ShelterInspectionType, 'CONTROL'> | null>(null);
  const [createShelterSearch, setCreateShelterSearch] = useState('');
  const [createShelterPickerOpen, setCreateShelterPickerOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ shelterId: '', date: '', comment: '' });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('inspection_list_favorites');
      if (stored) setFavoriteInspectionIds(new Set(JSON.parse(stored) as string[]));
    } catch {}
  }, []);

  const shelterOptions = useMemo(() => {
    const map = new Map<string, { id: string; number: string; name: string; address: string; inspections: number }>();
    for (const inspection of items) {
      const current = map.get(inspection.shelterId);
      map.set(inspection.shelterId, {
        id: inspection.shelterId,
        number: inspection.shelterNumber,
        name: inspection.shelterName,
        address: inspection.shelterAddress,
        inspections: (current?.inspections ?? 0) + 1,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.number.localeCompare(b.number, 'uk-UA'));
  }, [items]);

  const selectedShelters = useMemo(
    () => shelterOptions.filter((shelter) => selectedShelterIds.has(shelter.id)),
    [selectedShelterIds, shelterOptions]
  );

  const shelterSearchResults = useMemo(() => {
    const query = shelterSearch.trim().toLocaleLowerCase('uk-UA');
    if (query.length < 2) return [];

    return shelterOptions
      .filter(
        (shelter) =>
          shelter.number.toLocaleLowerCase('uk-UA').includes(query) ||
          shelter.name.toLocaleLowerCase('uk-UA').includes(query) ||
          shelter.address.toLocaleLowerCase('uk-UA').includes(query)
      )
      .slice(0, 8);
  }, [shelterOptions, shelterSearch]);

  const createShelterCandidates = useMemo(() => {
    const query = createShelterSearch.trim().toLocaleLowerCase('uk-UA');
    const source = selectedShelters.length ? selectedShelters : shelterOptions;

    if (!query) return source;

    return source
      .filter(
        (shelter) => {
          const label = `${shelter.number} · ${shelter.name}`.toLocaleLowerCase('uk-UA');
          return (
            label.includes(query) ||
            shelter.number.toLocaleLowerCase('uk-UA').includes(query) ||
            shelter.name.toLocaleLowerCase('uk-UA').includes(query) ||
            shelter.address.toLocaleLowerCase('uk-UA').includes(query)
          );
        }
      );
  }, [createShelterSearch, selectedShelters, shelterOptions]);

  const filtered = useMemo(() => {
    const query = appliedFilters.search.trim().toLocaleLowerCase('uk-UA');

    return items
      .filter((inspection) => {
        const searchMatch =
          !query ||
            inspection.id.toLocaleLowerCase('uk-UA').includes(query) ||
            inspection.shelterNumber.toLocaleLowerCase('uk-UA').includes(query) ||
            inspection.shelterName.toLocaleLowerCase('uk-UA').includes(query) ||
            inspection.result.toLocaleLowerCase('uk-UA').includes(query);
        const dateFromMatch = !appliedFilters.dateFrom || inspection.date >= appliedFilters.dateFrom;
        const dateToMatch = !appliedFilters.dateTo || inspection.date <= appliedFilters.dateTo;
        const typeMatch = !appliedFilters.type || inspection.type === appliedFilters.type;
        const statusMatch = !appliedFilters.status || inspection.status === appliedFilters.status;
        const favoriteMatch = !appliedFilters.onlyFavorites || favoriteInspectionIds.has(inspection.id);
        const shelterMatch =
          appliedFilters.selectedShelterIds.size === 0 || appliedFilters.selectedShelterIds.has(inspection.shelterId);
        return searchMatch && dateFromMatch && dateToMatch && typeMatch && statusMatch && favoriteMatch && shelterMatch;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [appliedFilters, favoriteInspectionIds, items]);

  const summary = useMemo(
    () => ({
      total: filtered.length,
      completed: filtered.filter((inspection) => inspection.status === 'COMPLETED').length,
      overdue: filtered.filter((inspection) => inspection.status === 'OVERDUE').length,
      shelters: new Set(filtered.map((inspection) => inspection.shelterId)).size,
    }),
    [filtered]
  );

  const activeFilterCount =
    Number(Boolean(appliedFilters.search.trim())) +
    Number(Boolean(appliedFilters.dateFrom)) +
    Number(Boolean(appliedFilters.dateTo)) +
    Number(Boolean(appliedFilters.type)) +
    Number(Boolean(appliedFilters.status)) +
    Number(appliedFilters.onlyFavorites) +
    appliedFilters.selectedShelterIds.size;

  function addShelterToSelection(shelterId: string) {
    setSelectedShelterIds((current) => {
      const next = new Set(current);
      next.add(shelterId);
      return next;
    });
  }

  function removeShelterFromSelection(shelterId: string) {
    setSelectedShelterIds((current) => {
      const next = new Set(current);
      next.delete(shelterId);
      return next;
    });
  }

  function selectOnlyShelter(shelterId: string) {
    setSelectedShelterIds(new Set([shelterId]));
  }

  function applySearchFilters() {
    setAppliedFilters({
      search,
      dateFrom,
      dateTo,
      type,
      status,
      onlyFavorites,
      selectedShelterIds: new Set(selectedShelterIds),
    });
    setFiltersOpen(false);
  }

  function clearSearchFilters() {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setType('');
    setStatus('');
    setOnlyFavorites(false);
    setShelterSearch('');
    setSelectedShelterIds(new Set());
    setAppliedFilters({
      search: '',
      dateFrom: '',
      dateTo: '',
      type: '',
      status: '',
      onlyFavorites: false,
      selectedShelterIds: new Set(),
    });
    setFiltersOpen(false);
  }

  function toggleFavoriteInspection(id: string) {
    setFavoriteInspectionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      try {
        window.localStorage.setItem('inspection_list_favorites', JSON.stringify([...next]));
      } catch {}

      return next;
    });
  }

  function changeCalendarMonth(delta: number) {
    setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function openCreateInspection(nextType: Exclude<ShelterInspectionType, 'CONTROL'>, date?: string) {
    const selectedIds = Array.from(selectedShelterIds);
    const defaultDate = date ?? addDays(nextType === 'PLANNED' ? 14 : 3);
    setCreateShelterSearch('');
    setCreateShelterPickerOpen(false);
    setCreateForm({
      shelterId: selectedIds.length === 1 ? selectedIds[0] : '',
      date: nextType === 'PLANNED' ? firstDayOfMonth(defaultDate) : defaultDate,
      comment: '',
    });
    setCreateInspectionType(nextType);
  }

  function openCalendarCreateInspection(nextType: Exclude<ShelterInspectionType, 'CONTROL'>, date: string) {
    openCreateInspection(nextType, date);
  }

  function saveCreatedInspection() {
    if (!createInspectionType || !createForm.shelterId || !createForm.date) return;

    const shelter = shelterOptions.find((option) => option.id === createForm.shelterId);
    if (!shelter) return;

    setItems((current) => [
      {
        id: `INS-${Date.now().toString().slice(-6)}`,
        shelterId: shelter.id,
        shelterNumber: shelter.number,
        shelterName: shelter.name,
        shelterAddress: shelter.address,
        date: createForm.date,
        type: createInspectionType,
        status: 'PLANNED',
        inspector: 'regional@example.com',
        result: createForm.comment.trim() || `Заплановано ${typeLabel(createInspectionType).toLocaleLowerCase('uk-UA')} обстеження.`,
      },
      ...current,
    ]);
    setSelectedShelterIds(new Set([shelter.id]));
    setCreateInspectionType(null);
  }

  return (
    <AppShell>
      <InspectionHeader
        active="list"
        actions={
          <>
            <Button
              type="button"
              variant={filtersOpen ? 'secondary' : 'outline'}
              size="lg"
              iconLeft={<Search />}
              onClick={() => setFiltersOpen((current) => !current)}
            >
              {filtersOpen ? 'Сховати пошук' : activeFilterCount ? `Пошук (${activeFilterCount})` : 'Показати пошук'}
            </Button>
            <DropdownButton
              label="Додати обстеження"
              variant="primary"
              size="lg"
              iconLeft={<Plus />}
              actions={[
                { label: 'Планове', icon: <CalendarPlus />, onClick: () => openCreateInspection('PLANNED') },
                { label: 'Позапланове', icon: <Plus />, onClick: () => openCreateInspection('UNPLANNED') },
              ]}
            />
          </>
        }
      />

      <div className="relative min-h-0 flex-1 overflow-y-auto p-6 pb-28 [scrollbar-gutter:stable]">
        {filtersOpen ? (
          <div className="fixed left-0 right-0 top-[104px] z-40 px-6 md:left-[224px]">
            <div className="mx-auto max-w-7xl rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
              <div className="mb-4">
                <SectionLabel className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5" />
                  Пошук обстеження
                </SectionLabel>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  Задайте параметри й натисніть «Шукати», щоб оновити перелік.
                </p>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(240px,1fr)_auto] xl:items-end">
                  <Input
                    label="Пошук обстеження"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    iconLeft={<Search />}
                    placeholder="Номер обстеження, номер укриття, результат обстеження"
                  />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Input label="Дата від" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                    <Input label="Дата до" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                    <Select label="Тип обстеження" value={type} onChange={(event) => setType(event.target.value)} options={TYPE_OPTIONS} />
                    <Select label="Статус" value={status} onChange={(event) => setStatus(event.target.value)} options={STATUS_OPTIONS} />
                  </div>
                </div>

                <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <SectionLabel>Укриття у переліку</SectionLabel>
                      <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                        {selectedShelterIds.size
                          ? `Обрано ${selectedShelterIds.size} укриттів`
                          : 'За замовчуванням показані всі укриття. Для вибірки знайдіть потрібні укриття пошуком.'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedShelterIds(new Set())} disabled={!selectedShelterIds.size}>
                      Показати всі
                    </Button>
                  </div>

                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <ToggleButton
                      size="sm"
                      active={onlyFavorites}
                      onClick={() => setOnlyFavorites((current) => !current)}
                      iconLeft={
                        <Bookmark
                          style={onlyFavorites ? { fill: 'var(--accent)', stroke: 'var(--accent)' } : undefined}
                        />
                      }
                    >
                      Тільки обрані
                    </ToggleButton>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {favoriteInspectionIds.size ? `${favoriteInspectionIds.size} у закладках` : 'Закладок ще немає'}
                    </span>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(260px,420px)_1fr]">
                    <div className="space-y-2">
                      <Input
                        label="Знайти укриття"
                        value={shelterSearch}
                        onChange={(event) => setShelterSearch(event.target.value)}
                        iconLeft={<Search />}
                        placeholder="Мін. 2 символи: номер, назва або адреса"
                      />
                      {shelterSearch.trim().length >= 2 ? (
                        <div className="max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)]">
                          {shelterSearchResults.length ? (
                            shelterSearchResults.map((shelter) => {
                              const selected = selectedShelterIds.has(shelter.id);
                              return (
                                <div
                                  key={shelter.id}
                                  className="grid gap-2 border-b border-[var(--border-subtle)] px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
                                      {shelter.number} · {shelter.name}
                                    </p>
                                    <p className="truncate text-[11px] text-[var(--text-secondary)]">{shelter.address}</p>
                                    <p className="text-[10px] text-[var(--text-muted)]">{shelter.inspections} обстежень</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addShelterToSelection(shelter.id)}
                                    disabled={selected}
                                  >
                                    {selected ? 'Додано' : 'Додати'}
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => selectOnlyShelter(shelter.id)}>
                                    Тільки це
                                  </Button>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-3 py-4 text-[12px] text-[var(--text-secondary)]">Укриттів за цим запитом не знайдено</div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-3 text-[12px] text-[var(--text-muted)]">
                          Пошук не завантажує повний перелік. Введіть номер, назву або адресу, щоб знайти укриття.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--hover)] p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                          {selectedShelterIds.size ? 'Обрана вибірка укриттів' : 'Режим перегляду'}
                        </p>
                        {selectedShelterIds.size ? (
                          <button
                            type="button"
                            onClick={() => setSelectedShelterIds(new Set())}
                            className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)] hover:underline"
                          >
                            Очистити вибірку
                          </button>
                        ) : null}
                      </div>

                      {selectedShelterIds.size ? (
                        <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
                          {selectedShelters.map((shelter) => (
                            <button
                              key={shelter.id}
                              type="button"
                              onClick={() => removeShelterFromSelection(shelter.id)}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]"
                              title="Прибрати з вибірки"
                            >
                              <span className="truncate">{shelter.number}</span>
                              <X className="h-3.5 w-3.5 flex-none text-[var(--text-muted)]" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-4 text-[12px] text-[var(--text-secondary)]">
                          Показані обстеження по всіх доступних укриттях. Конкретний перелік не рендериться на екрані.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
                  <Button type="button" variant="outline" size="md" iconLeft={<X />} onClick={clearSearchFilters}>
                    Очистити
                  </Button>
                  <Button type="button" variant="primary" size="md" iconLeft={<Search />} onClick={applySearchFilters}>
                    Шукати
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <Card padding="lg">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <SectionLabel>Перелік обстежень</SectionLabel>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  Показано {filtered.length} з {items.length}
                  {appliedFilters.onlyFavorites ? ` · обрані ${favoriteInspectionIds.size}` : ''}
                </p>
              </div>
              <div className="inline-flex h-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-0.5">
                {[
                  { value: 'list' as const, label: 'Список', icon: <List /> },
                  { value: 'calendar' as const, label: 'Календар', icon: <CalendarDays /> },
                ].map((option) => {
                  const active = inspectionView === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setInspectionView(option.value)}
                      className={[
                        'inline-flex w-[112px] items-center justify-center gap-1.5 rounded-[calc(var(--radius-lg)-2px)] px-3 text-[11px] font-semibold transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5',
                        active
                          ? 'bg-[var(--accent)] text-[var(--color-on-accent)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]',
                      ].join(' ')}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filtered.length > 0 && inspectionView === 'list' ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      <th className="w-10 px-2 py-2">Обране</th>
                      <th className="px-2 py-2">Обстеження</th>
                      <th className="px-2 py-2">Дата</th>
                      <th className="px-2 py-2">Тип</th>
                      <th className="px-2 py-2">Статус</th>
                      <th className="px-2 py-2">Укриття</th>
                      <th className="px-2 py-2">Адреса</th>
                      <th className="px-2 py-2">Результат</th>
                      <th className="w-[176px] px-2 py-2 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filtered.map((inspection) => {
                      const isFavorite = favoriteInspectionIds.has(inspection.id);

                      return (
                      <tr key={inspection.id} className="align-top hover:bg-[var(--hover)]">
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            onClick={() => toggleFavoriteInspection(inspection.id)}
                            aria-label={
                              isFavorite
                                ? `Прибрати обстеження ${inspection.id} з обраних`
                                : `Додати обстеження ${inspection.id} до обраних`
                            }
                            title={isFavorite ? 'Прибрати з обраних' : 'Додати до обраних'}
                            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)]"
                          >
                            <Bookmark
                              className="h-4 w-4 transition-colors"
                              style={isFavorite ? { fill: 'var(--accent)', stroke: 'var(--accent)' } : undefined}
                            />
                          </button>
                        </td>
                        <td className="px-2 py-3 text-[12px] font-semibold text-[var(--text-primary)]">{inspection.id}</td>
                        <td className="px-2 py-3 text-[12px] text-[var(--text-secondary)]">{formatDate(inspection.date)}</td>
                        <td className="px-2 py-3 text-[12px] text-[var(--text-secondary)]">{typeLabel(inspection.type)}</td>
                        <td className="px-2 py-3">
                          <Badge severity={statusSeverity(inspection.status)} dot>
                            {statusLabel(inspection.status)}
                          </Badge>
                        </td>
                        <td className="px-2 py-3">
                          <Link href={`/shelters/${inspection.shelterId}`} className="text-[12px] font-semibold text-[var(--accent)] hover:underline">
                            {inspection.shelterNumber}
                            <span className="mt-0.5 block text-[11px] font-normal text-[var(--text-secondary)]">{inspection.shelterName}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-3 text-[12px] text-[var(--text-secondary)]">{inspection.shelterAddress}</td>
                        <td className="px-2 py-3 text-[12px] text-[var(--text-secondary)]">{inspection.result}</td>
                        <td className="w-[176px] px-2 py-3">
                          <div className="flex flex-col items-stretch gap-2">
                            <button
                              type="button"
                              onClick={() => setOpenedInspection(inspection)}
                              className="inline-flex w-full items-center gap-2 whitespace-nowrap text-left text-[12px] font-semibold text-[var(--accent)] transition-colors hover:text-[var(--text-primary)]"
                            >
                              <Eye className="h-3.5 w-3.5 shrink-0" />
                              Картка обстеження
                            </button>
                            <Link href={`/shelters/${inspection.shelterId}`} className="block w-full">
                              <span className="inline-flex w-full items-center gap-2 whitespace-nowrap text-left text-[12px] font-semibold text-[#9fb7ff] transition-colors hover:text-[var(--text-primary)]">
                                <Shield className="h-3.5 w-3.5 shrink-0" />
                                Картка укриття
                              </span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {filtered.length > 0 && inspectionView === 'calendar' ? (
              <ShelterInspectionCalendar
                inspections={filtered}
                cursor={calendarCursor}
                detail={calendarDetail}
                onMonthChange={changeCalendarMonth}
                onDetailChange={setCalendarDetail}
                onMonthSelect={(month) => {
                  setCalendarCursor(new Date(calendarCursor.getFullYear(), month, 1));
                  setCalendarDetail('month');
                }}
                onOpenInspection={setOpenedInspection}
                onAddInspection={openCalendarCreateInspection}
              />
            ) : null}

            {!filtered.length ? (
              <EmptyState title="Обстежень не знайдено" message="Змініть пошук або параметри фільтрації" />
            ) : null}
          </Card>
        </div>
      </div>

      <InspectionSummaryDock
        summary={summary}
        selectedShelterCount={appliedFilters.selectedShelterIds.size}
      />

      {openedInspection ? (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
          <button type="button" aria-label="Закрити картку обстеження" className="absolute inset-0 cursor-default" onClick={() => setOpenedInspection(null)} />
          <div className="relative z-[5001] w-full max-w-2xl rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 shadow-[0_40px_140px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionLabel>Картка обстеження</SectionLabel>
                <h2 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">{openedInspection.id}</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpenedInspection(null)}>
                ×
              </Button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <InfoTile label="Дата" value={formatDate(openedInspection.date)} />
              <InfoTile label="Тип" value={typeLabel(openedInspection.type)} />
              <InfoTile label="Статус" value={statusLabel(openedInspection.status)} />
              <InfoTile label="Інспектор" value={openedInspection.inspector} />
              <InfoTile label="Укриття" value={`${openedInspection.shelterNumber} · ${openedInspection.shelterName}`} />
              <InfoTile label="Адреса" value={openedInspection.shelterAddress} />
            </div>
            <div className="mt-3">
              <InfoTile label="Результат / опис" value={openedInspection.result} />
            </div>
          </div>
        </div>
      ) : null}

      {createInspectionType ? (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
          <button type="button" aria-label="Закрити додавання обстеження" className="absolute inset-0 cursor-default" onClick={() => setCreateInspectionType(null)} />
          <div className="relative z-[5001] w-full max-w-xl rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 shadow-[0_40px_140px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionLabel>Додати обстеження</SectionLabel>
                <h2 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">{typeLabel(createInspectionType)}</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setCreateInspectionType(null)}>
                ×
              </Button>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="grid gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Укриття</span>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted)]">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    value={createShelterSearch}
                    onFocus={() => setCreateShelterPickerOpen(true)}
                    onClick={() => setCreateShelterPickerOpen(true)}
                    onChange={(event) => {
                      setCreateShelterSearch(event.target.value);
                      setCreateShelterPickerOpen(true);
                      setCreateForm((current) => ({ ...current, shelterId: '' }));
                    }}
                    className="h-10 w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] py-2 pl-10 pr-3 text-[13px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                    placeholder="Номер, назва або адреса"
                  />
                  {createShelterPickerOpen ? (
                    <div className="absolute left-0 right-0 top-full z-[5010] mt-1 max-h-56 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                      {createShelterCandidates.length ? (
                        createShelterCandidates.map((shelter) => {
                          const selected = createForm.shelterId === shelter.id;
                          return (
                            <button
                              key={shelter.id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setCreateForm((current) => ({ ...current, shelterId: shelter.id }));
                                setCreateShelterSearch(`${shelter.number} · ${shelter.name}`);
                                setCreateShelterPickerOpen(false);
                              }}
                              className={[
                                'grid w-full gap-0.5 border-b border-[var(--border-subtle)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--hover-md)]',
                                selected ? 'bg-[var(--accent-08)]' : '',
                              ].join(' ')}
                            >
                              <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                                {shelter.number} · {shelter.name}
                              </span>
                              <span className="truncate text-[11px] text-[var(--text-secondary)]">{shelter.address}</span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-4 text-[12px] text-[var(--text-secondary)]">Укриттів за цим запитом не знайдено.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              {selectedShelters.length ? (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
                  Вибір обмежено {selectedShelters.length} укриттями з поточної вибірки.
                </p>
              ) : null}
              <Input
                label={createInspectionType === 'PLANNED' ? 'Місяць обстеження' : 'Дата обстеження'}
                type={createInspectionType === 'PLANNED' ? 'month' : 'date'}
                value={createInspectionType === 'PLANNED' ? createForm.date.slice(0, 7) : createForm.date}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    date:
                      createInspectionType === 'PLANNED'
                        ? event.target.value
                          ? firstDayOfMonth(event.target.value)
                          : ''
                        : event.target.value,
                  }))
                }
              />
              <label className="grid gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Коментар</span>
                <textarea
                  value={createForm.comment}
                  onChange={(event) => setCreateForm((current) => ({ ...current, comment: event.target.value }))}
                  rows={4}
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                  placeholder="Підстава або короткий опис обстеження"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="md" onClick={() => setCreateInspectionType(null)}>
                Скасувати
              </Button>
              <Button type="button" variant="primary" size="md" onClick={saveCreatedInspection} disabled={!createForm.shelterId || !createForm.date}>
                Додати обстеження
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--hover)] p-3">
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-1 text-[13px] leading-5 text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function ShelterInspectionCalendar({
  inspections,
  cursor,
  detail,
  onMonthChange,
  onDetailChange,
  onMonthSelect,
  onOpenInspection,
  onAddInspection,
}: {
  inspections: ShelterInspectionRow[];
  cursor: Date;
  detail: CalendarDetail;
  onMonthChange: (delta: number) => void;
  onDetailChange: (detail: CalendarDetail) => void;
  onMonthSelect: (month: number) => void;
  onOpenInspection: (inspection: ShelterInspectionRow) => void;
  onAddInspection: (type: Exclude<ShelterInspectionType, 'CONTROL'>, date: string) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;

  const byDay = useMemo(() => {
    const map = new Map<number, ShelterInspectionRow[]>();

    for (const inspection of inspections) {
      const [inspectionYear, inspectionMonth, inspectionDay] = inspection.date.split('-').map(Number);
      if (inspectionYear === year && inspectionMonth === month + 1) {
        map.set(inspectionDay, [...(map.get(inspectionDay) ?? []), inspection]);
      }
    }

    return map;
  }, [inspections, month, year]);

  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const monthCount = Array.from(byDay.values()).reduce((total, dayItems) => total + dayItems.length, 0);
  const yearMonthCounts = useMemo(() => {
    const counts = Array(12).fill(0) as number[];
    for (const inspection of inspections) {
      const [inspectionYear, inspectionMonth] = inspection.date.split('-').map(Number);
      if (inspectionYear === year) counts[inspectionMonth - 1] += 1;
    }
    return counts;
  }, [inspections, year]);
  const periodCount = detail === 'year' ? yearMonthCounts.reduce((total, count) => total + count, 0) : monthCount;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onMonthChange(detail === 'year' ? -12 : -1)}
            aria-label={detail === 'year' ? 'Попередній рік' : 'Попередній місяць'}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[168px] text-center text-[14px] font-semibold text-[var(--text-primary)]">
            {detail === 'year' ? year : `${MONTHS[month]} ${year}`}
          </p>
          <button
            type="button"
            onClick={() => onMonthChange(detail === 'year' ? 12 : 1)}
            aria-label={detail === 'year' ? 'Наступний рік' : 'Наступний місяць'}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-0.5">
            {[
              { value: 'month' as const, label: 'Місяць' },
              { value: 'year' as const, label: 'Рік' },
            ].map((option) => {
              const active = detail === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onDetailChange(option.value)}
                  className={[
                    'inline-flex w-[86px] items-center justify-center rounded-[calc(var(--radius-lg)-2px)] px-3 text-[11px] font-semibold transition-colors',
                    active
                      ? 'bg-[var(--accent)] text-[var(--color-on-accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {periodCount} {detail === 'year' ? 'обстежень у році' : 'обстежень у місяці'}
          </p>
        </div>
      </div>

      {detail === 'year' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MONTHS.map((monthName, index) => (
            <button
              key={monthName}
              type="button"
              onClick={() => onMonthSelect(index)}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-4 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--hover-md)]"
            >
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">{monthName}</span>
              <span className="mt-2 block text-[22px] font-bold text-[var(--text-primary)]">{yearMonthCounts[index]}</span>
              <span className="text-[11px] text-[var(--text-muted)]">обстежень</span>
            </button>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-7 gap-1">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {day}
          </div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="min-h-[92px]" />;

          const dayInspections = byDay.get(day) ?? [];
          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          return (
            <div
              key={day}
              className={[
                'group min-h-[112px] rounded-[var(--radius-md)] border p-1.5',
                dayInspections.length ? 'border-[var(--border-strong)] bg-[var(--hover)]' : 'border-[var(--border-subtle)] bg-transparent',
              ].join(' ')}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold leading-none text-[var(--text-secondary)]">{day}</p>
                <div className="opacity-0 transition-opacity group-hover:opacity-100">
                  <DropdownButton
                    label="+ обстеження"
                    variant="secondary"
                    size="sm"
                    align="right"
                    className="shadow-sm shadow-black/5"
                    actions={[
                      { label: 'Планове', icon: <CalendarPlus />, onClick: () => onAddInspection('PLANNED', date) },
                      { label: 'Позапланове', icon: <Plus />, onClick: () => onAddInspection('UNPLANNED', date) },
                    ]}
                  />
                </div>
              </div>
              <div className="space-y-1">
                {dayInspections.slice(0, 3).map((inspection) => (
                  <button
                    key={inspection.id}
                    type="button"
                    onClick={() => onOpenInspection(inspection)}
                    title={`${inspection.id} · ${inspection.shelterNumber} · ${inspection.shelterAddress}`}
                    className="block w-full truncate rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-1.5 py-1 text-left text-[10px] font-semibold leading-tight text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]"
                  >
                    {inspection.shelterNumber}
                    <span className="ml-1 font-normal text-[var(--text-muted)]">{typeLabel(inspection.type)}</span>
                  </button>
                ))}
                {dayInspections.length > 3 ? <p className="px-1 text-[9px] text-[var(--text-muted)]">+{dayInspections.length - 3} ще</p> : null}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
