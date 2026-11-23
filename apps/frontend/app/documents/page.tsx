'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Download,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileText,
  Filter,
  Info,
  MessageSquareText,
  Paperclip,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AppShell } from '@/app/components/AppShell';
import { apiFetch } from '@/lib/api';
import { Alert, Badge, Button, Card, Input, PageHeader, Pagination, SearchInput, Select, Table, Textarea } from '@repo/ui';

type ShelterRow = {
  id: string;
  name: string;
  type: string;
  accessType: string;
  capacity: number;
  address: string | null;
  status: string;
  sourceRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ShelterRequestRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'NEW' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  createdBy?: {
    email: string;
    role: string;
  };
  data: Record<string, unknown>;
};

type DocumentStatus = 'VALID' | 'REVIEW' | 'DRAFT' | 'ISSUE';
type DocumentScope = 'SHELTER' | 'REQUEST' | 'SYSTEM';

type DocumentRecord = {
  id: string;
  title: string;
  kind: string;
  number: string;
  date: string;
  updatedAt: string;
  status: DocumentStatus;
  scope: DocumentScope;
  contextId: string;
  contextTitle: string;
  contextHref: string;
  owner: string;
  sourceLabel: string;
  comments: string[];
};

type DocumentContextOption = {
  value: string;
  label: string;
  scope: DocumentScope;
  contextId: string;
  contextTitle: string;
  contextHref: string;
  sourceLabel: string;
  owner: string;
};

type AddDocumentForm = {
  contextKey: string;
  title: string;
  kind: string;
  number: string;
  date: string;
  owner: string;
  comment: string;
  fileName: string;
  fileSize: number;
};

const DOCUMENT_DEFINITIONS = [
  {
    key: 'technical-passport',
    title: 'Технічний паспорт',
    kind: 'Паспорт',
    numberKey: 'technicalPassportNumber',
    dateKey: 'technicalPassportDate',
  },
  {
    key: 'acceptance-act',
    title: 'Акт прийняття в експлуатацію',
    kind: 'Акт',
    numberKey: 'acceptanceActNumber',
    dateKey: 'acceptanceActDate',
  },
  {
    key: 'operation-permit',
    title: 'Дозвіл на експлуатацію',
    kind: 'Дозвіл',
    numberKey: 'operationPermitNumber',
    dateKey: 'operationPermitDate',
  },
  {
    key: 'insurance-policy',
    title: 'Страховий поліс',
    kind: 'Страхування',
    numberKey: 'insurancePolicyNumber',
    dateKey: 'insurancePolicyDate',
  },
] as const;

const STATUS_META: Record<DocumentStatus, { label: string; severity: 'ok' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  VALID: { label: 'Актуальний', severity: 'ok' },
  REVIEW: { label: 'На перевірці', severity: 'warning' },
  DRAFT: { label: 'Чернетка', severity: 'neutral' },
  ISSUE: { label: 'Потребує уваги', severity: 'danger' },
};

const SCOPE_META: Record<DocumentScope, { label: string; severity: 'ok' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  SHELTER: { label: 'Укриття', severity: 'info' },
  REQUEST: { label: 'Заявка', severity: 'warning' },
  SYSTEM: { label: 'Система', severity: 'neutral' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'Усі статуси' },
  { value: 'VALID', label: 'Актуальні' },
  { value: 'REVIEW', label: 'На перевірці' },
  { value: 'DRAFT', label: 'Чернетки' },
  { value: 'ISSUE', label: 'Потребують уваги' },
];

const SCOPE_OPTIONS = [
  { value: '', label: 'Увесь контекст' },
  { value: 'SHELTER', label: 'Укриття' },
  { value: 'REQUEST', label: 'Заявки' },
  { value: 'SYSTEM', label: 'Системні' },
];

const KIND_OPTIONS = [
  { value: '', label: 'Усі типи' },
  { value: 'Паспорт', label: 'Паспорт' },
  { value: 'Акт', label: 'Акт' },
  { value: 'Дозвіл', label: 'Дозвіл' },
  { value: 'Страхування', label: 'Страхування' },
  { value: 'Проєкт', label: 'Проєкт' },
  { value: 'Облікова картка', label: 'Облікова картка' },
];

const DOCUMENT_KIND_OPTIONS = [
  { value: '', label: 'Оберіть тип документа' },
  ...KIND_OPTIONS.filter((option) => option.value),
];

const EMPTY_ADD_DOCUMENT_FORM: AddDocumentForm = {
  contextKey: '',
  title: '',
  kind: '',
  number: '',
  date: '',
  owner: '',
  comment: '',
  fileName: '',
  fileSize: 0,
};

