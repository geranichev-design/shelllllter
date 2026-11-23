'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  Edit2,
  FileText,
  MapPinned,
  Shield,
  ShieldCheck,
  Upload,
  X,
  Users,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AppShell } from '@/app/components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  DropdownButton,
  EmptyState,
  Input,
  PageHeader,
  Select,
  SectionLabel,
  Textarea,
  ShelterStatusBadge,
  ShelterTypeBadge,
} from '@repo/ui';

type ShelterOwnerOrg = {
  id: string;
  name: string;
  type: string;
};

type ShelterSourceRequest = {
  id: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  createdBy: { id: string; email: string; role: string };
  reviewedBy: { id: string; email: string; role: string } | null;
  data: Record<string, unknown>;
};

type ShelterInspection = {
  id: string;
  result: string;
  createdAt: string;
  createdByUser: { id: string; email: string; role: string };
};

type PlannedShelterInspectionType = 'PLANNED' | 'UNPLANNED' | 'CONTROL';
type PlannedShelterInspectionStatus = 'PLANNED' | 'DONE' | 'OVERDUE' | 'CANCELLED';

type PlannedShelterInspection = {
  id: string;
  type: PlannedShelterInspectionType;
  date: string;
  status: PlannedShelterInspectionStatus;
  parentInspectionId?: string;
  reason?: string;
  comment?: string;
  documentName?: string;
};

type ShelterDetail = {
  id: string;
  name: string;
  type: string;
  accessType: string;
  capacity: number;
  latitude: number;
  longitude: number;
  status: string;
  accountingStatus: string;
  recordStatus: string;
  ownerOrgId: string;
  sourceRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  ownerOrg: ShelterOwnerOrg;
  sourceRequest: ShelterSourceRequest | null;
  inspections: ShelterInspection[];
};

type OrganizationOption = {
  id: string;
  name: string;
};

type EditShelterForm = {
  name: string;
  type: string;
  accessType: string;
  capacity: string;
  latitude: string;
  longitude: string;
  status: string;
  accountingStatus: string;
  recordStatus: string;
  ownerOrgId: string;
};

type SectionEditorTab = TabName;

const SHELTER_TYPE_OPTIONS = [
  { value: 'STATIC', label: 'Стаціонарне' },
];

const ACCESS_TYPE_OPTIONS = [
  { value: 'PUBLIC', label: 'Відкритий доступ' },
  { value: 'PRIVATE', label: 'Обмежений доступ' },
];

const SHELTER_STATUS_OPTIONS = [
  { value: 'NEED', label: 'Потреба' },
  { value: 'PROJECT', label: 'Проєкт' },
  { value: 'CONSTRUCTION', label: 'Будівництво' },
  { value: 'OPERATION', label: 'Експлуатація' },
  { value: 'MODERNIZATION', label: 'Модернізація' },
  { value: 'REPAIR', label: 'Ремонт' },
  { value: 'CONSERVATION', label: 'Консервація' },
  { value: 'MISUSE', label: 'Не за призначенням' },
  { value: 'DESTROYED', label: 'Знищено' },
];

const ACCOUNTING_STATUS_OPTIONS = [
  { value: 'NEW', label: 'Новий' },
  { value: 'IN_PROGRESS', label: 'В обробці' },
  { value: 'ACCOUNTED', label: 'Обліковується' },
  { value: 'REMOVED', label: 'Вилучений з обліку' },
  { value: 'REJECTED', label: 'Відхилено' },
];

const RECORD_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Чернетка' },
  { value: 'ACTIVE', label: 'Активний' },
  { value: 'SUSPENDED', label: 'Призупинений' },
  { value: 'DELETED', label: 'Видалений' },
];

const UNPLANNED_REASON_OPTIONS = [
  { value: 'EVENT_DAMAGE', label: 'Повідомлення про пошкодження' },
  { value: 'ACCESS_BLOCKED', label: 'Скарга на обмежений доступ' },
  { value: 'OWNER_REQUEST', label: 'Звернення балансоутримувача' },
  { value: 'PUBLIC_EVENT', label: 'Інформація про подію біля об’єкта' },
  { value: 'OTHER', label: 'Інша підстава' },
];

const TABS = [
  'Основні параметри',
  'Розташування та доступність',
  'Характеристики укриття',
  'Власність та відповідальні',
  'Технічна інвентаризація',
  'Огляди',
  'Заходи',
  'Медіа',
  'Документи',
  'Фінанси',
] as const;

type TabName = (typeof TABS)[number];

type FieldDef = {
  label: string;
  value: unknown;
};

function Field({ label, value }: FieldDef) {
  const display =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'boolean'
        ? value
          ? 'Так'
          : 'Ні'
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 break-words text-[13px] text-[var(--text-primary)]">{display}</p>
    </div>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <SectionLabel>{title}</SectionLabel>
      {description ? <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{description}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  fields,
  children,
}: {
  title: string;
  description?: string;
  fields?: FieldDef[];
  children?: ReactNode;
}) {
  const hasFields = fields ? hasAnyValue(fields.map((field) => field.value)) : true;

  return (
    <div>
      <SectionTitle title={title} description={description} />
      {fields && hasFields ? (
        <FieldGrid>
          {fields.map((field) => (
            <Field key={field.label} label={field.label} value={field.value} />
          ))}
        </FieldGrid>
      ) : fields ? (
        <EmptyState title="Дані не заповнені" />
      ) : (
        children
      )}
    </div>
  );
}

