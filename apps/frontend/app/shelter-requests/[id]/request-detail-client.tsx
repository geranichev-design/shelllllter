'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getStoredAuth } from '@/lib/auth';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, SectionLabel, Select, Textarea } from '@repo/ui';
import { AppShell } from '@/app/components/AppShell';
import { FileX } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type ShelterRequestDetail = {
  id: string;
  status: 'NEW' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  data: Record<string, unknown>;
  createdBy: { id: string; email: string; role: string };
  reviewedBy: { id: string; email: string; role: string } | null;
};

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = [
  'Основні параметри',
  'Розташування',
  'Характеристики',
  'Власність',
  'Інвентаризація',
  'Огляд',
  'Документи',
  'Фінанси',
  'Медіа',
] as const;

type TabName = (typeof TABS)[number];

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'Нова' },
  { value: 'APPROVED', label: 'Схвалена' },
  { value: 'REJECTED', label: 'Відхилена' },
] as const;

type MediaItem = {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  size: number;
  role: 'UNASSIGNED' | 'FACADE' | 'ENTRANCE';
};

// ── Field display helper ────────────────────────────────────────────────────────

function fieldDisplayValue(value: unknown) {
  return value === null || value === undefined || value === ''
    ? '—'
    : typeof value === 'boolean'
      ? value
        ? 'Так'
        : 'Ні'
      : String(value);
}