const DOCUMENT_FILE_MAX_BYTES = 10 * 1024 * 1024;
const DOCUMENT_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
const DOCUMENT_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'];
const DOCUMENTS_PAGE_SIZE = 15;

const DOCUMENT_LIFECYCLE = [
  {
    title: 'Формування',
    text: 'Документ надходить із заявки, картки укриття або ручного запису та отримує контекст.',
    icon: FileText,
    tone: 'text-[var(--color-info)]',
    bg: 'bg-[#60a5fa]/10',
  },
  {
    title: 'Перевірка',
    text: 'Власник або модератор звіряє реквізити, джерело і прив’язку до укриття.',
    icon: FileClock,
    tone: 'text-[var(--color-warning)]',
    bg: 'bg-[#f59e0b]/10',
  },
  {
    title: 'Публікація',
    text: 'Актуальна версія стає доступною з глобального архіву та контекстної сторінки.',
    icon: ShieldCheck,
    tone: 'text-[var(--accent)]',
    bg: 'bg-[var(--accent-10)]',
  },
  {
    title: 'Оновлення',
    text: 'Застарілі або проблемні документи повертаються на уточнення з коментарем.',
    icon: FileCheck2,
    tone: 'text-[var(--color-purple)]',
    bg: 'bg-[#6c63ff]/10',
  },
];

const MOCK_DOCUMENTS: DocumentRecord[] = [
  {
    id: 'mock-doc-technical-passport-valid',
    title: 'Технічний паспорт споруди цивільного захисту',
    kind: 'Паспорт',
    number: 'ТП-001-КВ/2026',
    date: '2026-04-12',
    updatedAt: '2026-04-18T10:30:00.000Z',
    status: 'VALID',
    scope: 'SHELTER',
    contextId: 'mock-shelter-001',
    contextTitle: 'Укриття на Хрещатику',
    contextHref: '/documents',
    owner: 'kyiv.registry@example.com',
    sourceLabel: 'Мок-дані',
    comments: ['Паспорт звірено з інвентаризаційною карткою.'],
  },
  {
    id: 'mock-doc-acceptance-review',
    title: 'Акт прийняття в експлуатацію',
    kind: 'Акт',
    number: 'АКТ-24/05-ЛВ',
    date: '2026-05-24',
    updatedAt: '2026-05-25T12:45:00.000Z',
    status: 'REVIEW',
    scope: 'REQUEST',
    contextId: 'mock-request-024',
    contextTitle: 'Заявка на укриття вул. Шевченка, 12',
    contextHref: '/documents',
    owner: 'lviv.region@example.com',
    sourceLabel: 'Заявка 024-ЛВ',
    comments: ['Очікує підтвердження реквізитів балансоутримувачем.'],
  },
  {
    id: 'mock-doc-operation-permit-draft',
    title: 'Дозвіл на експлуатацію після модернізації',
    kind: 'Дозвіл',
    number: 'Чернетка',
    date: '2026-06-01',
    updatedAt: '2026-06-01T09:15:00.000Z',
    status: 'DRAFT',
    scope: 'SHELTER',
    contextId: 'mock-shelter-005',
    contextTitle: 'Укриття Б. Хмельницького',
    contextHref: '/documents',
    owner: 'kharkiv.inspect@example.com',
    sourceLabel: 'Ручний запис',
    comments: ['Потрібно додати номер дозволу після погодження.'],
  },
  {
    id: 'mock-doc-insurance-issue',
    title: 'Страховий поліс відповідальності',
    kind: 'Страхування',
    number: 'INS-7782-2025',
    date: '2025-12-20',
    updatedAt: '2026-05-28T15:20:00.000Z',
    status: 'ISSUE',
    scope: 'SHELTER',
    contextId: 'mock-shelter-007',
    contextTitle: 'Укриття на Городоцькій',
    contextHref: '/documents',
    owner: 'insurance.office@example.com',
    sourceLabel: 'Мок-дані',
    comments: ['Строк дії поліса завершується, потрібне оновлення.'],
  },
  {
    id: 'mock-doc-project-review',
    title: 'Проєктна документація реконструкції входу',
    kind: 'Проєкт',
    number: 'PRJ-16/2026',
    date: '2026-03-17',
    updatedAt: '2026-03-21T11:05:00.000Z',
    status: 'REVIEW',
    scope: 'REQUEST',
    contextId: 'mock-request-016',
    contextTitle: 'Заявка на реконструкцію входу',
    contextHref: '/documents',
    owner: 'project.office@example.com',
    sourceLabel: 'Заявка 016-КВ',
    comments: ['На перевірці кошторисна частина та схема евакуації.'],
  },
  {
    id: 'mock-doc-registry-card-valid',
    title: 'Облікова картка укриття',
    kind: 'Облікова картка',
    number: 'УКР-009-ОД',
    date: '2026-02-08',
    updatedAt: '2026-05-02T08:40:00.000Z',
    status: 'VALID',
    scope: 'SYSTEM',
    contextId: 'mock-system-registry',
    contextTitle: 'Глобальний архів документів',
    contextHref: '/documents',
    owner: 'Система',
    sourceLabel: 'Мок-дані',
    comments: ['Системна картка створена після первинного обліку.'],
  },
  {
    id: 'mock-doc-safety-act-issue',
    title: 'Акт технічного стану вентиляції',
    kind: 'Акт',
    number: 'ВЕНТ-03/2026',
    date: '2026-01-29',
    updatedAt: '2026-02-02T13:25:00.000Z',
    status: 'ISSUE',
    scope: 'SHELTER',
    contextId: 'mock-shelter-003',
    contextTitle: 'Укриття на Лесі Українки',
    contextHref: '/documents',
    owner: 'inspection.team@example.com',
    sourceLabel: 'Огляд 003-КВ',
    comments: ['Виявлено зауваження щодо вентиляційного каналу.'],
  },
  {
    id: 'mock-doc-maintenance-draft',
    title: 'План поточного ремонту',
    kind: 'Проєкт',
    number: 'PLAN-REM-2026',
    date: '2026-06-04',
    updatedAt: '2026-06-04T07:30:00.000Z',
    status: 'DRAFT',
    scope: 'SYSTEM',
    contextId: 'mock-maintenance-plan',
    contextTitle: 'Планові роботи архіву',
    contextHref: '/documents',
    owner: 'regional@example.com',
    sourceLabel: 'Ручний запис',
    comments: ['Чернетка для погодження обсягів робіт.'],
  },
];