function TabBar({
  active,
  onChange,
  counts,
}: {
  active: TabName;
  onChange: (tab: TabName) => void;
  counts: Partial<Record<TabName, number>>;
}) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3"
      data-migra-component="Navigation/TabBar"
      data-migra-props={JSON.stringify({
        tabs: TABS,
        activeIndex: String(TABS.indexOf(active) + 1),
        counts: TABS.map((tab) => counts[tab] ?? 0),
      })}
    >
      <div className="mb-3">
        <SectionLabel>Розділи</SectionLabel>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Оберіть вкладку для перегляду або редагування.</p>
      </div>

      <div className="space-y-1">
      {TABS.map((tab) => {
        const isActive = tab === active;
        const count = counts[tab];

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={[
              'flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-[12px] font-medium transition-colors duration-100',
              isActive
                ? 'bg-[var(--accent-10)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--hover-md)] hover:text-[var(--text-secondary)]',
            ].join(' ')}
          >
            <span className="min-w-0 flex-1 truncate">{tab}</span>
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--hover-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
              {typeof count === 'number' ? count : 0}
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('uk-UA');
}

function formatDay(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function addBusinessDays(dateValue: string, days: number) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  let remaining = Math.max(0, days);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function addCalendarDays(dateValue: string, days: number) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function plannedInspectionTypeLabel(type: PlannedShelterInspectionType) {
  const labels: Record<PlannedShelterInspectionType, string> = {
    PLANNED: 'Планове',
    UNPLANNED: 'Позапланове',
    CONTROL: 'Контрольне',
  };
  return labels[type];
}

function plannedInspectionStatusLabel(status: PlannedShelterInspectionStatus) {
  const labels: Record<PlannedShelterInspectionStatus, string> = {
    PLANNED: 'Заплановано',
    DONE: 'Виконано',
    OVERDUE: 'Прострочено',
    CANCELLED: 'Скасовано',
  };
  return labels[status];
}

function plannedInspectionStatusSeverity(status: PlannedShelterInspectionStatus): 'ok' | 'warning' | 'neutral' | 'info' {
  const severities: Record<PlannedShelterInspectionStatus, 'ok' | 'warning' | 'neutral' | 'info'> = {
    PLANNED: 'info',
    DONE: 'ok',
    OVERDUE: 'warning',
    CANCELLED: 'neutral',
  };
  return severities[status];
}

function effectivePlannedInspectionStatus(inspection: PlannedShelterInspection): PlannedShelterInspectionStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (inspection.status === 'PLANNED' && inspection.date < today) return 'OVERDUE';
  return inspection.status;
}

function buildInitialShelterSchedule(shelter: ShelterDetail, data: Record<string, unknown>): PlannedShelterInspection[] {
  const lastInspectionDate = toDateInputValue(String(getText(data, 'lastInspectionDate') === '—' ? shelter.updatedAt : getText(data, 'lastInspectionDate')));
  const baseDate = lastInspectionDate || toDateInputValue(shelter.updatedAt);
  const nextPlannedDate = toDateInputValue(String(getText(data, 'nextInspectionDate') === '—' ? '' : getText(data, 'nextInspectionDate'))) || addCalendarDays(baseDate, 90);
  const controlParent = shelter.inspections[0]?.id;

  return [
    {
      id: `planned-${shelter.id}`,
      type: 'PLANNED',
      date: nextPlannedDate,
      status: 'PLANNED',
      comment: 'Чергове планове обстеження об’єкта укриття.',
    },
    ...(controlParent
      ? [
          {
            id: `control-${shelter.id}`,
            type: 'CONTROL' as const,
            date: addBusinessDays(baseDate, 10),
            status: 'PLANNED' as const,
            parentInspectionId: controlParent,
            comment: 'Контроль усунення зауважень за результатами планового огляду.',
          },
        ]
      : []),
  ];
}

function formatCoordinates(lat?: number | null, lng?: number | null) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return '—';
  }

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function getText(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return value === undefined || value === null || value === '' ? '—' : value;
}

function hasAnyValue(fields: unknown[]): boolean {
  return fields.some((value) => value !== null && value !== undefined && value !== '');
}

function countPresentValues(fields: unknown[]) {
  return fields.filter((value) => value !== null && value !== undefined && value !== '').length;
}

function pickFields(source: Record<string, unknown>, keys: readonly string[]) {
  return keys.reduce<Record<string, unknown>>((acc, key) => {
    if (source[key] !== undefined) {
      acc[key] = source[key];
    }
    return acc;
  }, {});
}

function omitFields(source: Record<string, unknown>, keys: readonly string[]) {
  const result: Record<string, unknown> = { ...source };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

const ROOT_EDIT_KEYS = [
  'name',
  'type',
  'accessType',
  'capacity',
  'latitude',
  'longitude',
  'status',
  'accountingStatus',
  'recordStatus',
  'ownerOrgId'
] as const;

const SECTION_EDIT_KEYS: Record<SectionEditorTab, string[]> = {
  'Основні параметри': [
    'accountNumber',
    'tempNumber',
    'technicalNumber',
    'registrationDate',
    'name',
    'region',
    'shelterKind',
    'shelterStatusDate',
    'accountingStatusDate',
    'recordStatusDate',
    'isPublished',
    'responsible',
  ],
  'Розташування та доступність': [
    'address',
    'country',
    'region',
    'district',
    'community',
    'settlement',
    'settlementType',
    'streetType',
    'streetName',
    'building',
    'corpus',
    'apartment',
    'postalCode',
    'katottg',
    'latEntrance',
    'lonEntrance',
    'latCenter',
    'lonCenter',
    'walkRadius',
    'relativeLocation',
    'areaDescription',
    'dangerZones',
    'currentAddress',
    'currentAddressUpdatedAt',
  ],
  'Характеристики укриття': [
    'alwaysReady',
    'readinessTime',
    'populationCategories',
    'area',
    'volume',
    'capacity',
    'accessibleForDisabled',
    'barrierFreeAccess',
    'shelterClass',
    'floorsCount',
    'entrancesCount',
    'emergencyExitsCount',
  ],
  'Власність та відповідальні': [
    'ownershipForm',
    'departmentalAffiliation',
    'governmentBody',
    'institution',
    'balanceHolder',
    'operationalManagementForm',
    'operationStartDate',
    'orgName',
    'orgEdrpou',
    'orgAddress',
    'orgActivity',
    'contactLastName',
    'contactFirstName',
    'contactMiddleName',
    'contactPosition',
    'contactPhone',
    'contactEmail',
    'contactIsCurrent',
    'managerLastName',
    'managerFirstName',
    'managerMiddleName',
    'managerPosition',
    'ownerName',
    'ownerEdrpou',
    'ownerAddress',
    'ownerActivity',
  ],
  'Технічна інвентаризація': [
    'buildingRegistryNumber',
    'buildingInventoryDate',
    'btiName',
    'purposeCode',
    'purposeName',
    'peacetimePurpose',
    'designerName',
    'designerEdrpou',
    'designDocLink',
    'contractorName',
    'contractorEdrpou',
    'isGeneralContractor',
    'doorType',
    'doorMark',
    'doorCount',
    'ventilationSystem',
    'fanType',
    'fanCapacity',
    'fanCount',
    'filterType',
    'filterCount',
    'valveType',
    'valveCapacity',
    'valveCount',
    'antiBlastType',
    'antiBlastCount',
    'pumpType',
    'pumpCapacity',
    'pumpCount',
    'heaterType',
    'heaterCapacity',
    'heaterCount',
    'coolingType',
    'coolingCapacity',
    'coolingCount',
    'measuringType',
    'measuringCount',
    'sealingDegree',
    'mainPowerSource',
    'powerReliabilityCategory',
    'lighting',
    'backupPower',
    'engineeringPower',
    'powerProtection',
    'hasWaterSupply',
    'waterSource',
    'waterPurpose',
    'waterReserveLocation',
    'waterCapacityLiters',
    'sewageSystemType',
    'sewageSystemKind',
    'heatingClass',
    'heatingSubclass',
    'heatingType',
    'radioPoint',
    'otherPropertyType',
    'otherPropertyName',
    'otherPropertyCount',
  ],
  Огляди: [
    'inspectionView',
    'inspectionType',
    'lastInspectionDate',
    'inspectionStatus',
    'inspectionResult',
  ],
  Заходи: [
    'inspectionSchedule',
    'inspectionScheduleNotes',
  ],
  'Медіа': ['media'],
  Документи: [
    'documentType',
    'documentSubType',
    'technicalPassportNumber',
    'documentCreatedAt',
    'documentDate',
    'documentNumber',
    'documentOriginalNumber',
    'relatedObject',
    'technicalPassportDate',
    'acceptanceActNumber',
    'acceptanceActDate',
    'operationPermitNumber',
    'operationPermitDate',
    'insurancePolicyNumber',
    'insurancePolicyDate',
    'documentNotes',
  ],
  Фінанси: [
    'estimatedReadyCost',
    'constructionModernizationCost',
    'costValue',
    'valuationDate',
    'approved',
    'totalFines',
    'fundingSource',
    'budgetCode',
    'balanceValue',
    'annualMaintenanceCost',
    'lastValuationDate',
  ],
};

const FIELD_LABELS: Record<string, string> = {
  accountNumber: 'Обліковий номер',
  tempNumber: 'Тимчасовий номер',
  technicalNumber: 'Технічний номер',
  registrationDate: 'Дата реєстрації',
  name: 'Назва об’єкта',
  region: 'Регіон',
  shelterKind: 'Вид укриття',
  shelterStatusDate: 'Дата статусу укриття',
  accountingStatusDate: 'Дата статусу обліку',
  recordStatusDate: 'Дата статусу запису',
  isPublished: 'Публікація',
  responsible: 'Відповідальний',
  type: 'Вид укриття',
  accessType: 'Тип доступу',
  capacity: 'Місткість',
  latitude: 'Широта',
  longitude: 'Довгота',
  status: 'Стан укриття',
  accountingStatus: 'Стан обліку',
  recordStatus: 'Стан запису',
  ownerOrgId: 'Власник',
  address: 'Адреса',
  country: 'Країна',
  district: 'Район',
  community: 'Громада',
  settlement: 'Населений пункт',
  settlementType: 'Тип населеного пункту',
  streetType: 'Тип вулиці',
  streetName: 'Назва вулиці',
  building: 'Будівля',
  corpus: 'Корпус',
  apartment: 'Квартира / Офіс',
  postalCode: 'Індекс',
  katottg: 'КАТОТТГ',
  latEntrance: 'Широта входу',
  lonEntrance: 'Довгота входу',
  latCenter: 'Широта центру',
  lonCenter: 'Довгота центру',
  walkRadius: 'Радіус пішохідної доступності',
  relativeLocation: 'Відносне розташування',
  areaDescription: 'Опис місцевості',
  dangerZones: 'Небезпечні зони',
  currentAddress: 'Актуальна адреса',
  currentAddressUpdatedAt: 'Дата оновлення адреси',
  alwaysReady: 'Постійна готовність',
  readinessTime: 'Час приведення у готовність',
  populationCategories: 'Категорії населення',
  area: 'Площа приміщення',
  volume: 'Об’єм приміщення',
  accessibleForDisabled: 'Доступність для маломобільних',
  barrierFreeAccess: 'Безперешкодний доступ',
  shelterClass: 'Клас сховища',
  floorsCount: 'Кількість поверхів',
  entrancesCount: 'Кількість входів',
  emergencyExitsCount: 'Кількість аварійних виходів',
  ownershipForm: 'Форма власності',
  departmentalAffiliation: 'Відомча належність',
  governmentBody: 'Орган державного управління',
  institution: 'Установа',
  balanceHolder: 'Балансоутримувач',
  operationalManagementForm: 'Форма оперативного управління',
  operationStartDate: 'Дата початку експлуатації',
  orgName: 'Назва організації',
  orgEdrpou: 'Код ЄДРПОУ орг.',
  orgAddress: 'Адреса організації',
  orgActivity: 'Вид діяльності орг.',
  contactLastName: 'Прізвище (контакт)',
  contactFirstName: 'Ім’я (контакт)',
  contactMiddleName: 'По батькові (контакт)',
  contactPosition: 'Посада (контакт)',
  contactPhone: 'Телефон',
  contactEmail: 'Email',
  contactIsCurrent: 'Актуальний контакт',
  managerLastName: 'Прізвище (керівник)',
  managerFirstName: 'Ім’я (керівник)',
  managerMiddleName: 'По батькові (керівник)',
  managerPosition: 'Посада (керівник)',
  ownerName: 'Назва власника',
  ownerEdrpou: 'Код ЄДРПОУ власника',
  ownerAddress: 'Адреса власника',
  ownerActivity: 'Вид діяльності власника',
  buildingRegistryNumber: 'Реєстровий номер будівлі',
  buildingInventoryDate: 'Дата техінвентаризації',
  btiName: 'Назва БТІ',
  purposeCode: 'Код призначення',
  purposeName: 'Назва призначення',
  peacetimePurpose: 'Призначення у мирний час',
  designerName: 'Назва проєктувальника',
  designerEdrpou: 'Код ЄДРПОУ проєктувальника',
  designDocLink: 'Посилання на проєктну документацію',
  contractorName: 'Назва підрядника',
  contractorEdrpou: 'Код ЄДРПОУ підрядника',
  isGeneralContractor: 'Генеральний підрядник',
  doorType: 'Вид дверей',
  doorMark: 'Марка дверей',
  doorCount: 'Кількість дверей',
  ventilationSystem: 'Вентиляція',
  fanType: 'Вентилятор / Тип',
  fanCapacity: 'Вентилятор / Продуктивність',
  fanCount: 'Вентилятор / Кількість',
  filterType: 'Фільтри / Тип',
  filterCount: 'Фільтри / Кількість',
  valveType: 'Клапани / Тип',
  valveCapacity: 'Клапани / Продуктивність',
  valveCount: 'Клапани / Кількість',
  antiBlastType: 'Противибухові / Тип',
  antiBlastCount: 'Противибухові / Кількість',
  pumpType: 'Насоси / Тип',
  pumpCapacity: 'Насоси / Продуктивність',
  pumpCount: 'Насоси / Кількість',
  heaterType: 'Калорифери / Тип',
  heaterCapacity: 'Калорифери / Продуктивність',
  heaterCount: 'Калорифери / Кількість',
  coolingType: 'Холодильні машини / Тип',
  coolingCapacity: 'Холодильні машини / Продуктивність',
  coolingCount: 'Холодильні машини / Кількість',
  measuringType: 'Вимірювальні прилади / Тип',
  measuringCount: 'Вимірювальні прилади / Кількість',
  sealingDegree: 'Ступінь герметичності',
  mainPowerSource: 'Джерело електропостачання',
  powerReliabilityCategory: 'Категорія надійності ел.',
  lighting: 'Освітлення',
  backupPower: 'Резервне електропостачання',
  engineeringPower: 'Ел. інженерних систем',
  powerProtection: 'Захист електромереж',
  hasWaterSupply: 'Наявність водопостачання',
  waterSource: 'Джерело водопостачання',
  waterPurpose: 'Призначення води',
  waterReserveLocation: 'Запас води у',
  waterCapacityLiters: 'Ємність запасу води (л)',
  sewageSystemType: 'Тип каналізації',
  sewageSystemKind: 'Вид каналізації',
  heatingClass: 'Клас опалення',
  heatingSubclass: 'Підклас опалення',
  heatingType: 'Тип опалення',
  radioPoint: 'Радіоточка',
  otherPropertyType: 'Інше майно / Тип',
  otherPropertyName: 'Інше майно / Найменування',
  otherPropertyCount: 'Інше майно / Кількість',
  inspectionView: 'Вид огляду',
  inspectionType: 'Тип огляду',
  lastInspectionDate: 'Дата огляду',
  inspectionStatus: 'Статус огляду',
  inspectionResult: 'Результат огляду',
  documentType: 'Вид документу',
  documentSubType: 'Тип документу',
  technicalPassportNumber: 'Номер тех. паспорта',
  documentCreatedAt: 'Дата створення документу',
  documentDate: 'Дата документу',
  documentNumber: 'Номер документу',
  documentOriginalNumber: 'Оригінальний номер',
  relatedObject: 'Пов’язаний об’єкт',
  technicalPassportDate: 'Дата тех. паспорта',
  acceptanceActNumber: 'Номер акта приймання',
  acceptanceActDate: 'Дата акта приймання',
  operationPermitNumber: 'Номер дозволу на експлуатацію',
  operationPermitDate: 'Дата дозволу на експлуатацію',
  insurancePolicyNumber: 'Номер страхового поліса',
  insurancePolicyDate: 'Дата страхового поліса',
  documentNotes: 'Примітки',
  estimatedReadyCost: 'Вартість приведення у готовність',
  constructionModernizationCost: 'Вартість будівництва',
  costValue: 'Вартість (тис. грн.)',
  valuationDate: 'Дата оцінки вартості',
  approved: 'Затверджена',
  totalFines: 'Загальна вартість штрафів',
  fundingSource: 'Джерело фінансування',
  budgetCode: 'Бюджетний код',
  balanceValue: 'Балансова вартість',
  annualMaintenanceCost: 'Щорічні витрати на обслуговування',
  lastValuationDate: 'Дата останньої оцінки',
};

const FIELD_TYPES: Record<string, 'number' | 'boolean'> = {
  capacity: 'number',
  latitude: 'number',
  longitude: 'number',
  area: 'number',
  volume: 'number',
  floorsCount: 'number',
  entrancesCount: 'number',
  emergencyExitsCount: 'number',
  doorCount: 'number',
  fanCapacity: 'number',
  fanCount: 'number',
  filterCount: 'number',
  valveCapacity: 'number',
  valveCount: 'number',
  antiBlastCount: 'number',
  pumpCapacity: 'number',
  pumpCount: 'number',
  heaterCapacity: 'number',
  heaterCount: 'number',
  coolingCapacity: 'number',
  coolingCount: 'number',
  measuringCount: 'number',
  walkRadius: 'number',
  waterCapacityLiters: 'number',
  estimatedReadyCost: 'number',
  constructionModernizationCost: 'number',
  costValue: 'number',
  totalFines: 'number',
  balanceValue: 'number',
  annualMaintenanceCost: 'number',
  otherPropertyCount: 'number',
  latEntrance: 'number',
  lonEntrance: 'number',
  latCenter: 'number',
  lonCenter: 'number',
  isPublished: 'boolean',
  alwaysReady: 'boolean',
  accessibleForDisabled: 'boolean',
  barrierFreeAccess: 'boolean',
  isGeneralContractor: 'boolean',
  contactIsCurrent: 'boolean',
  hasWaterSupply: 'boolean',
  approved: 'boolean',
  radioPoint: 'boolean',
};

const BOOL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'true', label: 'Так' },
  { value: 'false', label: 'Ні' },
];