function Field({ label, value }: { label: string; value: unknown }) {
  const display = fieldDisplayValue(value);

  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-[13px] text-[var(--text-primary)] mt-0.5 break-words">{display}</p>
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

function hasAnyValue(fields: unknown[]): boolean {
  return fields.some(
    (f) => f !== null && f !== undefined && f !== '' && f !== false
  );
}

// ── Tab content components ─────────────────────────────────────────────────────

function Tab1({
  data,
  meta,
}: {
  data: Record<string, unknown>;
  meta: { id: string; createdAt: string; createdByEmail: string; reviewedAt: string | null };
}) {
  const fields = [
    data.accountNumber, data.tempNumber, data.technicalNumber,
    data.registrationDate, data.name, data.region, data.shelterKind,
    data.shelterStatus, data.accountingStatus, data.recordStatus,
    data.responsible,
  ];
  if (!hasAnyValue(fields)) {
    return <EmptyState title="Дані не заповнені" />;
  }
  return (
    <div className="grid gap-6">
      {/* Системні поля */}
      <div>
        <SectionLabel className="mb-3">Системна інформація</SectionLabel>
        <FieldGrid>
          <Field label="ID" value={meta.id} />
          <Field label="Дата створення" value={new Date(meta.createdAt).toLocaleString('uk-UA')} />
          <Field label="Створив" value={meta.createdByEmail} />
          <Field label="Дата редагування" value={meta.reviewedAt ? new Date(meta.reviewedAt).toLocaleString('uk-UA') : '—'} />
        </FieldGrid>
      </div>

      <div className="border-t border-[var(--border)]" />

      {/* Основні поля */}
      <FieldGrid>
        <Field label="Обліковий номер" value={data.accountNumber} />
        <Field label="Тимчасовий номер" value={data.tempNumber} />
        <Field label="Технічний номер" value={data.technicalNumber} />
        <Field label="Дата реєстрації" value={data.registrationDate} />
        <Field label="Назва об'єкта" value={data.name} />
        <Field label="Регіон" value={data.region} />
        <Field label="Вид укриття" value={data.shelterKind} />
        <Field label="Статус укриття" value={data.shelterStatus} />
        <Field label="Дата статусу укриття" value={data.shelterStatusDate} />
        <Field label="Статус обліку" value={data.accountingStatus} />
        <Field label="Дата статусу обліку" value={data.accountingStatusDate} />
        <Field label="Статус запису" value={data.recordStatus} />
        <Field label="Дата статусу запису" value={data.recordStatusDate} />
        <Field label="Публікація" value={data.isPublished} />
        <Field label="Відповідальний" value={data.responsible} />
      </FieldGrid>
    </div>
  );
}

function Tab2({ data }: { data: Record<string, unknown> }) {
  const fields = [data.country, data.region, data.district, data.community, data.settlement, data.streetName, data.building, data.katottg, data.latCenter, data.lonCenter];
  if (!hasAnyValue(fields)) {
    return <EmptyState title="Дані не заповнені" />;
  }
  return (
    <div className="grid gap-6">
      <div>
        <SectionLabel className="mb-3">Адміністративна одиниця</SectionLabel>
        <FieldGrid>
          <Field label="Країна" value={data.country} />
          <Field label="Область / Регіон" value={data.region} />
          <Field label="Район" value={data.district} />
          <Field label="Громада" value={data.community} />
          <Field label="Населений пункт" value={data.settlement} />
          <Field label="Тип населеного пункту" value={data.settlementType} />
        </FieldGrid>
      </div>
      <div className="border-t border-[var(--border)]" />
      <div>
        <SectionLabel className="mb-3">Вулиця та будинок</SectionLabel>
        <FieldGrid>
          <Field label="Тип вулиці" value={data.streetType} />
          <Field label="Назва вулиці" value={data.streetName} />
          <Field label="Будівля" value={data.building} />
          <Field label="Корпус" value={data.corpus} />
          <Field label="Квартира / Офіс" value={data.apartment} />
          <Field label="Індекс" value={data.postalCode} />
          <Field label="КАТОТТГ" value={data.katottg} />
        </FieldGrid>
      </div>
      <div className="border-t border-[var(--border)]" />
      <div>
        <SectionLabel className="mb-3">Геолокація</SectionLabel>
        <FieldGrid>
          <Field label="Широта вхід" value={data.latEntrance} />
          <Field label="Довгота вхід" value={data.lonEntrance} />
          <Field label="Широта центр" value={data.latCenter} />
          <Field label="Довгота центр" value={data.lonCenter} />
          <Field label="Радіус пішохідної доступності, м" value={data.walkRadius} />
        </FieldGrid>
      </div>
      <div className="border-t border-[var(--border)]" />
      <div>
        <SectionLabel className="mb-3">Опис розташування</SectionLabel>
        <div className="grid gap-4">
          <Field label="Відносне розташування" value={data.relativeLocation} />
          <Field label="Опис місцевості" value={data.areaDescription} />
          <Field label="Небезпечні зони" value={data.dangerZones} />
        </div>
      </div>
    </div>
  );
}

function Tab3({ data }: { data: Record<string, unknown> }) {
  const fields = [data.area, data.volume, data.capacity, data.shelterClass, data.readinessTime, data.floorsCount];
  if (!hasAnyValue(fields)) {
    return <EmptyState title="Дані не заповнені" />;
  }
  return (
    <div className="grid gap-6">
      <FieldGrid>
        <Field label="Площа приміщення, м²" value={data.area} />
        <Field label="Об'єм приміщення, м³" value={data.volume} />
        <Field label="Місткість, осіб" value={data.capacity} />
        <Field label="Клас сховища" value={data.shelterClass} />
        <Field label="Час приведення у готовність, хв" value={data.readinessTime} />
        <Field label="Кількість поверхів" value={data.floorsCount} />
        <Field label="Кількість входів" value={data.entrancesCount} />
        <Field label="Кількість аварійних виходів" value={data.emergencyExitsCount} />
      </FieldGrid>
      <div className="border-t border-[var(--border)]" />
      <Field label="Категорії населення" value={data.populationCategories} />
      <div className="grid gap-3">
        <Field label="Постійна готовність" value={data.alwaysReady} />
        <Field label="Доступність для маломобільних груп" value={data.accessibleForDisabled} />
        <Field label="Безперешкодний доступ" value={data.barrierFreeAccess} />
      </div>
    </div>
  );
}

function Tab4({ data }: { data: Record<string, unknown> }) {
  const fields = [data.ownershipForm, data.balanceHolder, data.orgName, data.ownerName, data.contactLastName, data.managerLastName];
  if (!hasAnyValue(fields)) {
    return <EmptyState title="Дані не заповнені" />;
  }
  return (
    <div className="grid gap-6">
      <div>
        <SectionLabel className="mb-3">Загальна інформація</SectionLabel>
        <FieldGrid>
          <Field label="Форма власності" value={data.ownershipForm} />
          <Field label="Відомча належність" value={data.departmentalAffiliation} />
          <Field label="Орган державного управління" value={data.governmentBody} />
          <Field label="Установа" value={data.institution} />
          <Field label="Балансоутримувач" value={data.balanceHolder} />
          <Field label="Форма оперативного управління" value={data.operationalManagementForm} />
          <Field label="Дата початку експлуатації" value={data.operationStartDate} />
        </FieldGrid>
      </div>
      <div className="border-t border-[var(--border)]" />
      <div>
        <SectionLabel className="mb-3">Організація (балансоутримувач)</SectionLabel>
        <FieldGrid>
          <Field label="Назва" value={data.orgName} />
          <Field label="Код ЄДРПОУ" value={data.orgEdrpou} />
          <Field label="Адреса" value={data.orgAddress} />
          <Field label="Основний вид діяльності" value={data.orgActivity} />
        </FieldGrid>
      </div>
      <div className="border-t border-[var(--border)]" />
      <div>
        <SectionLabel className="mb-3">Контактна особа</SectionLabel>
        <FieldGrid>
          <Field label="Прізвище" value={data.contactLastName} />
          <Field label="Ім'я" value={data.contactFirstName} />
          <Field label="По батькові" value={data.contactMiddleName} />
          <Field label="Посада" value={data.contactPosition} />
          <Field label="Телефон" value={data.contactPhone} />
          <Field label="Email" value={data.contactEmail} />
          <Field label="Актуальний" value={data.contactIsCurrent} />
        </FieldGrid>
      </div>
      <div className="border-t border-[var(--border)]" />
      <div>
        <SectionLabel className="mb-3">Керівник</SectionLabel>
        <FieldGrid>
          <Field label="Прізвище" value={data.managerLastName} />
          <Field label="Ім'я" value={data.managerFirstName} />
          <Field label="По батькові" value={data.managerMiddleName} />
          <Field label="Посада" value={data.managerPosition} />
        </FieldGrid>
      </div>
      <div className="border-t border-[var(--border)]" />
      <div>
        <SectionLabel className="mb-3">Власник</SectionLabel>
        <FieldGrid>
          <Field label="Назва" value={data.ownerName} />
          <Field label="Код ЄДРПОУ" value={data.ownerEdrpou} />
          <Field label="Адреса" value={data.ownerAddress} />
          <Field label="Основний вид діяльності" value={data.ownerActivity} />
        </FieldGrid>
      </div>
    </div>
  );
}

function Tab5({ data }: { data: Record<string, unknown> }) {
  const boolFields = [
    data.hasElectricity,
    data.hasWater,
    data.hasSewerage,
    data.hasEmergencyLighting,
    data.hasMedicalEquipment,
    data.hasCommunicationEquipment,
    data.hasGenerator,
    data.hasFVA,
  ];
  const numFields = [data.foodSupplyDays, data.waterSupplyLiters];
  if (!hasAnyValue([...boolFields, ...numFields])) {
    return <EmptyState title="Дані не заповнені" />;
  }
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-3">Оснащення</p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Електропостачання" value={data.hasElectricity} />
          <Field label="Водопостачання" value={data.hasWater} />
          <Field label="Каналізація" value={data.hasSewerage} />
          <Field label="Аварійне освітлення" value={data.hasEmergencyLighting} />
          <Field label="Медичне обладнання" value={data.hasMedicalEquipment} />
          <Field label="Засоби зв'язку" value={data.hasCommunicationEquipment} />
          <Field label="Генератор" value={data.hasGenerator} />
          <Field label="Фільтровентиляційне обладнання (FVA)" value={data.hasFVA} />
        </div>
      </div>
      <FieldGrid>
        <Field label="Запаси продовольства, діб" value={data.foodSupplyDays} />
        <Field label="Запаси питної води, л" value={data.waterSupplyLiters} />
      </FieldGrid>
    </div>
  );
}