function readString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

function compactDate(value: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return date.toLocaleDateString('uk-UA');
}

function formatFileSize(bytes: number) {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function requestStatusToDocumentStatus(status: ShelterRequestRow['status']): DocumentStatus {
  if (status === 'APPROVED') return 'VALID';
  if (status === 'REJECTED') return 'ISSUE';
  return 'REVIEW';
}

function shelterStatusToDocumentStatus(status: string): DocumentStatus {
  if (status === 'DESTROYED' || status === 'MISUSE') return 'ISSUE';
  if (status === 'NEED' || status === 'PROJECT') return 'REVIEW';
  return 'VALID';
}

function buildDocuments(shelters: ShelterRow[], requests: ShelterRequestRow[]) {
  const documents: DocumentRecord[] = [];
  const approvedRequestToShelter = new Map(
    shelters
      .filter((shelter) => shelter.sourceRequestId)
      .map((shelter) => [shelter.sourceRequestId as string, shelter])
  );

  requests.forEach((request) => {
    const contextShelter = approvedRequestToShelter.get(request.id);
    const contextTitle = readString(request.data, 'name') || contextShelter?.name || `Заявка ${request.id.slice(0, 8)}`;
    const contextHref = contextShelter ? `/shelters/${contextShelter.id}` : `/shelter-requests/${request.id}`;
    const scope: DocumentScope = contextShelter ? 'SHELTER' : 'REQUEST';
    const owner = request.createdBy?.email ?? 'Система';
    const notes = readString(request.data, 'documentNotes');

    DOCUMENT_DEFINITIONS.forEach((definition) => {
      const number = readString(request.data, definition.numberKey);
      const date = readString(request.data, definition.dateKey);

      if (!number && !date) return;

      documents.push({
        id: `${request.id}-${definition.key}`,
        title: definition.title,
        kind: definition.kind,
        number: number || '—',
        date,
        updatedAt: request.updatedAt,
        status: requestStatusToDocumentStatus(request.status),
        scope,
        contextId: contextShelter?.id ?? request.id,
        contextTitle,
        contextHref,
        owner,
        sourceLabel: `Заявка ${request.id.slice(0, 8)}`,
        comments: [
          notes,
          request.rejectionReason ? `Причина відхилення: ${request.rejectionReason}` : '',
        ].filter(Boolean),
      });
    });

    const designDocLink = readString(request.data, 'designDocLink');
    if (designDocLink) {
      documents.push({
        id: `${request.id}-design-doc`,
        title: 'Проєктна документація',
        kind: 'Проєкт',
        number: designDocLink,
        date: readString(request.data, 'createdAt') || request.createdAt,
        updatedAt: request.updatedAt,
        status: requestStatusToDocumentStatus(request.status),
        scope,
        contextId: contextShelter?.id ?? request.id,
        contextTitle,
        contextHref,
        owner,
        sourceLabel: `Заявка ${request.id.slice(0, 8)}`,
        comments: notes ? [notes] : [],
      });
    }
  });

  shelters.forEach((shelter) => {
    documents.push({
      id: `${shelter.id}-registry-card`,
      title: 'Облікова картка укриття',
      kind: 'Облікова картка',
      number: shelter.id.slice(0, 8),
      date: shelter.createdAt,
      updatedAt: shelter.updatedAt,
      status: shelterStatusToDocumentStatus(shelter.status),
      scope: 'SYSTEM',
      contextId: shelter.id,
      contextTitle: shelter.name,
      contextHref: `/shelters/${shelter.id}`,
      owner: 'Система',
      sourceLabel: shelter.sourceRequestId ? `Заявка ${shelter.sourceRequestId.slice(0, 8)}` : 'Ручний запис',
      comments: shelter.address ? [`Адреса контексту: ${shelter.address}`] : [],
    });
  });

  return documents.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function exportDocuments(documents: DocumentRecord[]) {
  const rows = [
    ['Назва', 'Тип', 'Номер', 'Дата', 'Статус', 'Контекст', 'Власник'],
    ...documents.map((item) => [
      item.title,
      item.kind,
      item.number,
      compactDate(item.date),
      STATUS_META[item.status].label,
      item.contextTitle,
      item.owner,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `documents-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function DocumentSummaryDock({
  total,
  reviewCount,
  linkedContextCount,
  commentsCount,
  filteredCount,
  lifecycleOpen,
  onLifecycleToggle,
}: {
  total: number;
  reviewCount: number;
  linkedContextCount: number;
  commentsCount: number;
  filteredCount: number;
  lifecycleOpen: boolean;
  onLifecycleToggle: () => void;
}) {
  const metrics = [
    { key: 'total', label: 'Документів', value: total, icon: <Archive className="h-3.5 w-3.5 text-[var(--accent)]" /> },
    { key: 'review', label: 'Потребує уваги', value: reviewCount, icon: <FileClock className="h-3.5 w-3.5 text-[var(--color-warning)]" /> },
    { key: 'contexts', label: 'Контекстів', value: linkedContextCount, icon: <Paperclip className="h-3.5 w-3.5 text-[var(--color-info)]" /> },
    { key: 'comments', label: 'Коментарів', value: commentsCount, icon: <MessageSquareText className="h-3.5 w-3.5 text-[var(--color-purple)]" /> },
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
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-[var(--text-muted)]">
            {filteredCount === total ? 'Усі документи' : `Показано ${filteredCount} з ${total}`}
          </div>
          <button
            type="button"
            onClick={onLifecycleToggle}
            aria-expanded={lifecycleOpen}
            aria-label="Життєвий цикл документа"
            className={[
              'inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border transition-colors',
              lifecycleOpen
                ? 'border-[var(--accent-40)] bg-[var(--accent-10)] text-[var(--accent)]'
                : 'border-[var(--border-strong)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-md)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const [shelters, setShelters] = useState<ShelterRow[]>([]);
  const [requests, setRequests] = useState<ShelterRequestRow[]>([]);
  const [manualDocuments, setManualDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState('');
  const [kind, setKind] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLifecycleInfo, setShowLifecycleInfo] = useState(false);
  const [documentPage, setDocumentPage] = useState(1);
  const [addForm, setAddForm] = useState<AddDocumentForm>(EMPTY_ADD_DOCUMENT_FORM);
  const [addFormError, setAddFormError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      setLoading(true);
      setError('');

      try {
        const loadedShelters = await apiFetch<ShelterRow[]>('/shelters');
        let loadedRequests: ShelterRequestRow[] = [];

        try {
          loadedRequests = await apiFetch<ShelterRequestRow[]>('/shelter-requests');
        } catch {
          loadedRequests = [];
        }

        if (cancelled) return;
        setShelters(loadedShelters);
        setRequests(loadedRequests);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити документи');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, []);

  const contextOptions = useMemo<DocumentContextOption[]>(() => {
    const shelterOptions = shelters.map((shelter) => ({
      value: `SHELTER:${shelter.id}`,
      label: `Укриття · ${shelter.name}`,
      scope: 'SHELTER' as const,
      contextId: shelter.id,
      contextTitle: shelter.name,
      contextHref: `/shelters/${shelter.id}`,
      sourceLabel: shelter.sourceRequestId ? `Заявка ${shelter.sourceRequestId.slice(0, 8)}` : 'Картка укриття',
      owner: 'Система',
    }));

    const requestOptions = requests.map((request) => {
      const requestName = readString(request.data, 'name') || `Заявка ${request.id.slice(0, 8)}`;

      return {
        value: `REQUEST:${request.id}`,
        label: `Заявка · ${requestName}`,
        scope: 'REQUEST' as const,
        contextId: request.id,
        contextTitle: requestName,
        contextHref: `/shelter-requests/${request.id}`,
        sourceLabel: `Заявка ${request.id.slice(0, 8)}`,
        owner: request.createdBy?.email ?? 'Система',
      };
    });

    return [
      ...shelterOptions,
      ...requestOptions,
      {
        value: 'SYSTEM:registry',
        label: 'Система · Глобальний архів',
        scope: 'SYSTEM' as const,
        contextId: 'registry',
        contextTitle: 'Глобальний архів документів',
        contextHref: '/documents',
        sourceLabel: 'Ручний запис',
        owner: 'Система',
      },
    ];
  }, [requests, shelters]);

  const selectedContext = useMemo(() => {
    return contextOptions.find((option) => option.value === addForm.contextKey) ?? null;
  }, [addForm.contextKey, contextOptions]);

  const documents = useMemo(
    () => [...manualDocuments, ...MOCK_DOCUMENTS, ...buildDocuments(shelters, requests)],
    [manualDocuments, shelters, requests]
  );

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uk-UA');
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return documents.filter((item) => {
      if (status && item.status !== status) return false;
      if (scope && item.scope !== scope) return false;
      if (kind && item.kind !== kind) return false;
      if (fromTime !== null || toTime !== null) {
        const itemTime = new Date(item.date).getTime();

        if (!Number.isFinite(itemTime)) return false;
        if (fromTime !== null && itemTime < fromTime) return false;
        if (toTime !== null && itemTime > toTime) return false;
      }
      if (!query) return true;

      return [
        item.title,
        item.kind,
        item.number,
        item.contextTitle,
        item.owner,
        item.sourceLabel,
        ...item.comments,
      ].some((value) => value.toLocaleLowerCase('uk-UA').includes(query));
    });
  }, [dateFrom, dateTo, documents, kind, scope, search, status]);

  const selectedDocument = useMemo(() => {
    return filteredDocuments.find((item) => item.id === selectedId) ?? filteredDocuments[0] ?? null;
  }, [filteredDocuments, selectedId]);

  const totalDocumentPages = Math.max(1, Math.ceil(filteredDocuments.length / DOCUMENTS_PAGE_SIZE));
  const paginatedDocuments = useMemo(() => {
    const safePage = Math.min(documentPage, totalDocumentPages);
    const start = (safePage - 1) * DOCUMENTS_PAGE_SIZE;

    return filteredDocuments.slice(start, start + DOCUMENTS_PAGE_SIZE);
  }, [documentPage, filteredDocuments, totalDocumentPages]);

  const activeFilterCount = [status, scope, kind, dateFrom, dateTo].filter(Boolean).length;
  const linkedContextCount = new Set(documents.map((item) => item.contextId)).size;
  const reviewCount = documents.filter((item) => item.status === 'REVIEW' || item.status === 'ISSUE').length;
  const commentsCount = documents.reduce((sum, item) => sum + item.comments.length, 0);

  useEffect(() => {
    setDocumentPage(1);
  }, [dateFrom, dateTo, kind, scope, search, status]);

  useEffect(() => {
    if (documentPage > totalDocumentPages) {
      setDocumentPage(totalDocumentPages);
    }
  }, [documentPage, totalDocumentPages]);

  function resetFilters() {
    setStatus('');
    setScope('');
    setKind('');
    setDateFrom('');
    setDateTo('');
  }

  function closeAddDialog() {
    setShowAddDialog(false);
    setAddForm(EMPTY_ADD_DOCUMENT_FORM);
    setAddFormError('');
  }

  function createManualDocument() {
    if (!selectedContext) {
      setAddFormError('Спершу оберіть контекст документа');
      return;
    }

    if (!addForm.kind || !addForm.title.trim()) {
      setAddFormError('Заповніть тип і назву документа');
      return;
    }

    const now = new Date().toISOString();
    const comments = [
      addForm.comment.trim(),
      addForm.fileName ? `Файл: ${addForm.fileName} (${formatFileSize(addForm.fileSize)})` : '',
    ].filter(Boolean);

    const nextDocument: DocumentRecord = {
      id: `manual-${Date.now()}`,
      title: addForm.title.trim(),
      kind: addForm.kind,
      number: addForm.number.trim() || 'Чернетка',
      date: addForm.date || now,
      updatedAt: now,
      status: 'DRAFT',
      scope: selectedContext.scope,
      contextId: selectedContext.contextId,
      contextTitle: selectedContext.contextTitle,
      contextHref: selectedContext.contextHref,
      owner: addForm.owner.trim() || selectedContext.owner,
      sourceLabel: selectedContext.sourceLabel,
      comments: comments.length ? comments : ['Створено вручну після вибору контексту'],
    };

    setManualDocuments((current) => [nextDocument, ...current]);
    setSelectedId(nextDocument.id);
    setStatus('');
    setScope('');
    setKind('');
    setSearch('');
    closeAddDialog();
  }

  function handleDocumentFileChange(file: File | undefined) {
    if (!file) {
      setAddForm((current) => ({ ...current, fileName: '', fileSize: 0 }));
      setAddFormError('');
      return;
    }

    const extension = file.name.split('.').pop()?.toLocaleLowerCase('uk-UA') ?? '';

    if (!DOCUMENT_FILE_EXTENSIONS.includes(extension)) {
      setAddForm((current) => ({ ...current, fileName: '', fileSize: 0 }));
      setAddFormError('Недозволений формат файлу. Доступні: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX.');
      return;
    }

    if (file.size > DOCUMENT_FILE_MAX_BYTES) {
      setAddForm((current) => ({ ...current, fileName: '', fileSize: 0 }));
      setAddFormError('Файл завеликий. Максимальний розмір — 10 МБ.');
      return;
    }

    setAddForm((current) => ({ ...current, fileName: file.name, fileSize: file.size }));
    setAddFormError('');
  }

  const columns = [
    {
      key: 'title',
      header: 'Документ',
      cell: (row: DocumentRecord) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{row.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{row.number}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Тип',
      width: '132px',
      cell: (row: DocumentRecord) => <span className="text-[12px] text-[var(--text-secondary)]">{row.kind}</span>,
    },
    {
      key: 'context',
      header: 'Контекст',
      cell: (row: DocumentRecord) => (
        <div className="min-w-0">
          <Badge severity={SCOPE_META[row.scope].severity}>{SCOPE_META[row.scope].label}</Badge>
          <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{row.contextTitle}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '148px',
      cell: (row: DocumentRecord) => (
        <Badge severity={STATUS_META[row.status].severity} dot>
          {STATUS_META[row.status].label}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'Дата',
      width: '108px',
      cell: (row: DocumentRecord) => <span className="text-[11px] text-[var(--text-muted)]">{compactDate(row.date)}</span>,
    },
    {
      key: 'comments',
      header: 'Коментарі',
      width: '96px',
      cell: (row: DocumentRecord) => (
        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
          <MessageSquareText className="h-3.5 w-3.5" />
          {row.comments.length}
        </span>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Документи"
        subtitle="Дизайн системи / Документи"
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={[
                'relative inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-lg)] border px-3 text-[12px] font-medium transition-colors duration-100 outline-none',
                showFilters
                  ? 'border-[var(--accent-40)] bg-[var(--accent-10)] text-[var(--accent)]'
                  : 'border-[var(--border-strong)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              <Filter className="h-3.5 w-3.5" />
              Фільтри
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-[var(--color-on-accent)]">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <Button
              variant="outline"
              size="md"
              iconLeft={<Download />}
              disabled={!filteredDocuments.length}
              onClick={() => exportDocuments(filteredDocuments)}
            >
              Експорт
            </Button>
            <Button
              variant="primary"
              size="md"
              iconLeft={<Plus />}
              onClick={() => setShowAddDialog(true)}
            >
              Додати документ
            </Button>
          </>
        }
      />

      {showFilters ? (
        <div className="fixed left-4 right-4 top-[104px] z-40 md:left-[224px] md:right-6">
          <div className="ml-auto w-full max-w-[720px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
            <div className="flex justify-end gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                >
                  <X className="h-3 w-3" />
                  Скинути
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)]"
                aria-label="Закрити фільтри"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid gap-4 px-4 py-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Select
                  label="Статус"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                />
                <Select
                  label="Контекст"
                  options={SCOPE_OPTIONS}
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                />
                <Select
                  label="Тип"
                  options={KIND_OPTIONS}
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                />
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Дата документа</span>
                  <span className="text-[11px] text-[var(--text-muted)]">з - до</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="З"
                    aria-label="Дата з"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                  <Input
                    label="До"
                    aria-label="Дата до"
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-4 py-3">
              <span className="text-[11px] text-[var(--text-muted)]">
                {activeFilterCount ? `Активно: ${activeFilterCount}` : 'Без активних фільтрів'}
              </span>
              <Button type="button" variant="primary" size="md" onClick={() => setShowFilters(false)}>
                Готово
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 p-6 pb-28">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Пошук документів..." />
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
            {filteredDocuments.length} з {documents.length}
          </div>
        </div>

        {error ? <Alert severity="danger">{error}</Alert> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Глобальний архів</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Загальний принцип роботи з документами в Системі</p>
            </div>
            <Card padding="none">
              <Table
                data={paginatedDocuments}
                columns={columns}
                keyExtractor={(row) => row.id}
                onRowClick={(row) => setSelectedId(row.id)}
                loading={loading}
                emptyMessage="Документів не знайдено"
              />
            </Card>
            {filteredDocuments.length > DOCUMENTS_PAGE_SIZE ? (
              <Pagination
                page={documentPage}
                totalPages={totalDocumentPages}
                total={filteredDocuments.length}
                limit={DOCUMENTS_PAGE_SIZE}
                onChange={setDocumentPage}
              />
            ) : null}
          </div>

          <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Контекст</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Модель коментування і прив’язки</p>
            </div>

            <Card>
              {selectedDocument ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-10)] text-[var(--accent)]">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{selectedDocument.title}</p>
                      <p className="mt-0.5 break-words text-[11px] text-[var(--text-muted)]">{selectedDocument.number}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge severity={STATUS_META[selectedDocument.status].severity} dot>
                      {STATUS_META[selectedDocument.status].label}
                    </Badge>
                    <Badge severity={SCOPE_META[selectedDocument.scope].severity}>
                      {SCOPE_META[selectedDocument.scope].label}
                    </Badge>
                  </div>

                  <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
                    <InfoRow label="Контекст" value={selectedDocument.contextTitle} />
                    <InfoRow label="Джерело" value={selectedDocument.sourceLabel} />
                    <InfoRow label="Власник" value={selectedDocument.owner} />
                    <InfoRow label="Дата" value={compactDate(selectedDocument.date)} />
                  </div>

                  <Link
                    href={selectedDocument.contextHref}
                    className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-transparent px-3.5 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-md)]"
                  >
                    <span>Відкрити контекст</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <FileCheck2 className="mx-auto h-10 w-10 text-[var(--text-ghost)]" />
                  <p className="mt-3 text-[13px] font-medium text-[var(--text-secondary)]">Немає вибраного документа</p>
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold text-[var(--text-primary)]">Коментарі</p>
                <MessageSquareText className="h-4 w-4 text-[var(--text-muted)]" />
              </div>

              <div className="mt-3 space-y-3">
                {selectedDocument?.comments.length ? (
                  selectedDocument.comments.map((comment, index) => (
                    <div key={`${selectedDocument.id}-${index}`} className="border-l border-[var(--accent-40)] pl-3">
                      <p className="text-[12px] leading-5 text-[var(--text-secondary)]">{comment}</p>
                      <p className="mt-1 text-[10px] text-[var(--text-muted)]">Документальний контекст</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] leading-5 text-[var(--text-muted)]">Коментарів поки немає</p>
                )}
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--accent)]" />
                <div>
                  <p className="text-[12px] font-semibold text-[var(--text-primary)]">Модель</p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                    Документ існує в архіві один раз і відкривається з контексту укриття, заявки або системної картки.
                  </p>
                </div>
              </div>
            </Card>
          </aside>
        </div>

      </div>

      {showLifecycleInfo ? (
        <div className="fixed bottom-24 left-4 right-4 z-40 md:left-[248px]">
          <div className="mx-auto max-h-[calc(100vh-11rem)] max-w-7xl overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">Життєвий цикл документа</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Стани, переходи і відповідальні дії в архіві</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLifecycleInfo(false)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)]"
                aria-label="Закрити життєвий цикл документа"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {DOCUMENT_LIFECYCLE.map((step, index) => {
                const Icon = step.icon;

                return (
                  <Card key={step.title}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-lg)] ${step.bg} ${step.tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Крок {index + 1}
                        </p>
                        <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{step.title}</p>
                        <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">{step.text}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <DocumentSummaryDock
        total={documents.length}
        reviewCount={reviewCount}
        linkedContextCount={linkedContextCount}
        commentsCount={commentsCount}
        filteredCount={filteredDocuments.length}
        lifecycleOpen={showLifecycleInfo}
        onLifecycleToggle={() => setShowLifecycleInfo((current) => !current)}
      />

      {showAddDialog ? (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
          <button type="button" aria-label="Закрити" className="absolute inset-0 cursor-default" onClick={closeAddDialog} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-document-title"
            className="relative z-[6001] max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_40px_140px_rgba(0,0,0,0.72)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <p id="add-document-title" className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Додати документ
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                  Контекст є обов’язковим: документ має бути прив’язаний до об’єкту укриття, технічної інвентаризації або огляду
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddDialog}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <Select
                label="Контекст документа"
                required
                value={addForm.contextKey}
                onChange={(event) => {
                  setAddForm((current) => ({ ...current, contextKey: event.target.value }));
                  setAddFormError('');
                }}
                options={[
                  { value: '', label: 'Оберіть контекст' },
                  ...contextOptions.map((option) => ({ value: option.value, label: option.label })),
                ]}
                error={addFormError && !selectedContext ? addFormError : undefined}
              />

              {selectedContext ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--accent-40)] bg-[var(--accent-10)] px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge severity={SCOPE_META[selectedContext.scope].severity}>{SCOPE_META[selectedContext.scope].label}</Badge>
                    <span className="min-w-0 truncate text-[12px] font-medium text-[var(--text-primary)]">
                      {selectedContext.contextTitle}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className={selectedContext ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 opacity-45 sm:grid-cols-2'}>
                <Select
                  label="Тип документа"
                  required
                  disabled={!selectedContext}
                  value={addForm.kind}
                  onChange={(event) => {
                    setAddForm((current) => ({ ...current, kind: event.target.value }));
                    setAddFormError('');
                  }}
                  options={DOCUMENT_KIND_OPTIONS}
                />
                <Input
                  label="Назва"
                  required
                  disabled={!selectedContext}
                  value={addForm.title}
                  onChange={(event) => {
                    setAddForm((current) => ({ ...current, title: event.target.value }));
                    setAddFormError('');
                  }}
                  placeholder="Наприклад: Акт обстеження"
                />
                <Input
                  label="Номер"
                  disabled={!selectedContext}
                  value={addForm.number}
                  onChange={(event) => setAddForm((current) => ({ ...current, number: event.target.value }))}
                  placeholder="№ документа"
                />
                <Input
                  label="Дата"
                  type="date"
                  disabled={!selectedContext}
                  value={addForm.date}
                  onChange={(event) => setAddForm((current) => ({ ...current, date: event.target.value }))}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Власник"
                    disabled={!selectedContext}
                    value={addForm.owner}
                    onChange={(event) => setAddForm((current) => ({ ...current, owner: event.target.value }))}
                    placeholder={selectedContext?.owner ?? 'Відповідальний'}
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="grid gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                      Файл документа
                    </span>
                    <label
                      className={[
                        'flex cursor-pointer flex-col gap-2 rounded-[var(--radius-lg)] border border-dashed px-3 py-3 transition-colors',
                        selectedContext
                          ? 'border-[var(--border-strong)] bg-[var(--bg-surface-2)] hover:border-[var(--accent-40)]'
                          : 'pointer-events-none border-[var(--border)] bg-[var(--bg-surface-2)] opacity-60',
                      ].join(' ')}
                    >
                      <input
                        type="file"
                        accept={DOCUMENT_FILE_ACCEPT}
                        disabled={!selectedContext}
                        onChange={(event) => handleDocumentFileChange(event.target.files?.[0])}
                        className="sr-only"
                      />
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                        {addForm.fileName || 'Завантажити файл'}
                      </span>
                      <span className="text-[11px] leading-5 text-[var(--text-muted)]">
                        Дозволені формати: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX. Максимальний розмір файлу — 10 МБ.
                      </span>
                    </label>
                    {addForm.fileName ? (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Обрано: {addForm.fileName} · {formatFileSize(addForm.fileSize)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Textarea
                    label="Коментар"
                    disabled={!selectedContext}
                    value={addForm.comment}
                    onChange={(event) => setAddForm((current) => ({ ...current, comment: event.target.value }))}
                    placeholder="Додаткові примітки до документа"
                    rows={3}
                  />
                </div>
              </div>

              {addFormError && selectedContext ? (
                <Alert severity="danger">{addFormError}</Alert>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
              <Button type="button" variant="outline" size="md" onClick={closeAddDialog}>
                Скасувати
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!selectedContext}
                onClick={createManualDocument}
              >
                Створити чернетку
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
      <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[12px] text-[var(--text-secondary)]">{value || '—'}</span>
    </div>
  );
}