function renderSectionField(
  key: string,
  formValues: Record<string, string>,
  onChange: (key: string, value: string) => void,
  ownerOrgOptions: OrganizationOption[],
): React.ReactNode {
  const label = FIELD_LABELS[key] ?? key;
  const value = formValues[key] ?? '';

  if (key === 'status') return <Select key={key} label={label} value={value} onChange={(e) => onChange(key, e.target.value)} options={SHELTER_STATUS_OPTIONS} />;
  if (key === 'accountingStatus') return <Select key={key} label={label} value={value} onChange={(e) => onChange(key, e.target.value)} options={ACCOUNTING_STATUS_OPTIONS} />;
  if (key === 'recordStatus') return <Select key={key} label={label} value={value} onChange={(e) => onChange(key, e.target.value)} options={RECORD_STATUS_OPTIONS} />;
  if (key === 'type') return <Select key={key} label={label} value={value} onChange={(e) => onChange(key, e.target.value)} options={SHELTER_TYPE_OPTIONS} />;
  if (key === 'accessType') return <Select key={key} label={label} value={value} onChange={(e) => onChange(key, e.target.value)} options={ACCESS_TYPE_OPTIONS} />;
  if (key === 'ownerOrgId') return (
    <Select
      key={key}
      label={label}
      value={value}
      onChange={(e) => onChange(key, e.target.value)}
      options={ownerOrgOptions.map((o) => ({ value: o.id, label: o.name }))}
      placeholder="Оберіть організацію"
    />
  );

  const fieldType = FIELD_TYPES[key];

  if (fieldType === 'boolean') {
    return <Select key={key} label={label} value={value} onChange={(e) => onChange(key, e.target.value)} options={BOOL_OPTIONS} />;
  }

  if (fieldType === 'number') {
    return (
      <Input
        key={key}
        label={label}
        type="number"
        value={value}
        onChange={(e) => onChange(key, e.target.value)}
      />
    );
  }

  return <Input key={key} label={label} value={value} onChange={(e) => onChange(key, e.target.value)} />;
}

function getSectionAllKeys(tab: SectionEditorTab): string[] {
  if (tab !== 'Основні параметри') return SECTION_EDIT_KEYS[tab];
  const rootSet = new Set<string>(ROOT_EDIT_KEYS);
  return [
    ...ROOT_EDIT_KEYS,
    ...SECTION_EDIT_KEYS[tab].filter((k) => !rootSet.has(k)),
  ];
}

function initSectionFormValues(tab: SectionEditorTab, source: Record<string, unknown>): Record<string, string> {
  const formVals: Record<string, string> = {};
  for (const key of getSectionAllKeys(tab)) {
    const val = source[key];
    formVals[key] = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
  }
  return formVals;
}

function buildSectionDraft(tab: SectionEditorTab, shelter: ShelterDetail | null, data: Record<string, unknown>) {
  const details = pickFields(data, SECTION_EDIT_KEYS[tab]);

  if (tab === 'Медіа' && shelter) {
    return {
      media: ensureRequiredMediaItems(getMediaItems(data), shelter, data),
    };
  }

  if (tab === 'Основні параметри' && shelter) {
    return {
      name: shelter.name,
      type: shelter.type,
      accessType: shelter.accessType,
      capacity: shelter.capacity,
      latitude: shelter.latitude,
      longitude: shelter.longitude,
      status: shelter.status,
      accountingStatus: shelter.accountingStatus,
      recordStatus: shelter.recordStatus,
      ownerOrgId: shelter.ownerOrgId,
      ...details,
    };
  }

  return details;
}

function buildAddressSnapshot(data: Record<string, unknown>): string {
  const address = getText(data, 'address');
  if (address !== '—') {
    return String(address);
  }

  const streetType = data.streetType;
  const streetName = data.streetName;
  const building = data.building;
  const corpus = data.corpus;
  const apartment = data.apartment;

  return [streetType, streetName, building, corpus, apartment]
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join(' ')
    .trim() || '—';
}

function getAddressDirectorySnapshot(data: Record<string, unknown>): string {
  const candidates = [
    data.currentAddress,
    data.directoryAddress,
    data.addressCurrent,
    data.addressFromDirectory,
    data.activeAddress,
  ];

  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && candidate !== '') {
      return String(candidate);
    }
  }

  return '—';
}

function normalizeAddress(value: string | unknown) {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

type MediaItem = {
  id: string;
  name: string;
  dataUrl: string;
  mimeType?: string;
  role: string;
  size?: number;
};

const MEDIA_PALETTES = [
  { sky: '#a7d8f0', wall: '#d8c3a5', wallDark: '#8f7457', accent: '#1f7a8c', door: '#243b53' },
  { sky: '#bcd7ff', wall: '#c9d6c1', wallDark: '#6f8068', accent: '#2563eb', door: '#1f2937' },
  { sky: '#f7d9b8', wall: '#cfd8dc', wallDark: '#697a82', accent: '#b45309', door: '#263238' },
  { sky: '#b7e4d8', wall: '#e0d4bd', wallDark: '#7a6d59', accent: '#0f766e', door: '#334155' },
  { sky: '#d7c4f2', wall: '#d6dde2', wallDark: '#70808d', accent: '#7c3aed', door: '#22223b' },
] as const;

function getMediaItems(data: Record<string, unknown>): MediaItem[] {
  if (!Array.isArray(data.media)) {
    return [];
  }

  return data.media
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : typeof item.name === 'string' ? item.name : crypto.randomUUID(),
      name: typeof item.name === 'string' && item.name ? item.name : 'Фото',
      dataUrl: typeof item.dataUrl === 'string' ? item.dataUrl : '',
      mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
      role: typeof item.role === 'string' ? item.role : 'UNASSIGNED',
      size: typeof item.size === 'number' ? item.size : undefined,
    }))
    .filter((item) => item.dataUrl);
}

function getShelterVariant(shelter: ShelterDetail) {
  let hash = 0;
  for (const char of shelter.id + shelter.name) {
    hash = (hash + char.charCodeAt(0)) % MEDIA_PALETTES.length;
  }
  return hash;
}