function Tab6({ data }: { data: Record<string, unknown> }) {
  const fields = [
    data.lastInspectionDate,
    data.inspector,
    data.inspectionResult,
    data.nextInspectionDate,
    data.violations,
    data.inspectorComments,
  ];
  if (!hasAnyValue(fields)) {
    return <EmptyState title="Дані не заповнені" />;
  }
  return (
    <div className="grid gap-6">
      <FieldGrid>
        <Field label="Дата останнього огляду" value={data.lastInspectionDate} />
        <Field label="Інспектор" value={data.inspector} />
        <Field label="Результат огляду" value={data.inspectionResult} />
        <Field label="Дата наступного планового огляду" value={data.nextInspectionDate} />
      </FieldGrid>
      {data.violations ? (
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Виявлені порушення
          </p>
          <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap">{String(data.violations)}</p>
        </div>
      ) : null}
      {data.inspectorComments ? (
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Коментарі інспектора
          </p>
          <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap">
            {String(data.inspectorComments)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Tab7({ data }: { data: Record<string, unknown> }) {
  const fields = [
    data.technicalPassportNumber,
    data.technicalPassportDate,
    data.acceptanceActNumber,
    data.acceptanceActDate,
    data.operationPermitNumber,
    data.operationPermitDate,
    data.insurancePolicyNumber,
    data.insurancePolicyDate,
    data.documentNotes,
  ];
  if (!hasAnyValue(fields)) {
    return <EmptyState title="Дані не заповнені" />;
  }
  const docRows: { label: string; numKey: string; dateKey: string }[] = [
    {
      label: 'Технічний паспорт',
      numKey: 'technicalPassportNumber',
      dateKey: 'technicalPassportDate',
    },
    {
      label: 'Акт прийняття в експлуатацію',
      numKey: 'acceptanceActNumber',
      dateKey: 'acceptanceActDate',
    },
    {
      label: 'Дозвіл на експлуатацію',
      numKey: 'operationPermitNumber',
      dateKey: 'operationPermitDate',
    },
    {
      label: 'Страховий поліс',
      numKey: 'insurancePolicyNumber',
      dateKey: 'insurancePolicyDate',
    },
  ];
  return (
    <div className="grid gap-6">
      {docRows.map(({ label, numKey, dateKey }) => (
        <div key={numKey}>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">{label}</p>
          <FieldGrid>
            <Field label="Номер" value={data[numKey]} />
            <Field label="Дата" value={data[dateKey]} />
          </FieldGrid>
        </div>
      ))}
      {data.documentNotes ? (
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Примітки щодо документів
          </p>
          <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap">
            {String(data.documentNotes)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Tab8({ data }: { data: Record<string, unknown> }) {
  const fields = [
    data.balanceValue,
    data.annualMaintenanceCost,
    data.fundingSource,
    data.budgetCode,
    data.lastValuationDate,
  ];
  if (!hasAnyValue(fields)) {
    return <EmptyState title="Дані не заповнені" />;
  }
  return (
    <FieldGrid>
      <Field label="Балансова вартість, грн" value={data.balanceValue} />
      <Field label="Щорічні витрати на обслуговування, грн" value={data.annualMaintenanceCost} />
      <Field label="Джерело фінансування" value={data.fundingSource} />
      <Field label="Бюджетний код" value={data.budgetCode} />
      <Field label="Дата останньої оцінки вартості" value={data.lastValuationDate} />
    </FieldGrid>
  );
}

function Tab9({ data }: { data: Record<string, unknown> }) {
  const media = Array.isArray(data.media) ? (data.media as MediaItem[]) : [];

  if (media.length === 0) {
    return <EmptyState title="Медіа не додано" message="До цієї пропозиції ще не прикріплено фото або файли." />;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {media.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="aspect-[4/3] bg-[var(--bg-surface-2)]">
              <img
                src={item.dataUrl}
                alt={item.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="grid gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{item.name}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {item.mimeType || 'image'} · {(item.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Badge severity={item.role === 'FACADE' || item.role === 'ENTRANCE' ? 'info' : 'neutral'}>
                  {item.role === 'FACADE' ? 'Фасад' : item.role === 'ENTRANCE' ? 'Вхід' : 'Без ролі'}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: TabName;
  onChange: (t: TabName) => void;
}) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-3"
      data-migra-component="Navigation/TabBar"
      data-migra-props={JSON.stringify({
        tabs: TABS,
        activeIndex: String(TABS.indexOf(active) + 1),
      })}
    >
      <div className="mb-3">
        <SectionLabel>Розділи</SectionLabel>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Оберіть вкладку для перегляду або редагування.</p>
      </div>

      <div className="space-y-1">
        {TABS.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={[
                'flex w-full items-center rounded-[var(--radius-md)] px-3 py-2 text-left text-[12px] font-medium transition-colors duration-100',
                isActive
                  ? 'bg-[var(--accent-10)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--hover-md)] hover:text-[var(--text-secondary)]',
              ].join(' ')}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RequestDetailClient({ id }: { id: string }) {
  const [item, setItem] = useState<ShelterRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState<'NEW' | 'APPROVED' | 'REJECTED'>('NEW');
  const [rejectionReason, setRejectionReason] = useState('');
  const [role, setRole] = useState('');
  const [activeTab, setActiveTab] = useState<TabName>('Основні параметри');

  async function loadItem() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<ShelterRequestDetail>(`/shelter-requests/${id}`);
      setItem(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Помилка завантаження пропозиції');
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus() {
    if (!item) return;

    setStatusSaving(true);
    setError('');
    try {
      if (statusDraft === 'REJECTED' && !rejectionReason.trim()) {
        throw new Error("Причина відхилення є обов'язковою");
      }
      if (statusDraft === item.status) {
        return;
      }
      await apiFetch(`/shelter-requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: statusDraft,
          ...(statusDraft === 'REJECTED' ? { rejectionReason } : {}),
        }),
      });
      await loadItem();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Помилка зміни статусу пропозиції');
    } finally {
      setStatusSaving(false);
    }
  }

  useEffect(() => {
    setRole(getStoredAuth()?.user.role ?? '');
    void loadItem();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!item) return;
    setStatusDraft(item.status);
    setRejectionReason(item.rejectionReason ?? '');
  }, [item]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading && !item) {
    return (
      <AppShell>
        <PageHeader title="Деталі пропозиції" subtitle={`Пропозиція #${id}`} />
        <div className="flex items-center justify-center flex-1">
          <p className="text-[13px] text-[var(--text-muted)]">Завантаження...</p>
        </div>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell>
        <PageHeader title="Деталі пропозиції" subtitle={`Пропозиція #${id}`} />
        <div className="flex items-center justify-center flex-1">
          <EmptyState
            icon={<FileX />}
            title="Пропозицію не знайдено"
            message={error || 'Перевірте правильність посилання'}
          />
        </div>
      </AppShell>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const statusSeverity =
    item.status === 'APPROVED'
      ? 'ok'
      : item.status === 'REJECTED'
      ? 'danger'
      : 'neutral';

  const statusLabel =
    item.status === 'APPROVED'
      ? 'Схвалено'
      : item.status === 'REJECTED'
      ? 'Відхилено'
      : 'На розгляді';
  const infoTableFields = [
    { label: 'ID', value: fieldDisplayValue(item.id) },
    { label: 'Дата створення', value: new Date(item.createdAt).toLocaleString('uk-UA') },
    { label: 'Створив', value: fieldDisplayValue(item.createdBy.email) },
    { label: 'Дата редагування', value: item.reviewedAt ? new Date(item.reviewedAt).toLocaleString('uk-UA') : '—' },
    { label: 'Обліковий номер', value: fieldDisplayValue(item.data.accountNumber) },
    { label: 'Тимчасовий номер', value: fieldDisplayValue(item.data.tempNumber) },
    { label: 'Технічний номер', value: fieldDisplayValue(item.data.technicalNumber) },
    { label: 'Дата реєстрації', value: fieldDisplayValue(item.data.registrationDate) },
    { label: "Назва об'єкта", value: fieldDisplayValue(item.data.name) },
    { label: 'Регіон', value: fieldDisplayValue(item.data.region) },
    { label: 'Вид укриття', value: fieldDisplayValue(item.data.shelterKind) },
    { label: 'Статус укриття', value: fieldDisplayValue(item.data.shelterStatus) },
    { label: 'Дата статусу укриття', value: fieldDisplayValue(item.data.shelterStatusDate) },
    { label: 'Статус обліку', value: fieldDisplayValue(item.data.accountingStatus) },
    { label: 'Дата статусу обліку', value: fieldDisplayValue(item.data.accountingStatusDate) },
    { label: 'Статус запису', value: fieldDisplayValue(item.data.recordStatus) },
    { label: 'Дата статусу запису', value: fieldDisplayValue(item.data.recordStatusDate) },
    { label: 'Публікація', value: fieldDisplayValue(item.data.isPublished) },
    { label: 'Відповідальний', value: fieldDisplayValue(item.data.responsible) },
  ];

  function renderTabContent() {
    if (!item) return null;
    switch (activeTab) {
      case 'Основні параметри':
        return <Tab1 data={item.data} meta={{ id: item.id, createdAt: item.createdAt, createdByEmail: item.createdBy.email, reviewedAt: item.reviewedAt }} />;
      case 'Розташування':
        return <Tab2 data={item.data} />;
      case 'Характеристики':
        return <Tab3 data={item.data} />;
      case 'Власність':
        return <Tab4 data={item.data} />;
      case 'Інвентаризація':
        return <Tab5 data={item.data} />;
      case 'Огляд':
        return <Tab6 data={item.data} />;
      case 'Документи':
        return <Tab7 data={item.data} />;
      case 'Фінанси':
        return <Tab8 data={item.data} />;
      case 'Медіа':
        return <Tab9 data={item.data} />;
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Деталі пропозиції"
        subtitle={`Пропозиція #${id}`}
        actions={
          <Badge severity={statusSeverity} dot>
            {statusLabel}
          </Badge>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl flex flex-col gap-6">
          {error && <Alert severity="danger">{error}</Alert>}

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div>
              <TabBar active={activeTab} onChange={setActiveTab} />
            </div>

            <div className="space-y-6">
              {/* Meta info row */}
              <div className="flex flex-wrap gap-6 text-[12px] text-[var(--text-muted)]">
                <span>
                  Подав:{' '}
                  <span className="text-[var(--text-secondary)]">{item.createdBy.email}</span>
                </span>
                <span>
                  Дата подачі:{' '}
                  <span className="text-[var(--text-secondary)]">
                    {new Date(item.createdAt).toLocaleString('uk-UA')}
                  </span>
                </span>
                {item.reviewedBy && (
                  <span>
                    Розглянув:{' '}
                    <span className="text-[var(--text-secondary)]">{item.reviewedBy.email}</span>
                  </span>
                )}
                {item.rejectionReason && (
                  <span>
                    Причина відхилення:{' '}
                    <span className="text-[var(--color-danger)]">{item.rejectionReason}</span>
                  </span>
                )}
              </div>

              {/* Tab content */}
              <Card
                padding="lg"
                {...(activeTab === 'Основні параметри'
                  ? {
                    'data-migra-component': 'Data/InfoTable',
                    'data-migra-props': JSON.stringify({
                      title: 'Системна інформація',
                      fields: infoTableFields,
                      dividerAfter: 4,
                    }),
                  }
                  : {})}
              >
                {renderTabContent()}
              </Card>

              {activeTab === 'Основні параметри' && (role === 'REGIONAL' || role === 'DSNS') && (
                <Card padding="lg">
                  <div className="grid gap-4">
                    <div>
                      <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Зміна статусу пропозиції</h2>
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        Виберіть новий статус і збережіть зміни.
                      </p>
                    </div>

                    {item.status === 'APPROVED' ? (
                      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-4 py-3 text-[12px] text-[var(--text-secondary)]">
                        Схвалену пропозицію змінювати не можна, щоб не створити розсинхрон між пропозицією та укриттям.
                      </div>
                    ) : (
                      <>
                        <Select
                          label="Статус пропозиції"
                          value={statusDraft}
                          onChange={(event) => setStatusDraft(event.target.value as 'NEW' | 'APPROVED' | 'REJECTED')}
                          options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                        />

                        {statusDraft === 'REJECTED' ? (
                          <Textarea
                            label="Причина відхилення"
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            placeholder="Обов'язкова при відхиленні"
                          />
                        ) : null}

                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="primary"
                            loading={statusSaving}
                            onClick={() => void changeStatus()}
                            disabled={statusDraft === item.status}
                          >
                            Зберегти статус
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