function getShelterCity(shelter: ShelterDetail, data: Record<string, unknown>) {
  const candidates = [
    data.settlement,
    data.community,
    data.region,
    buildAddressSnapshot(data).split(',')[0],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() && candidate !== '—') {
      return candidate.trim();
    }
  }

  return shelter.ownerOrg.name;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildShelterImageDataUrl(
  shelter: ShelterDetail,
  data: Record<string, unknown>,
  role: 'FACADE' | 'ENTRANCE',
) {
  const palette = MEDIA_PALETTES[getShelterVariant(shelter)];
  const city = getShelterCity(shelter, data);
  const title = role === 'FACADE' ? 'Фасад укриття' : 'Вхід до укриття';
  const subtitle = role === 'FACADE' ? shelter.name : `Вхід · ${city}`;
  const isMobile = shelter.type === 'MOBILE';
  const scene =
    role === 'FACADE'
      ? `
        <rect x="132" y="218" width="936" height="390" rx="12" fill="${palette.wall}"/>
        <rect x="132" y="218" width="936" height="64" fill="${palette.wallDark}" opacity=".92"/>
        <rect x="185" y="326" width="132" height="98" rx="8" fill="#eef6fb" opacity=".9"/>
        <rect x="382" y="326" width="132" height="98" rx="8" fill="#eef6fb" opacity=".9"/>
        <rect x="579" y="326" width="132" height="98" rx="8" fill="#eef6fb" opacity=".9"/>
        <rect x="776" y="326" width="132" height="98" rx="8" fill="#eef6fb" opacity=".9"/>
        <rect x="520" y="438" width="164" height="170" rx="6" fill="${palette.door}"/>
        <rect x="548" y="466" width="108" height="36" rx="18" fill="${palette.accent}"/>
        <rect x="98" y="608" width="1004" height="76" fill="#667085"/>
      `
      : `
        <rect x="214" y="200" width="772" height="456" rx="18" fill="${isMobile ? '#d9e2ec' : palette.wall}"/>
        <rect x="264" y="252" width="672" height="354" rx="12" fill="${isMobile ? '#cbd5e1' : palette.wallDark}" opacity=".9"/>
        <path d="M416 606V388c0-70 58-126 130-126h108c72 0 130 56 130 126v218Z" fill="${palette.door}"/>
        <rect x="462" y="424" width="278" height="54" rx="27" fill="${palette.accent}"/>
        <circle cx="748" cy="504" r="13" fill="#f8fafc"/>
        <rect x="368" y="606" width="464" height="52" fill="#475569"/>
        <rect x="290" y="658" width="620" height="38" fill="#64748b"/>
      `;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${palette.sky}"/>
          <stop offset="1" stop-color="#f8fafc"/>
        </linearGradient>
        <linearGradient id="shade" x1="0" x2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".18"/>
          <stop offset="1" stop-color="#000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#sky)"/>
      <circle cx="1022" cy="124" r="54" fill="#fff7d6"/>
      <path d="M0 612C154 570 306 590 472 622c178 34 346 28 526-22 86-24 148-33 202-28v228H0Z" fill="#78936a" opacity=".65"/>
      ${scene}
      <rect x="132" y="218" width="936" height="390" fill="url(#shade)" opacity=".28"/>
      <rect x="72" y="64" width="492" height="126" rx="18" fill="#111827" opacity=".78"/>
      <text x="104" y="116" fill="#fff" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700">${escapeSvgText(title)}</text>
      <text x="104" y="158" fill="#d1d5db" font-family="Inter, Arial, sans-serif" font-size="25">${escapeSvgText(subtitle)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createFallbackMediaItem(
  shelter: ShelterDetail,
  data: Record<string, unknown>,
  role: 'FACADE' | 'ENTRANCE',
): MediaItem {
  const dataUrl = buildShelterImageDataUrl(shelter, data, role);

  return {
    id: `${shelter.id}-${role.toLowerCase()}-fallback`,
    name: role === 'FACADE' ? `${shelter.name} — фасад` : `${shelter.name} — вхід`,
    dataUrl,
    mimeType: 'image/svg+xml',
    role,
    size: dataUrl.length,
  };
}

function ensureRequiredMediaItems(
  items: MediaItem[],
  shelter: ShelterDetail | null,
  data: Record<string, unknown>,
) {
  if (!shelter) {
    return items;
  }

  const result = [...items];
  if (!result.some((item) => item.role === 'FACADE')) {
    result.unshift(createFallbackMediaItem(shelter, data, 'FACADE'));
  }
  if (!result.some((item) => item.role === 'ENTRANCE')) {
    const insertIndex = result.some((item) => item.role === 'FACADE') ? 1 : 0;
    result.splice(insertIndex, 0, createFallbackMediaItem(shelter, data, 'ENTRANCE'));
  }

  return result;
}

export default function ShelterDetailClient({ id }: { id: string }) {
  const [shelter, setShelter] = useState<ShelterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabName>('Основні параметри');
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSectionEditing, setIsSectionEditing] = useState(false);
  const [sectionEditingTab, setSectionEditingTab] = useState<SectionEditorTab>('Основні параметри');
  const [sectionDraft, setSectionDraft] = useState('');
  const [sectionSaveError, setSectionSaveError] = useState('');
  const [sectionEditMode, setSectionEditMode] = useState<'form' | 'json'>('form');
  const [sectionFormValues, setSectionFormValues] = useState<Record<string, string>>({});
  const [plannedInspections, setPlannedInspections] = useState<PlannedShelterInspection[]>([]);
  const [scheduleViewMode, setScheduleViewMode] = useState<'calendar' | 'timeline'>('calendar');
  const [controlForm, setControlForm] = useState({ parentInspectionId: '', date: '', correctionDays: '10' });
  const [unplannedForm, setUnplannedForm] = useState({ date: '', reason: UNPLANNED_REASON_OPTIONS[0].value, comment: '', documentName: '' });
  const [plannedChangeForm, setPlannedChangeForm] = useState({ inspectionId: '', date: '' });
  const [inspectionModal, setInspectionModal] = useState<'control' | 'unplanned' | 'planned' | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<PlannedShelterInspection | null>(null);
  const [editForm, setEditForm] = useState<EditShelterForm>({
    name: '',
    type: 'STATIC',
    accessType: 'PUBLIC',
    capacity: '',
    latitude: '',
    longitude: '',
    status: 'NEED',
    accountingStatus: 'NEW',
    recordStatus: 'DRAFT',
    ownerOrgId: '',
  });

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<ShelterDetail>(`/shelters/${id}`);
        setShelter(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити укриття');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<OrganizationOption[]>('/organizations');
        setOrganizations(data);
      } catch {
        setOrganizations([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!shelter) {
      return;
    }

    setEditForm({
      name: shelter.name,
      type: shelter.type,
      accessType: shelter.accessType,
      capacity: String(shelter.capacity),
      latitude: String(shelter.latitude),
      longitude: String(shelter.longitude),
      status: shelter.status,
      accountingStatus: shelter.accountingStatus || 'NEW',
      recordStatus: shelter.recordStatus || 'DRAFT',
      ownerOrgId: shelter.ownerOrgId,
    });
    const initialSchedule = buildInitialShelterSchedule(shelter, shelter.sourceRequest?.data ?? {});
    const firstPlanned = initialSchedule.find((inspection) => inspection.type === 'PLANNED' && inspection.status !== 'CANCELLED');
    setPlannedInspections(initialSchedule);
    setControlForm({
      parentInspectionId: shelter.inspections[0]?.id ?? '',
      date: '',
      correctionDays: '10',
    });
    setUnplannedForm({
      date: addCalendarDays(toDateInputValue(shelter.updatedAt), 7),
      reason: UNPLANNED_REASON_OPTIONS[0].value,
      comment: '',
      documentName: '',
    });
    setPlannedChangeForm({
      inspectionId: firstPlanned?.id ?? '',
      date: firstPlanned?.date ?? '',
    });
  }, [shelter]);

  const data = shelter?.sourceRequest?.data ?? {};
  const historicalAddress = buildAddressSnapshot(data);
  const currentAddress = getAddressDirectorySnapshot(data);
  const hasCurrentAddress = currentAddress !== '—';
  const addressMismatch =
    hasCurrentAddress &&
    historicalAddress !== '—' &&
    normalizeAddress(currentAddress) !== normalizeAddress(historicalAddress);
  const media = useMemo(() => ensureRequiredMediaItems(getMediaItems(data), shelter, data), [data, shelter]);
  const facadePhoto = media.find((item) => item.role === 'FACADE') ?? null;
  const entrancePhoto = media.find((item) => item.role === 'ENTRANCE') ?? null;
  const ownerOrgOptions = useMemo(() => {
    if (!shelter) {
      return organizations;
    }

    if (organizations.some((organization) => organization.id === shelter.ownerOrgId)) {
      return organizations;
    }

    return [
      { id: shelter.ownerOrgId, name: `${shelter.ownerOrg.name} (поточний)` },
      ...organizations,
    ];
  }, [organizations, shelter]);
  const plannedForChange = useMemo(
    () => plannedInspections.filter((inspection) => inspection.type === 'PLANNED' && inspection.status !== 'CANCELLED'),
    [plannedInspections]
  );
  const selectedParentInspection = shelter?.inspections.find((inspection) => inspection.id === controlForm.parentInspectionId);
  const calculatedControlDate = controlForm.date || addBusinessDays(
    toDateInputValue(selectedParentInspection?.createdAt ?? shelter?.updatedAt),
    Number(controlForm.correctionDays) || 0
  );
  const scheduledMonths = useMemo(() => {
    const map = new Map<string, PlannedShelterInspection[]>();
    for (const inspection of plannedInspections) {
      const month = inspection.date.slice(0, 7);
      map.set(month, [...(map.get(month) ?? []), inspection]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [plannedInspections]);
  const inspectionCounts = useMemo(() => {
    const active = plannedInspections.filter((i) => i.status !== 'CANCELLED');
    return {
      PLANNED: active.filter((i) => i.type === 'PLANNED').length,
      UNPLANNED: active.filter((i) => i.type === 'UNPLANNED').length,
      CONTROL: active.filter((i) => i.type === 'CONTROL').length,
    };
  }, [plannedInspections]);

  function openScheduleTab(parentInspectionId?: string) {
    setActiveTab('Заходи');
    if (parentInspectionId) {
      setControlForm((current) => ({ ...current, parentInspectionId }));
    }
  }

  function planControlInspection() {
    if (!shelter || !controlForm.parentInspectionId || !calculatedControlDate) return;
    setPlannedInspections((current) => [
      ...current,
      {
        id: `control-${Date.now()}`,
        type: 'CONTROL',
        date: calculatedControlDate,
        status: 'PLANNED',
        parentInspectionId: controlForm.parentInspectionId,
        comment: `Контрольне обстеження після ${Number(controlForm.correctionDays) || 0} робочих днів на виправлення зауважень.`,
      },
    ]);
  }

  function planUnplannedInspection() {
    if (!unplannedForm.date || !unplannedForm.reason) return;
    const reasonLabel = UNPLANNED_REASON_OPTIONS.find((option) => option.value === unplannedForm.reason)?.label ?? 'Інша підстава';
    setPlannedInspections((current) => [
      ...current,
      {
        id: `unplanned-${Date.now()}`,
        type: 'UNPLANNED',
        date: unplannedForm.date,
        status: 'PLANNED',
        reason: reasonLabel,
        comment: unplannedForm.comment,
        documentName: unplannedForm.documentName,
      },
    ]);
    setUnplannedForm((current) => ({ ...current, comment: '', documentName: '' }));
  }

  function changePlannedInspectionDate() {
    if (!plannedChangeForm.inspectionId || !plannedChangeForm.date) return;
    setPlannedInspections((current) =>
      current.map((inspection) =>
        inspection.id === plannedChangeForm.inspectionId
          ? { ...inspection, date: plannedChangeForm.date, status: 'PLANNED', comment: 'Дата планового обстеження змінена.' }
          : inspection
      )
    );
  }

  function cancelPlannedInspection() {
    if (!plannedChangeForm.inspectionId) return;
    setPlannedInspections((current) =>
      current.map((inspection) =>
        inspection.id === plannedChangeForm.inspectionId
          ? { ...inspection, status: 'CANCELLED', comment: 'Планове обстеження відмінено.' }
          : inspection
      )
    );
  }

  function setPlannedChangeTarget(inspectionId: string) {
    const inspection = plannedInspections.find((item) => item.id === inspectionId);
    setPlannedChangeForm({ inspectionId, date: inspection?.date ?? '' });
  }

  const tabCounts = useMemo(
    () => ({
      'Основні параметри': countPresentValues([
        shelter?.id,
        getText(data, 'accountNumber'),
        getText(data, 'tempNumber'),
        getText(data, 'technicalNumber'),
        getText(data, 'registrationDate'),
        getText(data, 'name'),
        getText(data, 'region'),
        getText(data, 'shelterKind') || shelter?.type,
        shelter?.status || getText(data, 'shelterStatus'),
        getText(data, 'shelterStatusDate'),
        shelter?.accountingStatus || getText(data, 'accountingStatus'),
        getText(data, 'accountingStatusDate'),
        shelter?.recordStatus || getText(data, 'recordStatus'),
        getText(data, 'recordStatusDate'),
        getText(data, 'isPublished'),
        shelter?.createdAt,
        shelter?.sourceRequest?.createdBy.email,
        getText(data, 'responsible'),
        shelter?.updatedAt,
      ]),
      'Розташування та доступність': countPresentValues([
        historicalAddress,
        currentAddress,
        getText(data, 'currentAddressUpdatedAt'),
        getText(data, 'country'),
        getText(data, 'region'),
        getText(data, 'district'),
        getText(data, 'community'),
        getText(data, 'settlement'),
        getText(data, 'settlementType'),
        getText(data, 'streetType'),
        getText(data, 'streetName'),
        getText(data, 'building'),
        getText(data, 'corpus'),
        getText(data, 'apartment'),
        getText(data, 'postalCode'),
        getText(data, 'katottg'),
        getText(data, 'latEntrance'),
        getText(data, 'lonEntrance'),
        getText(data, 'latCenter') || shelter?.latitude,
        getText(data, 'lonCenter') || shelter?.longitude,
        getText(data, 'walkRadius'),
        getText(data, 'relativeLocation'),
        getText(data, 'areaDescription'),
        getText(data, 'dangerZones'),
        formatCoordinates(shelter?.latitude, shelter?.longitude),
      ]),
      'Характеристики укриття': countPresentValues([
        getText(data, 'alwaysReady'),
        getText(data, 'readinessTime'),
        getText(data, 'populationCategories'),
        getText(data, 'area'),
        getText(data, 'volume'),
        getText(data, 'capacity') || shelter?.capacity,
        getText(data, 'accessibleForDisabled'),
        getText(data, 'barrierFreeAccess'),
        getText(data, 'shelterClass'),
        getText(data, 'floorsCount'),
        getText(data, 'entrancesCount'),
        getText(data, 'emergencyExitsCount'),
      ]),
      'Власність та відповідальні': countPresentValues([
        getText(data, 'ownershipForm'),
        getText(data, 'departmentalAffiliation'),
        getText(data, 'governmentBody'),
        getText(data, 'institution'),
        getText(data, 'balanceHolder'),
        getText(data, 'operationalManagementForm'),
        getText(data, 'operationStartDate'),
        getText(data, 'orgName'),
        getText(data, 'orgEdrpou'),
        getText(data, 'orgAddress'),
        getText(data, 'orgActivity'),
        getText(data, 'contactLastName'),
        getText(data, 'contactFirstName'),
        getText(data, 'contactMiddleName'),
        getText(data, 'contactPosition'),
        getText(data, 'contactPhone'),
        getText(data, 'contactEmail'),
        getText(data, 'contactIsCurrent'),
        getText(data, 'managerLastName'),
        getText(data, 'managerFirstName'),
        getText(data, 'managerMiddleName'),
        getText(data, 'managerPosition'),
        getText(data, 'ownerName'),
        getText(data, 'ownerEdrpou'),
        getText(data, 'ownerAddress'),
        getText(data, 'ownerActivity'),
      ]),
      'Технічна інвентаризація': countPresentValues([
        getText(data, 'buildingRegistryNumber'),
        getText(data, 'buildingInventoryDate'),
        getText(data, 'btiName'),
        getText(data, 'purposeCode'),
        getText(data, 'purposeName'),
        getText(data, 'peacetimePurpose'),
        getText(data, 'designerName'),
        getText(data, 'designerEdrpou'),
        getText(data, 'designDocLink'),
        getText(data, 'contractorName'),
        getText(data, 'contractorEdrpou'),
        getText(data, 'isGeneralContractor'),
        getText(data, 'doorType'),
        getText(data, 'doorMark'),
        getText(data, 'doorCount'),
        getText(data, 'ventilationSystem'),
        getText(data, 'fanType'),
        getText(data, 'fanCapacity'),
        getText(data, 'fanCount'),
        getText(data, 'filterType'),
        getText(data, 'filterCount'),
        getText(data, 'valveType'),
        getText(data, 'valveCapacity'),
        getText(data, 'valveCount'),
        getText(data, 'antiBlastType'),
        getText(data, 'antiBlastCount'),
        getText(data, 'pumpType'),
        getText(data, 'pumpCapacity'),
        getText(data, 'pumpCount'),
        getText(data, 'heaterType'),
        getText(data, 'heaterCapacity'),
        getText(data, 'heaterCount'),
        getText(data, 'coolingType'),
        getText(data, 'coolingCapacity'),
        getText(data, 'coolingCount'),
        getText(data, 'measuringType'),
        getText(data, 'measuringCount'),
        getText(data, 'sealingDegree'),
        getText(data, 'mainPowerSource'),
        getText(data, 'powerReliabilityCategory'),
        getText(data, 'lighting'),
        getText(data, 'backupPower'),
        getText(data, 'engineeringPower'),
        getText(data, 'powerProtection'),
        getText(data, 'hasWaterSupply'),
        getText(data, 'waterSource'),
        getText(data, 'waterPurpose'),
        getText(data, 'waterReserveLocation'),
        getText(data, 'waterCapacityLiters'),
        getText(data, 'sewageSystemType'),
        getText(data, 'sewageSystemKind'),
        getText(data, 'heatingClass'),
        getText(data, 'heatingSubclass'),
        getText(data, 'heatingType'),
        getText(data, 'radioPoint'),
        getText(data, 'otherPropertyType'),
        getText(data, 'otherPropertyName'),
        getText(data, 'otherPropertyCount'),
      ]),
      Огляди: shelter?.inspections?.length ?? 0,
      Заходи: plannedInspections.length,
      'Медіа': media.length,
      Документи: countPresentValues([
        getText(data, 'documentType'),
        getText(data, 'documentSubType'),
        getText(data, 'technicalPassportNumber') || getText(data, 'documentName'),
        getText(data, 'documentCreatedAt'),
        getText(data, 'documentDate'),
        getText(data, 'documentNumber'),
        getText(data, 'documentOriginalNumber'),
        getText(data, 'relatedObject') || shelter?.id,
        getText(data, 'technicalPassportNumber'),
        getText(data, 'technicalPassportDate'),
        getText(data, 'acceptanceActNumber'),
        getText(data, 'acceptanceActDate'),
        getText(data, 'operationPermitNumber'),
        getText(data, 'operationPermitDate'),
        getText(data, 'insurancePolicyNumber'),
        getText(data, 'insurancePolicyDate'),
        getText(data, 'documentNotes'),
      ]),
      Фінанси: countPresentValues([
        getText(data, 'estimatedReadyCost'),
        getText(data, 'constructionModernizationCost'),
        getText(data, 'costValue'),
        getText(data, 'valuationDate'),
        getText(data, 'approved'),
        getText(data, 'totalFines'),
        getText(data, 'fundingSource'),
        getText(data, 'budgetCode'),
        getText(data, 'balanceValue'),
        getText(data, 'annualMaintenanceCost'),
        getText(data, 'lastValuationDate'),
      ]),
    }),
    [data, shelter, media, historicalAddress, currentAddress, plannedInspections]
  );

  function openSectionEditor(tab: SectionEditorTab) {
    const draft = buildSectionDraft(tab, shelter, data);
    setSectionEditingTab(tab);
    setSectionSaveError('');
    setSectionDraft(JSON.stringify(draft, null, 2));
    setSectionFormValues(initSectionFormValues(tab, draft));
    setSectionEditMode('form');
    setIsSectionEditing(true);
  }

  function cancelSectionEditor() {
    setSectionSaveError('');
    setIsSectionEditing(false);
  }

  function switchSectionEditMode(mode: 'form' | 'json') {
    if (mode === sectionEditMode) return;

    if (mode === 'json') {
      const obj: Record<string, unknown> = {};
      for (const key of Object.keys(sectionFormValues)) {
        const raw = sectionFormValues[key];
        if (raw === undefined || raw === '') continue;
        const ft = FIELD_TYPES[key];
        if (ft === 'number') {
          const n = Number(raw);
          obj[key] = Number.isNaN(n) ? raw : n;
        } else if (ft === 'boolean') {
          obj[key] = raw === 'true';
        } else {
          obj[key] = raw;
        }
      }
      setSectionDraft(JSON.stringify(obj, null, 2));
    } else {
      try {
        const parsed = JSON.parse(sectionDraft) as Record<string, unknown>;
        setSectionFormValues(initSectionFormValues(sectionEditingTab, parsed));
      } catch {
        setSectionSaveError('Неможливо переключитися — JSON містить синтаксичні помилки');
        return;
      }
    }

    setSectionEditMode(mode);
  }

  async function saveSectionEditor() {
    if (!shelter) {
      return;
    }

    setSaving(true);
    setSectionSaveError('');

    try {
      let parsed: Record<string, unknown>;

      if (sectionEditMode === 'json') {
        parsed = JSON.parse(sectionDraft) as Record<string, unknown>;
      } else {
        parsed = {};
        for (const key of Object.keys(sectionFormValues)) {
          const raw = sectionFormValues[key];
          if (raw === undefined || raw === '') continue;
          const ft = FIELD_TYPES[key];
          if (ft === 'number') {
            const n = Number(raw);
            parsed[key] = Number.isNaN(n) ? raw : n;
          } else if (ft === 'boolean') {
            parsed[key] = raw === 'true';
          } else {
            parsed[key] = raw;
          }
        }
      }

      const details = omitFields(parsed, ROOT_EDIT_KEYS);
      const payload: Record<string, unknown> = { details };

      for (const key of ROOT_EDIT_KEYS) {
        if (parsed[key] !== undefined) {
          payload[key] = parsed[key];
        }
      }

      const updated = await apiFetch<ShelterDetail>(`/shelters/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setShelter(updated);
      setIsSectionEditing(false);
    } catch (updateError) {
      const message =
        updateError instanceof SyntaxError
          ? 'JSON у розділі має бути валідним'
          : updateError instanceof Error
            ? updateError.message
            : 'Не вдалося зберегти зміни';
      setSectionSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  function openEditMode() {
    if (!shelter) {
      return;
    }

    setSaveError('');
    setEditForm({
      name: shelter.name,
      type: shelter.type,
      accessType: shelter.accessType,
      capacity: String(shelter.capacity),
      latitude: String(shelter.latitude),
      longitude: String(shelter.longitude),
      status: shelter.status,
      accountingStatus: shelter.accountingStatus,
      recordStatus: shelter.recordStatus,
      ownerOrgId: shelter.ownerOrgId,
    });
    setIsEditing(true);
  }

  function cancelEditMode() {
    if (shelter) {
      setEditForm({
        name: shelter.name,
        type: shelter.type,
        accessType: shelter.accessType,
        capacity: String(shelter.capacity),
        latitude: String(shelter.latitude),
        longitude: String(shelter.longitude),
        status: shelter.status,
        accountingStatus: shelter.accountingStatus || 'NEW',
        recordStatus: shelter.recordStatus || 'DRAFT',
        ownerOrgId: shelter.ownerOrgId,
      });
    }

    setSaveError('');
    setIsEditing(false);
  }

  async function saveShelterChanges() {
    if (!shelter) {
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        type: editForm.type,
        accessType: editForm.accessType,
        capacity: Number(editForm.capacity),
        latitude: Number(editForm.latitude),
        longitude: Number(editForm.longitude),
        status: editForm.status,
        accountingStatus: editForm.accountingStatus,
        recordStatus: editForm.recordStatus,
        ownerOrgId: editForm.ownerOrgId,
      };

      const updated = await apiFetch<ShelterDetail>(`/shelters/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setShelter(updated);
      setIsEditing(false);
    } catch (updateError) {
      setSaveError(updateError instanceof Error ? updateError.message : 'Не вдалося зберегти зміни');
    } finally {
      setSaving(false);
    }
  }

  const tabs: Record<TabName, ReactNode> = {
      'Основні параметри': (
        <div className="grid gap-6">
          <SectionCard
            title="Основні параметри"
            description="Ключові реквізити запису та службові поля"
            fields={[
              { label: 'ID', value: shelter?.id },
              { label: 'Обліковий номер', value: getText(data, 'accountNumber') },
              { label: 'Тимчасовий номер', value: getText(data, 'tempNumber') },
              { label: 'Технічний номер', value: getText(data, 'technicalNumber') },
              { label: 'Дата реєстрації', value: getText(data, 'registrationDate') },
              { label: 'Назва об’єкта', value: getText(data, 'name') || shelter?.name },
              { label: 'Регіон', value: getText(data, 'region') },
              { label: 'Вид укриття', value: getText(data, 'shelterKind') || shelter?.type },
              { label: 'Стан укриття', value: shelter?.status || getText(data, 'shelterStatus') },
              { label: 'Дата статусу укриття', value: getText(data, 'shelterStatusDate') },
              { label: 'Стан обліку', value: shelter?.accountingStatus || getText(data, 'accountingStatus') },
              { label: 'Дата статусу обліку', value: getText(data, 'accountingStatusDate') },
              { label: 'Стан запису', value: shelter?.recordStatus || getText(data, 'recordStatus') },
              { label: 'Дата статусу запису', value: getText(data, 'recordStatusDate') },
              { label: 'Публікація', value: getText(data, 'isPublished') },
              { label: 'Дата створення', value: formatDate(shelter?.createdAt) },
              { label: 'Створив', value: shelter?.sourceRequest?.createdBy.email },
              { label: 'Відповідальний', value: getText(data, 'responsible') },
              { label: 'Дата редагування', value: formatDate(shelter?.updatedAt) },
            ]}
          />
        </div>
      ),
      'Розташування та доступність': (
        <div className="grid gap-6">
          <Alert severity="warning">
            Адреса зберігається як історична фіксація з документів. Актуальну адресу з довідника краще показувати окремо і не перезаписувати історію.
          </Alert>

          <SectionCard
            title="Адреса"
            description="Зафіксована адреса на момент внесення"
            fields={[
              { label: 'Адреса', value: historicalAddress },
              { label: 'Країна', value: getText(data, 'country') },
              { label: 'Область / Регіон', value: getText(data, 'region') },
              { label: 'Район', value: getText(data, 'district') },
              { label: 'Громада', value: getText(data, 'community') },
              { label: 'Населений пункт', value: getText(data, 'settlement') },
              { label: 'Тип населеного пункту', value: getText(data, 'settlementType') },
              { label: 'Тип вулиці', value: getText(data, 'streetType') },
              { label: 'Назва вулиці', value: getText(data, 'streetName') },
              { label: 'Будівля', value: getText(data, 'building') },
              { label: 'Корпус', value: getText(data, 'corpus') },
              { label: 'Квартира / Офіс', value: getText(data, 'apartment') },
              { label: 'Індекс', value: getText(data, 'postalCode') },
              { label: 'КАТОТТГ', value: getText(data, 'katottg') },
            ]}
          />

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <SectionLabel>
                  Актуальна адреса
                </SectionLabel>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  Адреса з довідника, якщо він уже підключений
                </p>
              </div>
              <Badge
                severity={addressMismatch ? 'warning' : hasCurrentAddress ? 'ok' : 'neutral'}
                dot
              >
                {addressMismatch
                  ? 'Не збігається з історичною'
                  : hasCurrentAddress
                    ? 'Збігається'
                    : 'Довідник не підключено'}
              </Badge>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Історична адреса" value={historicalAddress} />
              <Field
                label="Актуальна адреса"
                value={hasCurrentAddress ? currentAddress : 'Очікує довідника адрес'}
              />
              <Field label="Дата оновлення довідника" value={getText(data, 'currentAddressUpdatedAt')} />
              <Field label="Стан синхронізації" value={addressMismatch ? 'Потрібне підтвердження' : hasCurrentAddress ? 'Актуальна' : 'Не синхронізовано'} />
            </div>
          </div>

          <SectionCard
            title="Геолокація"
            description="Координати та просторові орієнтири"
            fields={[
              { label: 'Широта вхід', value: getText(data, 'latEntrance') },
              { label: 'Довгота вхід', value: getText(data, 'lonEntrance') },
              { label: 'Широта центр', value: getText(data, 'latCenter') || shelter?.latitude },
              { label: 'Довгота центр', value: getText(data, 'lonCenter') || shelter?.longitude },
              { label: 'Радіус пішохідної доступності', value: getText(data, 'walkRadius') },
              { label: 'Відносне розташування', value: getText(data, 'relativeLocation') },
              { label: 'Опис місцевості', value: getText(data, 'areaDescription') },
              { label: 'Небезпечні зони', value: getText(data, 'dangerZones') },
              { label: 'Фактичні координати запису', value: formatCoordinates(shelter?.latitude, shelter?.longitude) },
            ]}
          />
        </div>
      ),
      'Характеристики укриття': (
        <div className="grid gap-6">
          <SectionCard
            title="Характеристики"
            description="Параметри укриття та доступність"
            fields={[
              { label: 'Постійна готовність', value: getText(data, 'alwaysReady') },
              { label: 'Час приведення у готовність', value: getText(data, 'readinessTime') },
              { label: 'Категорії населення', value: getText(data, 'populationCategories') },
              { label: 'Площа приміщення', value: getText(data, 'area') },
              { label: 'Об’єм приміщення', value: getText(data, 'volume') },
              { label: 'Місткість', value: getText(data, 'capacity') || shelter?.capacity },
              { label: 'Доступність для маломобільних груп', value: getText(data, 'accessibleForDisabled') },
              { label: 'Безперешкодний доступ', value: getText(data, 'barrierFreeAccess') },
              { label: 'Клас сховища', value: getText(data, 'shelterClass') },
              { label: 'Кількість поверхів', value: getText(data, 'floorsCount') },
              { label: 'Кількість входів', value: getText(data, 'entrancesCount') },
              { label: 'Кількість аварійних виходів', value: getText(data, 'emergencyExitsCount') },
            ]}
          />
        </div>
      ),
      'Власність та відповідальні': (
        <div className="grid gap-6">
          <SectionCard
            title="Власність"
            description="Форма власності, балансоутримувач та пов’язані організації"
            fields={[
              { label: 'Форма власності', value: getText(data, 'ownershipForm') },
              { label: 'Відомча належність', value: getText(data, 'departmentalAffiliation') },
              { label: 'Орган державного управління', value: getText(data, 'governmentBody') },
              { label: 'Установа', value: getText(data, 'institution') },
              { label: 'Балансоутримувач', value: getText(data, 'balanceHolder') },
              { label: 'Форма оперативного управління', value: getText(data, 'operationalManagementForm') },
              { label: 'Дата початку експлуатації', value: getText(data, 'operationStartDate') },
            ]}
          />

          <SectionCard
            title="Організація"
            description="Дані організації балансоутримувача"
            fields={[
              { label: 'Назва', value: getText(data, 'orgName') },
              { label: 'Код ЄДРПОУ', value: getText(data, 'orgEdrpou') },
              { label: 'Адреса', value: getText(data, 'orgAddress') },
              { label: 'Основний вид діяльності', value: getText(data, 'orgActivity') },
            ]}
          />

          <SectionCard
            title="Контактна особа"
            description="Основний службовий контакт"
            fields={[
              { label: 'Прізвище', value: getText(data, 'contactLastName') },
              { label: 'Ім’я', value: getText(data, 'contactFirstName') },
              { label: 'По батькові', value: getText(data, 'contactMiddleName') },
              { label: 'Посада', value: getText(data, 'contactPosition') },
              { label: 'Телефон', value: getText(data, 'contactPhone') },
              { label: 'Email', value: getText(data, 'contactEmail') },
              { label: 'Актуальний', value: getText(data, 'contactIsCurrent') },
            ]}
          />

          <SectionCard
            title="Керівник"
            description="Керівник організації"
            fields={[
              { label: 'Прізвище', value: getText(data, 'managerLastName') },
              { label: 'Ім’я', value: getText(data, 'managerFirstName') },
              { label: 'По батькові', value: getText(data, 'managerMiddleName') },
              { label: 'Посада', value: getText(data, 'managerPosition') },
            ]}
          />

          <SectionCard
            title="Власник"
            description="Власник будівлі або споруди"
            fields={[
              { label: 'Назва', value: getText(data, 'ownerName') },
              { label: 'Код ЄДРПОУ', value: getText(data, 'ownerEdrpou') },
              { label: 'Адреса', value: getText(data, 'ownerAddress') },
              { label: 'Основний вид діяльності', value: getText(data, 'ownerActivity') },
            ]}
          />
        </div>
      ),
      'Технічна інвентаризація': (
        <div className="grid gap-6">
          <SectionCard
            title="Будівля"
            description="Технічна інвентаризація та призначення"
            fields={[
              { label: 'Будівля', value: getText(data, 'buildingRegistryNumber') },
              { label: 'Реєстровий номер', value: getText(data, 'buildingRegistryNumber') },
              { label: 'Дата технічної інвентаризації', value: getText(data, 'buildingInventoryDate') },
              { label: 'Назва БТІ', value: getText(data, 'btiName') },
              { label: 'Код призначення', value: getText(data, 'purposeCode') },
              { label: 'Назва призначення', value: getText(data, 'purposeName') },
              { label: 'Призначення укриття у мирний час', value: getText(data, 'peacetimePurpose') },
            ]}
          />

          <SectionCard
            title="Автор проєкту"
            description="Проєктна документація"
            fields={[
              { label: 'Назва', value: getText(data, 'designerName') },
              { label: 'Код ЄДРПОУ', value: getText(data, 'designerEdrpou') },
              { label: 'Посилання на проєктну документацію', value: getText(data, 'designDocLink') },
            ]}
          />

          <SectionCard
            title="Підрядник"
            description="Підрядна організація"
            fields={[
              { label: 'Назва', value: getText(data, 'contractorName') },
              { label: 'Код ЄДРПОУ', value: getText(data, 'contractorEdrpou') },
              { label: 'Ознака генерального підрядника', value: getText(data, 'isGeneralContractor') },
            ]}
          />

          <SectionCard
            title="Двері та ставні"
            fields={[
              { label: 'Вид дверей / ставней', value: getText(data, 'doorType') },
              { label: 'Марка / Шифр', value: getText(data, 'doorMark') },
              { label: 'Кількість', value: getText(data, 'doorCount') },
            ]}
          />

          <SectionCard
            title="Технологічні системи"
            description="Інженерне оснащення укриття"
            fields={[
              { label: 'Вентиляція', value: getText(data, 'ventilationSystem') },
              { label: 'Вентилятор / Тип', value: getText(data, 'fanType') },
              { label: 'Вентилятор / Продуктивність', value: getText(data, 'fanCapacity') },
              { label: 'Вентилятор / Кількість', value: getText(data, 'fanCount') },
              { label: 'Фільтри і засоби регенерації / Тип', value: getText(data, 'filterType') },
              { label: 'Фільтри і засоби регенерації / Кількість', value: getText(data, 'filterCount') },
              { label: 'Герметичні клапани / Тип', value: getText(data, 'valveType') },
              { label: 'Герметичні клапани / Продуктивність', value: getText(data, 'valveCapacity') },
              { label: 'Герметичні клапани / Кількість', value: getText(data, 'valveCount') },
              { label: 'Противибухові пристрої / Тип', value: getText(data, 'antiBlastType') },
              { label: 'Противибухові пристрої / Кількість', value: getText(data, 'antiBlastCount') },
              { label: 'Насоси / Тип', value: getText(data, 'pumpType') },
              { label: 'Насоси / Продуктивність', value: getText(data, 'pumpCapacity') },
              { label: 'Насоси / Кількість', value: getText(data, 'pumpCount') },
              { label: 'Калорифери або повітроохолоджувачі / Тип', value: getText(data, 'heaterType') },
              { label: 'Калорифери або повітроохолоджувачі / Продуктивність', value: getText(data, 'heaterCapacity') },
              { label: 'Калорифери або повітроохолоджувачі / Кількість', value: getText(data, 'heaterCount') },
              { label: 'Холодильні машини / Тип', value: getText(data, 'coolingType') },
              { label: 'Холодильні машини / Продуктивність', value: getText(data, 'coolingCapacity') },
              { label: 'Холодильні машини / Кількість', value: getText(data, 'coolingCount') },
              { label: 'Вимірювальні прилади / Тип', value: getText(data, 'measuringType') },
              { label: 'Вимірювальні прилади / Кількість', value: getText(data, 'measuringCount') },
              { label: 'Ступінь герметичності', value: getText(data, 'sealingDegree') },
            ]}
          />

          <SectionCard
            title="Електроживлення"
            fields={[
              { label: 'Джерело основного електропостачання', value: getText(data, 'mainPowerSource') },
              { label: 'Категорія надійності електропостачання', value: getText(data, 'powerReliabilityCategory') },
              { label: 'Освітлення', value: getText(data, 'lighting') },
              { label: 'Резервне / аварійне електропостачання', value: getText(data, 'backupPower') },
              { label: 'Електроживлення інженерних систем', value: getText(data, 'engineeringPower') },
              { label: 'Захист електромереж', value: getText(data, 'powerProtection') },
            ]}
          />

          <SectionCard
            title="Водопостачання"
            fields={[
              { label: 'Наявність системи водопостачання', value: getText(data, 'hasWaterSupply') },
              { label: 'Джерело водопостачання', value: getText(data, 'waterSource') },
              { label: 'Призначення води', value: getText(data, 'waterPurpose') },
              { label: 'Запас води у', value: getText(data, 'waterReserveLocation') },
              { label: 'Ємність запасу води, літрів', value: getText(data, 'waterCapacityLiters') },
            ]}
          />

          <SectionCard
            title="Каналізація"
            fields={[
              { label: 'Тип системи каналізації', value: getText(data, 'sewageSystemType') },
              { label: 'Вид системи каналізації', value: getText(data, 'sewageSystemKind') },
            ]}
          />

          <SectionCard
            title="Опалення"
            fields={[
              { label: 'Клас', value: getText(data, 'heatingClass') },
              { label: 'Підклас', value: getText(data, 'heatingSubclass') },
              { label: 'Тип', value: getText(data, 'heatingType') },
            ]}
          />

          <SectionCard
            title="Засоби зв’язку"
            fields={[
              { label: 'Радіоточка', value: getText(data, 'radioPoint') },
              { label: 'Інше майно / Тип', value: getText(data, 'otherPropertyType') },
              { label: 'Інше майно / Найменування', value: getText(data, 'otherPropertyName') },
              { label: 'Інше майно / Кількість', value: getText(data, 'otherPropertyCount') },
            ]}
          />
        </div>
      ),
      Огляди: (
        <div className="grid gap-6">
          <SectionCard
            title="Поля огляду"
            description="Параметри, що можуть бути виведені у списку"
            fields={[
              { label: 'Вид огляду', value: getText(data, 'inspectionView') },
              { label: 'Тип огляду', value: getText(data, 'inspectionType') },
              { label: 'Дата огляду', value: getText(data, 'lastInspectionDate') },
              { label: 'Статус', value: getText(data, 'inspectionStatus') || getText(data, 'inspectionResult') },
            ]}
          />

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="Список оглядів" description="Окремі записи реєстру" />
              <Button type="button" variant="secondary" size="md" iconLeft={<CalendarDays />} onClick={() => openScheduleTab()}>
                Планування обстежень
              </Button>
            </div>
            {shelter?.inspections?.length ? (
              <div className="space-y-3">
                {shelter.inspections.map((inspection) => (
                  <div
                    key={inspection.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">{inspection.result}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{inspection.createdByUser.email}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-[var(--text-secondary)]">{formatDate(inspection.createdAt)}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          iconLeft={<Clock />}
                          onClick={() => { setControlForm((current) => ({ ...current, parentInspectionId: inspection.id })); setInspectionModal('control'); }}
                        >
                          Контрольне
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Оглядів ще немає"
                message="Після перевірок вони з’являться тут. Позапланове обстеження можна створити у вкладці Заходи."
                action={
                  <Button type="button" variant="secondary" size="md" iconLeft={<CalendarDays />} onClick={() => openScheduleTab()}>
                    Перейти до планування
                  </Button>
                }
              />
            )}
          </div>
        </div>
      ),
      Заходи: (
        <div className="grid gap-6">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="Календар обстежень" description="Візуальний інструмент планування для всіх видів обстежень" />
              <div className="flex rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] p-0.5">
                {(['calendar', 'timeline'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScheduleViewMode(mode)}
                    className={[
                      'h-7 rounded-[calc(var(--radius-md)-2px)] px-3 text-[11px] font-medium transition-colors',
                      scheduleViewMode === mode ? 'bg-[var(--accent-10)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                    ].join(' ')}
                  >
                    {mode === 'calendar' ? 'Календар' : 'Таймлайн'}
                  </button>
                ))}
              </div>
            </div>

            {scheduleViewMode === 'calendar' ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {scheduledMonths.map(([month, inspections]) => (
                  <div key={month} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
                    <p className="mb-3 text-[12px] font-semibold text-[var(--text-primary)]">
                      {new Date(`${month}-01`).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}
                    </p>
                    <div className="space-y-2">
                      {inspections
                        .slice()
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((inspection) => {
                          const status = effectivePlannedInspectionStatus(inspection);
                          return (
                            <button
                              key={inspection.id}
                              type="button"
                              onClick={() => setSelectedInspection(inspection)}
                              className="w-full text-left rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--hover)] px-3 py-2 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover-md)]"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[12px] font-semibold text-[var(--text-primary)]">{formatDay(inspection.date)}</span>
                                <Badge severity={plannedInspectionStatusSeverity(status)} dot>
                                  {plannedInspectionStatusLabel(status)}
                                </Badge>
                              </div>
                              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{plannedInspectionTypeLabel(inspection.type)}</p>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {plannedInspections
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((inspection) => {
                    const status = effectivePlannedInspectionStatus(inspection);
                    return (
                      <button key={inspection.id} type="button" onClick={() => setSelectedInspection(inspection)} className="w-full text-left grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 md:grid-cols-[140px_1fr_auto] md:items-center transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)]">
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{formatDay(inspection.date)}</p>
                          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{plannedInspectionTypeLabel(inspection.type)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] text-[var(--text-secondary)]">
                            {inspection.reason || inspection.comment || 'Заплановане обстеження укриття'}
                          </p>
                          {inspection.documentName ? (
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                              <FileText className="h-3.5 w-3.5" />
                              {inspection.documentName}
                            </p>
                          ) : null}
                        </div>
                        <Badge severity={plannedInspectionStatusSeverity(status)} dot>
                          {plannedInspectionStatusLabel(status)}
                        </Badge>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ),
      'Медіа': (
        <div className="grid gap-6">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <SectionLabel>Медіа</SectionLabel>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  Фото з заявки. Окремо виділено фото фасаду та фото входу.
                </p>
              </div>
              <Badge severity={media.length > 0 ? 'ok' : 'neutral'} dot>
                {media.length > 0 ? `${media.length} фото` : 'Фото не додані'}
              </Badge>
            </div>
          </div>

          {media.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <MediaSpotlight title="Фото фасаду" item={facadePhoto} emptyLabel="Фасад не позначено" />
                <MediaSpotlight title="Фото входу" item={entrancePhoto} emptyLabel="Вхід не позначено" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {media.map((item) => (
                  <MediaCard key={item.id} item={item} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="Медіа не додані"
              message="У формі створення можна завантажити фото та позначити їх ролі."
            />
          )}
        </div>
      ),
      Документи: (
        <div className="grid gap-6">
          <SectionCard
            title="Документи"
            description="Поля для реєстру документів"
            fields={[
              { label: 'Вид документу', value: getText(data, 'documentType') },
              { label: 'Тип документу', value: getText(data, 'documentSubType') },
              { label: 'Назва документу', value: getText(data, 'technicalPassportNumber') || getText(data, 'documentName') },
              { label: 'Дата створення', value: getText(data, 'documentCreatedAt') },
              { label: 'Дата документу', value: getText(data, 'documentDate') },
              { label: 'Номер документу', value: getText(data, 'documentNumber') },
              { label: 'Оригінальний номер документу', value: getText(data, 'documentOriginalNumber') },
              { label: 'Пов’язаний об’єкт', value: getText(data, 'relatedObject') || shelter?.id },
            ]}
          />

          <SectionCard
            title="Технічний паспорт"
            fields={[
              { label: 'Номер технічного паспорта', value: getText(data, 'technicalPassportNumber') },
              { label: 'Дата технічного паспорта', value: getText(data, 'technicalPassportDate') },
              { label: 'Номер акта приймання', value: getText(data, 'acceptanceActNumber') },
              { label: 'Дата акта приймання', value: getText(data, 'acceptanceActDate') },
              { label: 'Номер дозволу на експлуатацію', value: getText(data, 'operationPermitNumber') },
              { label: 'Дата дозволу на експлуатацію', value: getText(data, 'operationPermitDate') },
              { label: 'Номер страхового поліса', value: getText(data, 'insurancePolicyNumber') },
              { label: 'Дата страхового поліса', value: getText(data, 'insurancePolicyDate') },
              { label: 'Примітки', value: getText(data, 'documentNotes') },
            ]}
          />
        </div>
      ),
      Фінанси: (
        <div className="grid gap-6">
          <SectionCard
            title="Фінанси"
            description="Вартість, оцінка та джерела фінансування"
            fields={[
              { label: 'Вартість приведення у готовність, тис. грн.', value: getText(data, 'estimatedReadyCost') },
              { label: 'Вартість будівництва / модернізації', value: getText(data, 'constructionModernizationCost') },
              { label: 'Вартість, тис. грн.', value: getText(data, 'costValue') },
              { label: 'Дата оцінки вартості', value: getText(data, 'valuationDate') },
              { label: 'Затверджена', value: getText(data, 'approved') },
              { label: 'Загальна вартість штрафів', value: getText(data, 'totalFines') },
              { label: 'Джерело фінансування', value: getText(data, 'fundingSource') },
              { label: 'Бюджетний код', value: getText(data, 'budgetCode') },
              { label: 'Вартість приведення у готовність', value: getText(data, 'balanceValue') },
              { label: 'Щорічні витрати на обслуговування', value: getText(data, 'annualMaintenanceCost') },
              { label: 'Дата останньої оцінки вартості', value: getText(data, 'lastValuationDate') },
            ]}
          />
        </div>
      ),
  };

  return (
    <AppShell>
      <PageHeader
        title="Деталі укриття"
        subtitle={`Список укриттів / ${id.slice(0, 8)}`}
        actions={
          <>
            <Link href="/shelters">
              <Button variant="outline" size="md" iconLeft={<ArrowLeft />}>
                До списку
              </Button>
            </Link>
            <DropdownButton
              label="Запланувати обстеження"
              iconLeft={<CalendarDays />}
              variant="secondary"
              size="md"
              align="right"
              actions={[
                { label: 'Планове', icon: <CalendarDays />, badge: inspectionCounts.PLANNED || undefined, onClick: () => setInspectionModal('planned') },
                { label: 'Позапланове', icon: <Zap />, badge: inspectionCounts.UNPLANNED || undefined, onClick: () => setInspectionModal('unplanned') },
                { label: 'Контрольне', icon: <ClipboardCheck />, badge: inspectionCounts.CONTROL || undefined, onClick: () => setInspectionModal('control') },
              ]}
            />
            <Link href="/inspections/shelter-list">
              <Button type="button" variant="outline" size="md" iconLeft={<ClipboardCheck />}>
                Список обстежень
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          {error ? (
            <Alert severity="danger">{error}</Alert>
          ) : null}

          {loading && !shelter ? (
            <Card>
              <EmptyState icon={<Shield />} title="Завантаження..." message="Отримуємо повну інформацію про укриття" />
            </Card>
          ) : null}

          {!loading && !error && shelter ? (
            <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-6">
                <TabBar active={activeTab} onChange={setActiveTab} counts={tabCounts} />
              </div>

              <div className="space-y-6">
                <Card className="overflow-hidden" padding="none">
                  <div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,var(--accent-07),rgba(17,19,24,0))] p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <ShelterTypeBadge type={shelter.type} />
                          <ShelterStatusBadge status={shelter.status} />
                          <Badge severity="neutral" dot>
                            {shelter.accessType === 'PUBLIC' ? 'Відкритий доступ' : 'Обмежений доступ'}
                          </Badge>
                        </div>
                        <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">
                          {shelter.name}
                        </h2>
                        <button
                          type="button"
                          onClick={async () => { await navigator.clipboard.writeText(shelter.id); }}
                          className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group"
                          title="Скопіювати ID"
                        >
                          <span>ID: {shelter.id}</span>
                          <Copy className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link href="/coverage-map">
                          <Button variant="primary" size="md" iconLeft={<MapPinned />}>
                            Відкрити мапу
                          </Button>
                        </Link>
                        <DropdownButton
                          label="Запланувати обстеження"
                          iconLeft={<CalendarDays />}
                          variant="secondary"
                          size="md"
                          align="right"
                          actions={[
                            { label: 'Планове', icon: <CalendarDays />, badge: inspectionCounts.PLANNED || undefined, onClick: () => setInspectionModal('planned') },
                            { label: 'Позапланове', icon: <Zap />, badge: inspectionCounts.UNPLANNED || undefined, onClick: () => setInspectionModal('unplanned') },
                            { label: 'Контрольне', icon: <ClipboardCheck />, badge: inspectionCounts.CONTROL || undefined, onClick: () => setInspectionModal('control') },
                          ]}
                        />
                        <Link href="/inspections/shelter-list">
                          <Button type="button" variant="outline" size="md" iconLeft={<ClipboardCheck />}>
                            Список обстежень
                          </Button>
                        </Link>
                        <Button variant="secondary" size="md" iconLeft={<Edit2 />} onClick={openEditMode}>
                          Редагувати
                        </Button>
                      </div>
                    </div>
                  </div>

                  <ShelterCardMedia facadePhoto={facadePhoto} entrancePhoto={entrancePhoto} />

                  <div className="grid gap-4 p-6 lg:grid-cols-4">
                    <MetricCard icon={<Users />} label="Місткість" value={`${shelter.capacity} осіб`} />
                    <MetricCard icon={<ShieldCheck />} label="Стан укриття" value={shelter.status} />
                    <MetricCard icon={<MapPinned />} label="Координати" value={formatCoordinates(shelter.latitude, shelter.longitude)} />
                    <MetricCard icon={<CalendarDays />} label="Оновлено" value={formatDate(shelter.updatedAt)} />
                  </div>
                </Card>

                {isEditing ? (
                  <Card className="overflow-hidden" padding="none">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--hover)] px-6 py-4">
                      <div>
                        <SectionLabel>
                          Редагування укриття
                        </SectionLabel>
                        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                          Змінюються лише поточні поля укриття. Історія з заявки лишається незмінною.
                        </p>
                      </div>
                      <Badge severity="info" dot>
                        Режим редагування
                      </Badge>
                    </div>

                    {saveError ? (
                      <div className="mx-6 mt-6">
                        <Alert severity="danger">{saveError}</Alert>
                      </div>
                    ) : null}

                    <div className="grid gap-4 p-6 md:grid-cols-2">
                      <Input
                        label="Назва"
                        value={editForm.name}
                        onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                      />
                      <Select
                        label="Вид укриття"
                        value={editForm.type}
                        onChange={(event) => setEditForm((current) => ({ ...current, type: event.target.value }))}
                        options={SHELTER_TYPE_OPTIONS}
                      />
                      <Select
                        label="Стан укриття"
                        value={editForm.status}
                        onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                        options={SHELTER_STATUS_OPTIONS}
                      />
                      <Select
                        label="Стан обліку"
                        value={editForm.accountingStatus}
                        onChange={(event) => setEditForm((current) => ({ ...current, accountingStatus: event.target.value }))}
                        options={ACCOUNTING_STATUS_OPTIONS}
                      />
                      <Select
                        label="Стан запису"
                        value={editForm.recordStatus}
                        onChange={(event) => setEditForm((current) => ({ ...current, recordStatus: event.target.value }))}
                        options={RECORD_STATUS_OPTIONS}
                      />
                      <Select
                        label="Тип доступу"
                        value={editForm.accessType}
                        onChange={(event) => setEditForm((current) => ({ ...current, accessType: event.target.value }))}
                        options={ACCESS_TYPE_OPTIONS}
                      />
                      <Input
                        label="Місткість"
                        type="number"
                        min={1}
                        value={editForm.capacity}
                        onChange={(event) => setEditForm((current) => ({ ...current, capacity: event.target.value }))}
                      />
                      <Input
                        label="Широта"
                        type="number"
                        step="any"
                        value={editForm.latitude}
                        onChange={(event) => setEditForm((current) => ({ ...current, latitude: event.target.value }))}
                      />
                      <Input
                        label="Довгота"
                        type="number"
                        step="any"
                        value={editForm.longitude}
                        onChange={(event) => setEditForm((current) => ({ ...current, longitude: event.target.value }))}
                      />
                      <Select
                        label="Власник"
                        value={editForm.ownerOrgId}
                        onChange={(event) => setEditForm((current) => ({ ...current, ownerOrgId: event.target.value }))}
                        options={ownerOrgOptions.map((org) => ({ value: org.id, label: org.name }))}
                        placeholder={ownerOrgOptions.length ? 'Оберіть організацію' : 'Список організацій недоступний'}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--hover)] px-6 py-4">
                      <Button variant="outline" size="md" iconLeft={<X />} onClick={cancelEditMode} type="button">
                        Скасувати
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        iconLeft={<Check />}
                        loading={saving}
                        onClick={() => void saveShelterChanges()}
                        type="button"
                      >
                        Зберегти
                      </Button>
                    </div>
                  </Card>
                ) : null}

                {isSectionEditing ? (
                  <Card className="overflow-hidden" padding="none">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--hover)] px-6 py-4">
                      <div>
                        <SectionLabel>
                          Редагування розділу
                        </SectionLabel>
                        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{sectionEditingTab}</p>
                      </div>
                      <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] p-0.5">
                        <button
                          type="button"
                          onClick={() => switchSectionEditMode('form')}
                          className={[
                            'h-7 px-3 text-[11px] font-medium rounded-[calc(var(--radius-md)-2px)] transition-colors duration-100',
                            sectionEditMode === 'form'
                              ? 'bg-[var(--accent-10)] text-[var(--accent)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                          ].join(' ')}
                        >
                          Форма
                        </button>
                        <button
                          type="button"
                          onClick={() => switchSectionEditMode('json')}
                          className={[
                            'h-7 px-3 text-[11px] font-medium font-mono rounded-[calc(var(--radius-md)-2px)] transition-colors duration-100',
                            sectionEditMode === 'json'
                              ? 'bg-[var(--accent-10)] text-[var(--accent)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                          ].join(' ')}
                        >
                          JSON
                        </button>
                      </div>
                    </div>

                    {sectionSaveError ? (
                      <div className="mx-6 mt-6">
                        <Alert severity="danger">{sectionSaveError}</Alert>
                      </div>
                    ) : null}

                    {sectionEditMode === 'form' ? (
                      <div className="p-6">
                        {sectionEditingTab === 'Медіа' ? (
                          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] px-4 py-8 text-center text-[12px] text-[var(--text-muted)]">
                            Редагування медіа у режимі форми недоступне. Перейдіть до режиму JSON.
                          </div>
                        ) : (
                          <div className="grid gap-4 md:grid-cols-2">
                            {getSectionAllKeys(sectionEditingTab).map((key) =>
                              renderSectionField(
                                key,
                                sectionFormValues,
                                (k, v) => setSectionFormValues((prev) => ({ ...prev, [k]: v })),
                                ownerOrgOptions,
                              )
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6">
                        <Textarea
                          label="Дані розділу"
                          value={sectionDraft}
                          onChange={(event) => setSectionDraft(event.target.value)}
                          className="min-h-[320px] font-mono text-[12px]"
                          hint="Редагуй JSON тільки для поточного розділу. Рядкові значення, числа, масиви та булеві поля збережуться як є."
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--hover)] px-6 py-4">
                      <Button variant="outline" size="md" iconLeft={<X />} onClick={cancelSectionEditor} type="button">
                        Скасувати
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        iconLeft={<Check />}
                        loading={saving}
                        onClick={() => void saveSectionEditor()}
                        type="button"
                      >
                        Зберегти розділ
                      </Button>
                    </div>
                  </Card>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionLabel>
                      Поточний розділ
                    </SectionLabel>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      Натисни, щоб редагувати дані саме цієї вкладки.
                    </p>
                  </div>
                  <Button variant="secondary" size="md" iconLeft={<Edit2 />} onClick={() => openSectionEditor(activeTab)}>
                    Редагувати розділ
                  </Button>
                </div>

                <Card padding="lg">{tabs[activeTab]}</Card>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {/* ── Модальне вікно: Деталі обстеження ── */}
      {selectedInspection && (() => {
        const status = effectivePlannedInspectionStatus(selectedInspection);
        return (
          <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
            <button type="button" aria-label="Закрити" className="absolute inset-0 cursor-default" onClick={() => setSelectedInspection(null)} />
            <div role="dialog" aria-modal="true" className="relative z-[6001] w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_40px_140px_rgba(0,0,0,0.72)]">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
                <div>
                  <SectionLabel>{plannedInspectionTypeLabel(selectedInspection.type)}</SectionLabel>
                  <h3 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">{shelter?.name}</h3>
                </div>
                <button type="button" onClick={() => setSelectedInspection(null)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-3">
                    <SectionLabel>Дата</SectionLabel>
                    <p className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">{formatDay(selectedInspection.date)}</p>
                  </div>
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-3">
                    <SectionLabel>Статус</SectionLabel>
                    <div className="mt-1.5">
                      <Badge severity={plannedInspectionStatusSeverity(status)} dot>{plannedInspectionStatusLabel(status)}</Badge>
                    </div>
                  </div>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-3">
                  <SectionLabel>Вид обстеження</SectionLabel>
                  <p className="mt-1 text-[13px] text-[var(--text-primary)]">{plannedInspectionTypeLabel(selectedInspection.type)}</p>
                </div>
                {selectedInspection.reason && (
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-3">
                    <SectionLabel>Підстава</SectionLabel>
                    <p className="mt-1 text-[13px] text-[var(--text-primary)]">{selectedInspection.reason}</p>
                  </div>
                )}
                {selectedInspection.comment && (
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-3">
                    <SectionLabel>Коментар</SectionLabel>
                    <p className="mt-1 text-[13px] text-[var(--text-primary)]">{selectedInspection.comment}</p>
                  </div>
                )}
                {selectedInspection.documentName && (
                  <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-3">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    <div>
                      <SectionLabel>Документ</SectionLabel>
                      <p className="mt-0.5 text-[13px] text-[var(--text-primary)]">{selectedInspection.documentName}</p>
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-1">
                  <Button type="button" variant="outline" size="md" onClick={() => setSelectedInspection(null)}>Закрити</Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Модальне вікно: Контрольне обстеження ── */}
      {inspectionModal === 'control' && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
          <button type="button" aria-label="Закрити" className="absolute inset-0 cursor-default" onClick={() => setInspectionModal(null)} />
          <div role="dialog" aria-modal="true" className="relative z-[6001] w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_40px_140px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <SectionLabel>Контрольне обстеження</SectionLabel>
                <h3 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">За результатами планового огляду</h3>
              </div>
              <button type="button" onClick={() => setInspectionModal(null)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-5">
              <Select
                label="Батьківське планове обстеження"
                value={controlForm.parentInspectionId}
                onChange={(event) => setControlForm((current) => ({ ...current, parentInspectionId: event.target.value }))}
                options={[
                  { value: '', label: 'Оберіть огляд' },
                  ...(shelter?.inspections ?? []).map((inspection) => ({
                    value: inspection.id,
                    label: `${formatDay(inspection.createdAt)} · ${inspection.result}`,
                  })),
                ]}
              />
              <Input
                label="Дата контрольного обстеження"
                type="date"
                value={controlForm.date}
                onChange={(event) => setControlForm((current) => ({ ...current, date: event.target.value }))}
              />
              <Input
                label="Період для виправлення, робочих днів"
                type="number"
                min={0}
                value={controlForm.correctionDays}
                onChange={(event) => setControlForm((current) => ({ ...current, correctionDays: event.target.value, date: '' }))}
              />
              <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Розрахункова дата</p>
                <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{formatDay(calculatedControlDate)}</p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="md" onClick={() => setInspectionModal(null)}>Скасувати</Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  iconLeft={<CalendarDays />}
                  onClick={() => { planControlInspection(); setInspectionModal(null); }}
                  disabled={!controlForm.parentInspectionId || !calculatedControlDate}
                >
                  Запланувати обстеження
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Модальне вікно: Позапланове обстеження ── */}
      {inspectionModal === 'unplanned' && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
          <button type="button" aria-label="Закрити" className="absolute inset-0 cursor-default" onClick={() => setInspectionModal(null)} />
          <div role="dialog" aria-modal="true" className="relative z-[6001] w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_40px_140px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <SectionLabel>Позапланове обстеження</SectionLabel>
                <h3 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">На підставі інформації про події щодо укриття</h3>
              </div>
              <button type="button" onClick={() => setInspectionModal(null)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-5">
              <Input label="Об'єкт укриття" value={shelter?.name ?? ''} readOnly />
              <Select label="Вид обстеження" value="UNPLANNED" disabled options={[{ value: 'UNPLANNED', label: 'Позапланове' }]} />
              <Input
                label="Дата обстеження"
                type="date"
                value={unplannedForm.date}
                onChange={(event) => setUnplannedForm((current) => ({ ...current, date: event.target.value }))}
              />
              <Select
                label="Підстава обстеження"
                value={unplannedForm.reason}
                onChange={(event) => setUnplannedForm((current) => ({ ...current, reason: event.target.value }))}
                options={UNPLANNED_REASON_OPTIONS}
              />
              <Textarea
                label="Коментар"
                value={unplannedForm.comment}
                onChange={(event) => setUnplannedForm((current) => ({ ...current, comment: event.target.value }))}
                rows={3}
              />
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">Документ, опціонально</span>
                <span className="flex min-h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 text-[12px] text-[var(--text-secondary)]">
                  <Upload className="h-3.5 w-3.5" />
                  {unplannedForm.documentName || 'Файл не вибрано'}
                </span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => setUnplannedForm((current) => ({ ...current, documentName: event.target.files?.[0]?.name ?? '' }))}
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="md" onClick={() => setInspectionModal(null)}>Скасувати</Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  iconLeft={<CalendarDays />}
                  onClick={() => { planUnplannedInspection(); setInspectionModal(null); }}
                  disabled={!unplannedForm.date || !unplannedForm.reason}
                >
                  Запланувати обстеження
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Модальне вікно: Планове обстеження ── */}
      {inspectionModal === 'planned' && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
          <button type="button" aria-label="Закрити" className="absolute inset-0 cursor-default" onClick={() => setInspectionModal(null)} />
          <div role="dialog" aria-modal="true" className="relative z-[6001] w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_40px_140px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <SectionLabel>Планове обстеження</SectionLabel>
                <h3 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">Зміна дати або відміна раніше призначеного плану</h3>
              </div>
              <button type="button" onClick={() => setInspectionModal(null)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-5">
              <Select
                label="Раніше призначене планове обстеження"
                value={plannedChangeForm.inspectionId}
                onChange={(event) => setPlannedChangeTarget(event.target.value)}
                options={[
                  { value: '', label: 'Оберіть планове обстеження' },
                  ...plannedForChange.map((inspection) => ({
                    value: inspection.id,
                    label: `${formatDay(inspection.date)} · ${plannedInspectionStatusLabel(effectivePlannedInspectionStatus(inspection))}`,
                  })),
                ]}
              />
              <Input
                label="Нова дата планового обстеження"
                type="date"
                value={plannedChangeForm.date}
                onChange={(event) => setPlannedChangeForm((current) => ({ ...current, date: event.target.value }))}
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="md" onClick={() => setInspectionModal(null)}>Скасувати</Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  iconLeft={<X />}
                  onClick={() => { cancelPlannedInspection(); setInspectionModal(null); }}
                  disabled={!plannedChangeForm.inspectionId}
                >
                  Відмінити план
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  iconLeft={<Check />}
                  onClick={() => { changePlannedInspectionDate(); setInspectionModal(null); }}
                  disabled={!plannedChangeForm.inspectionId || !plannedChangeForm.date}
                >
                  Змінити дату
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ShelterCardMedia({
  facadePhoto,
  entrancePhoto,
}: {
  facadePhoto: MediaItem | null;
  entrancePhoto: MediaItem | null;
}) {
  return (
    <div className="grid gap-4 border-b border-[var(--border)] p-6 md:grid-cols-2">
      <ShelterCardMediaTile label="Фасад" item={facadePhoto} />
      <ShelterCardMediaTile label="Вхід" item={entrancePhoto} />
    </div>
  );
}

function ShelterCardMediaTile({ label, item }: { label: string; item: MediaItem | null }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
      {item ? (
        <div className="relative">
          <img src={item.dataUrl} alt={item.name} className="h-56 w-full object-cover" />
          <div className="absolute left-3 top-3">
            <Badge severity="ok" dot>
              {label}
            </Badge>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-12">
            <p className="truncate text-[12px] font-medium text-white">{item.name}</p>
          </div>
        </div>
      ) : (
        <div className="flex h-56 items-center justify-center bg-[var(--hover)]">
          <p className="text-[12px] text-[var(--text-muted)]">{label} не додано</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-4">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <span className="text-[var(--accent)] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <p className="text-[10px] uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="mt-2 break-words text-[15px] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function MediaSpotlight({
  title,
  item,
  emptyLabel,
}: {
  title: string;
  item: MediaItem | null;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{title}</p>
        <Badge severity={item ? 'ok' : 'neutral'} dot>
          {item ? mediaRoleLabel(item.role) : 'Не призначено'}
        </Badge>
      </div>

      {item ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/20">
          <img src={item.dataUrl} alt={item.name} className="h-56 w-full object-cover" />
          <div className="border-t border-[var(--border)] p-3">
            <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">{item.name}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{item.mimeType ?? 'image'} · {formatFileSize(item.size)}</p>
          </div>
        </div>
      ) : (
        <EmptyState title={emptyLabel} />
      )}
    </div>
  );
}

function MediaCard({ item }: { item: MediaItem }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="relative">
        <img src={item.dataUrl} alt={item.name} className="h-52 w-full object-cover" />
        <div className="absolute left-3 top-3">
          <Badge severity={item.role === 'UNASSIGNED' ? 'neutral' : 'ok'} dot>
            {mediaRoleLabel(item.role)}
          </Badge>
        </div>
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">{item.name}</p>
        <p className="text-[11px] text-[var(--text-muted)]">{item.mimeType ?? 'image'} · {formatFileSize(item.size)}</p>
      </div>
    </div>
  );
}

function mediaRoleLabel(role: string) {
  if (role === 'FACADE') return 'Фото фасаду';
  if (role === 'ENTRANCE') return 'Фото входу';
  return 'Не призначено';
}

function formatFileSize(size?: number) {
  if (!size) {
    return '—';
  }

  const mb = size / 1024 / 1024;
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }

  const kb = size / 1024;
  return `${kb.toFixed(0)} KB`;
}
