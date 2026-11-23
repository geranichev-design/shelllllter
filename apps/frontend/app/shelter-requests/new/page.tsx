'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Alert, Button, Card, Input, Select, Textarea, Checkbox, PageHeader, SectionLabel } from '@repo/ui';
import { AppShell } from '@/app/components/AppShell';
import { Check, MapPinned, X } from 'lucide-react';
import { canCreateShelterRequest, getStoredAuth } from '@/lib/auth';
import type { CoordinatePoint } from './CoordinatePickerMap';

const CoordinatePickerMap = dynamic(() => import('./CoordinatePickerMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center bg-[var(--bg-surface-2)] text-[12px] text-[var(--text-secondary)]">
      Завантаження мапи...
    </div>
  ),
});

// ── Types ──────────────────────────────────────────────────────────────────────

type Step1 = {
  accountNumber: string;
  tempNumber: string;
  technicalNumber: string;
  registrationDate: string;
  name: string;
  region: string;
  shelterKind: string;
  accessType: string;
  shelterStatus: string;
  shelterStatusDate: string;
  accountingStatus: string;
  accountingStatusDate: string;
  recordStatus: string;
  recordStatusDate: string;
  isPublished: boolean;
  responsible: string;
};

type Step2 = {
  country: string;
  region: string;
  district: string;
  community: string;
  settlement: string;
  settlementType: string;
  streetType: string;
  streetName: string;
  building: string;
  corpus: string;
  apartment: string;
  postalCode: string;
  katottg: string;
  latEntrance: string;
  lonEntrance: string;
  latCenter: string;
  lonCenter: string;
  walkRadius: string;
  relativeLocation: string;
  areaDescription: string;
  dangerZones: string;
};

type Step3 = {
  alwaysReady: boolean;
  readinessTime: string;
  populationCategories: string;
  area: string;
  volume: string;
  capacity: string;
  accessibleForDisabled: boolean;
  barrierFreeAccess: boolean;
  shelterClass: string;
  floorsCount: string;
  entrancesCount: string;
  emergencyExitsCount: string;
};

type Step4 = {
  ownershipForm: string;
  departmentalAffiliation: string;
  governmentBody: string;
  institution: string;
  balanceHolder: string;
  operationalManagementForm: string;
  operationStartDate: string;
  orgName: string;
  orgEdrpou: string;
  orgAddress: string;
  orgActivity: string;
  contactLastName: string;
  contactFirstName: string;
  contactMiddleName: string;
  contactPosition: string;
  contactPhone: string;
  contactEmail: string;
  contactIsCurrent: boolean;
  managerLastName: string;
  managerFirstName: string;
  managerMiddleName: string;
  managerPosition: string;
  ownerName: string;
  ownerEdrpou: string;
  ownerAddress: string;
  ownerActivity: string;
};

type Step5 = {
  // Будівля
  buildingRegistryNumber: string;
  buildingInventoryDate: string;
  btiName: string;
  purposeCode: string;
  purposeName: string;
  peacetimePurpose: string;
  // Автор проєкту
  designerName: string;
  designerEdrpou: string;
  designDocLink: string;
  // Підрядник
  contractorName: string;
  contractorEdrpou: string;
  isGeneralContractor: boolean;
  // Двері та ставні
  doorType: string;
  doorMark: string;
  doorCount: string;
  // Вентиляція
  ventilationSystem: string;
  fanType: string;
  fanCapacity: string;
  fanCount: string;
  filterType: string;
  filterCount: string;
  valveType: string;
  valveCapacity: string;
  valveCount: string;
  antiBlastType: string;
  antiBlastCount: string;
  pumpType: string;
  pumpCapacity: string;
  pumpCount: string;
  heaterType: string;
  heaterCapacity: string;
  heaterCount: string;
  coolingType: string;
  coolingCapacity: string;
  coolingCount: string;
  measuringType: string;
  measuringCount: string;
  sealingDegree: string;
  // Електроживлення
  mainPowerSource: string;
  powerReliabilityCategory: string;
  lighting: string;
  backupPower: string;
  engineeringPower: string;
  powerProtection: string;
  // Водопостачання
  hasWaterSupply: boolean;
  waterSource: string;
  waterPurpose: string;
  waterReserveLocation: string;
  waterCapacityLiters: string;
  // Каналізація
  sewageSystemType: string;
  sewageSystemKind: string;
  // Опалення
  heatingClass: string;
  heatingSubclass: string;
  heatingType: string;
  // Засоби зв'язку
  communicationMeans: string;
  hasRadioPoint: boolean;
  // Інше майно
  otherPropertyType: string;
  otherPropertyName: string;
  otherPropertyCount: string;
};

type Step6 = {
  lastInspectionDate: string;
  inspector: string;
  inspectionResult: string;
  nextInspectionDate: string;
  violations: string;
  inspectorComments: string;
};

type Step7 = {
  technicalPassportNumber: string;
  technicalPassportDate: string;
  acceptanceActNumber: string;
  acceptanceActDate: string;
  operationPermitNumber: string;
  operationPermitDate: string;
  insurancePolicyNumber: string;
  insurancePolicyDate: string;
  documentNotes: string;
};

type Step8 = {
  balanceValue: string;
  annualMaintenanceCost: string;
  fundingSource: string;
  budgetCode: string;
  lastValuationDate: string;
};

type MediaRole = 'UNASSIGNED' | 'FACADE' | 'ENTRANCE';

type ShelterMedia = {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  size: number;
  role: MediaRole;
};

type Step9 = {
  media: ShelterMedia[];
};

type WizardState = {
  step1: Step1;
  step2: Step2;
  step3: Step3;
  step4: Step4;
  step5: Step5;
  step6: Step6;
  step7: Step7;
  step8: Step8;
  step9: Step9;
};

const DEMO_STATE: WizardState = {
  step1: {
    accountNumber: '14-КВ-0012',
    tempNumber: 'ТН-2024-0847',
    technicalNumber: 'ТЕХ-0012-KB',
    registrationDate: '2023-04-12',
    name: 'Укриття «Хрещатик»',
    region: 'Київська',
    shelterKind: 'STATIC',
    accessType: 'PUBLIC',
    shelterStatus: 'OPERATION',
    shelterStatusDate: '2024-01-10',
    accountingStatus: 'ACCOUNTED',
    accountingStatusDate: '2023-04-12',
    recordStatus: 'ACTIVE',
    recordStatusDate: '2023-04-12',
    isPublished: true,
    responsible: 'Іваненко Михайло Петрович',
  },
  step2: {
    country: 'Україна',
    region: 'Київська',
    district: 'Шевченківський',
    community: 'Київська міська',
    settlement: 'Київ',
    settlementType: 'CITY',
    streetType: 'STREET',
    streetName: 'Хрещатик',
    building: '22',
    corpus: '',
    apartment: '',
    postalCode: '01001',
    katottg: 'UA80000000000093317',
    latEntrance: '50.4499',
    lonEntrance: '30.5231',
    latCenter: '50.4501',
    lonCenter: '30.5234',
    walkRadius: '500',
    relativeLocation: 'Центральна частина міста, поруч зі станцією метро «Хрещатик»',
    areaDescription: 'Щільна міська забудова, висока прохідність. Укриття розташоване в підвалі адмінбудівлі.',
    dangerZones: '',
  },
  step3: {
    alwaysReady: true,
    readinessTime: '30',
    populationCategories: 'Усі категорії населення, в тому числі маломобільні групи',
    area: '840',
    volume: '2352',
    capacity: '320',
    accessibleForDisabled: true,
    barrierFreeAccess: true,
    shelterClass: 'A',
    floorsCount: '2',
    entrancesCount: '3',
    emergencyExitsCount: '2',
  },
  step4: {
    ownershipForm: 'MUNICIPAL',
    departmentalAffiliation: 'Київська міська рада',
    governmentBody: 'Міністерство внутрішніх справ України',
    institution: 'ДСНС України',
    balanceHolder: 'КП «Київське господарство»',
    operationalManagementForm: 'OPERATIONAL_MANAGEMENT',
    operationStartDate: '1978-09-01',
    orgName: 'КП «Київське господарство»',
    orgEdrpou: '03327965',
    orgAddress: 'вул. Хрещатик, 36, Київ, 01001',
    orgActivity: 'Управління нерухомим майном',
    contactLastName: 'Іваненко',
    contactFirstName: 'Михайло',
    contactMiddleName: 'Петрович',
    contactPosition: 'Начальник відділу цивільного захисту',
    contactPhone: '+380442345678',
    contactEmail: 'shelter@kyivcity.gov.ua',
    contactIsCurrent: true,
    managerLastName: 'Коваленко',
    managerFirstName: 'Олег',
    managerMiddleName: 'Васильович',
    managerPosition: 'Директор КП «Київське господарство»',
    ownerName: 'Київська міська рада',
    ownerEdrpou: '22883141',
    ownerAddress: 'вул. Хрещатик, 36, Київ, 01001',
    ownerActivity: 'Органи місцевого самоврядування',
  },
  step5: {
    buildingRegistryNumber: '80-КВ-12345',
    buildingInventoryDate: '2022-10-15',
    btiName: 'Київське міське БТІ',
    purposeCode: '27.1',
    purposeName: 'Захисна споруда цивільного захисту',
    peacetimePurpose: 'Господарське приміщення, склад',
    designerName: 'ДП «Київпроект»',
    designerEdrpou: '01416880',
    designDocLink: 'https://docs.kyivproekt.ua/shelter-0012',
    contractorName: 'ТОВ «Укрбуд»',
    contractorEdrpou: '31254678',
    isGeneralContractor: true,
    doorType: 'Захисно-герметичні двері',
    doorMark: 'ДУ-IV-2',
    doorCount: '3',
    ventilationSystem: 'ФВА режими 1, 2, 3',
    fanType: 'ЕВР-2',
    fanCapacity: '1200',
    fanCount: '2',
    filterType: 'ФПУ-200',
    filterCount: '4',
    valveType: 'КГ-150',
    valveCapacity: '150',
    valveCount: '6',
    antiBlastType: 'ПВУ-6',
    antiBlastCount: '4',
    pumpType: 'К 20/30',
    pumpCapacity: '20',
    pumpCount: '2',
    heaterType: '',
    heaterCapacity: '',
    heaterCount: '',
    coolingType: '',
    coolingCapacity: '',
    coolingCount: '',
    measuringType: 'ДП-5В',
    measuringCount: '2',
    sealingDegree: 'Перший',
    mainPowerSource: 'Міська електромережа 380/220В',
    powerReliabilityCategory: '1',
    lighting: 'Стаціонарне + переносні ліхтарі',
    backupPower: 'Дизельний генератор 15 кВт',
    engineeringPower: 'Від резервного генератора',
    powerProtection: 'ПЗВ, автоматичні вимикачі',
    hasWaterSupply: true,
    waterSource: 'Централізований водопровід',
    waterPurpose: 'Питна та господарська',
    waterReserveLocation: 'Резервуар у тех. приміщенні',
    waterCapacityLiters: '4800',
    sewageSystemType: 'Централізована',
    sewageSystemKind: 'Самопливна',
    heatingClass: 'Клас А',
    heatingSubclass: 'А1',
    heatingType: 'Централізоване водяне',
    communicationMeans: 'Телефонна лінія, гучномовний зв\'язок',
    hasRadioPoint: true,
    otherPropertyType: 'Медичне спорядження',
    otherPropertyName: 'Аптечка першої допомоги',
    otherPropertyCount: '5',
  },
  step6: {
    lastInspectionDate: '2024-11-15',
    inspector: 'Коваль Сергій Олексійович',
    inspectionResult: 'PASSED',
    nextInspectionDate: '2025-05-15',
    violations: '',
    inspectorComments: 'Укриття у задовільному технічному стані. Всі системи справні.',
  },
  step7: {
    technicalPassportNumber: 'ТП-2023-0012',
    technicalPassportDate: '2023-03-10',
    acceptanceActNumber: 'АА-78-1978',
    acceptanceActDate: '1978-09-01',
    operationPermitNumber: 'ДО-0012/2023',
    operationPermitDate: '2023-04-01',
    insurancePolicyNumber: 'СК-2024-08845',
    insurancePolicyDate: '2024-01-01',
    documentNotes: 'Усі документи в наявності та актуальні.',
  },
  step8: {
    balanceValue: '12500000',
    annualMaintenanceCost: '380000',
    fundingSource: 'LOCAL_BUDGET',
    budgetCode: '2414020',
    lastValuationDate: '2023-12-31',
  },
  step9: {
    media: [],
  },
};

const initialState: WizardState = {
  step1: {
    accountNumber: '',
    tempNumber: '',
    technicalNumber: '',
    registrationDate: '',
    name: '',
    region: '',
    shelterKind: '',
    accessType: '',
    shelterStatus: 'NEED',
    shelterStatusDate: '',
    accountingStatus: 'NEW',
    accountingStatusDate: '',
    recordStatus: 'DRAFT',
    recordStatusDate: '',
    isPublished: false,
    responsible: '',
  },
  step2: {
    country: '',
    region: '',
    district: '',
    community: '',
    settlement: '',
    settlementType: '',
    streetType: '',
    streetName: '',
    building: '',
    corpus: '',
    apartment: '',
    postalCode: '',
    katottg: '',
    latEntrance: '',
    lonEntrance: '',
    latCenter: '',
    lonCenter: '',
    walkRadius: '',
    relativeLocation: '',
    areaDescription: '',
    dangerZones: '',
  },
  step3: {
    alwaysReady: false,
    readinessTime: '',
    populationCategories: '',
    area: '',
    volume: '',
    capacity: '',
    accessibleForDisabled: false,
    barrierFreeAccess: false,
    shelterClass: '',
    floorsCount: '',
    entrancesCount: '',
    emergencyExitsCount: '',
  },
  step4: {
    ownershipForm: '',
    departmentalAffiliation: '',
    governmentBody: '',
    institution: '',
    balanceHolder: '',
    operationalManagementForm: '',
    operationStartDate: '',
    orgName: '',
    orgEdrpou: '',
    orgAddress: '',
    orgActivity: '',
    contactLastName: '',
    contactFirstName: '',
    contactMiddleName: '',
    contactPosition: '',
    contactPhone: '',
    contactEmail: '',
    contactIsCurrent: false,
    managerLastName: '',
    managerFirstName: '',
    managerMiddleName: '',
    managerPosition: '',
    ownerName: '',
    ownerEdrpou: '',
    ownerAddress: '',
    ownerActivity: '',
  },
  step5: {
    buildingRegistryNumber: '', buildingInventoryDate: '', btiName: '', purposeCode: '', purposeName: '', peacetimePurpose: '',
    designerName: '', designerEdrpou: '', designDocLink: '',
    contractorName: '', contractorEdrpou: '', isGeneralContractor: false,
    doorType: '', doorMark: '', doorCount: '',
    ventilationSystem: '', fanType: '', fanCapacity: '', fanCount: '',
    filterType: '', filterCount: '', valveType: '', valveCapacity: '', valveCount: '',
    antiBlastType: '', antiBlastCount: '', pumpType: '', pumpCapacity: '', pumpCount: '',
    heaterType: '', heaterCapacity: '', heaterCount: '',
    coolingType: '', coolingCapacity: '', coolingCount: '',
    measuringType: '', measuringCount: '', sealingDegree: '',
    mainPowerSource: '', powerReliabilityCategory: '', lighting: '', backupPower: '', engineeringPower: '', powerProtection: '',
    hasWaterSupply: false, waterSource: '', waterPurpose: '', waterReserveLocation: '', waterCapacityLiters: '',
    sewageSystemType: '', sewageSystemKind: '',
    heatingClass: '', heatingSubclass: '', heatingType: '',
    communicationMeans: '', hasRadioPoint: false,
    otherPropertyType: '', otherPropertyName: '', otherPropertyCount: '',
  },
  step6: {
    lastInspectionDate: '',
    inspector: '',
    inspectionResult: '',
    nextInspectionDate: '',
    violations: '',
    inspectorComments: '',
  },
  step7: {
    technicalPassportNumber: '',
    technicalPassportDate: '',
    acceptanceActNumber: '',
    acceptanceActDate: '',
    operationPermitNumber: '',
    operationPermitDate: '',
    insurancePolicyNumber: '',
    insurancePolicyDate: '',
    documentNotes: '',
  },
  step8: {
    balanceValue: '',
    annualMaintenanceCost: '',
    fundingSource: '',
    budgetCode: '',
    lastValuationDate: '',
  },
  step9: {
    media: [],
  },
};

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

type MigraFormField = {
  label: string;
  value: string;
  kind: 'input' | 'select' | 'textarea';
  required?: boolean;
  span?: number;
};

function optionLabel(options: { value: string; label: string }[], value: string, fallback: string) {
  return options.find((option) => option.value === value)?.label || fallback;
}

function buildStep1MigraFields(data: Step1): MigraFormField[] {
  return [
    { label: 'Обліковий номер', value: data.accountNumber || '14-КВ-0012', kind: 'input' },
    { label: 'Тимчасовий номер', value: data.tempNumber || 'ТН-2024-XXXX', kind: 'input' },
    { label: 'Технічний номер', value: data.technicalNumber || 'ТЕХ-XXXX-XX', kind: 'input' },
    { label: 'Дата реєстрації', value: data.registrationDate || 'Search', kind: 'input' },
    { label: "Назва об'єкта", value: data.name || 'Офіційна назва укриття', kind: 'input', required: true, span: 2 },
    { label: 'Регіон', value: data.region || 'Київська', kind: 'input' },
    {
      label: 'Вид укриття',
      value: optionLabel([
        { value: 'STATIC', label: 'Стаціонарне' },
        { value: 'MOBILE', label: 'Мобільне' },
        { value: 'MODULAR', label: 'Модульне' },
      ], data.shelterKind, 'Оберіть вид'),
      kind: 'select',
      required: true,
    },
    {
      label: 'Тип доступу',
      value: optionLabel([
        { value: 'PUBLIC', label: 'Публічний' },
        { value: 'PRIVATE', label: 'Приватний' },
      ], data.accessType, 'Оберіть тип доступу'),
      kind: 'select',
      required: true,
    },
    { label: 'Стан укриття', value: optionLabel(SHELTER_STATUS_OPTIONS, data.shelterStatus, 'Потреба'), kind: 'select' },
    { label: 'Дата стану укриття', value: data.shelterStatusDate || 'Search', kind: 'input' },
    { label: 'Стан обліку', value: optionLabel(ACCOUNTING_STATUS_OPTIONS, data.accountingStatus, 'Новий'), kind: 'select' },
    { label: 'Дата стану обліку', value: data.accountingStatusDate || 'Search', kind: 'input' },
    { label: 'Стан запису', value: optionLabel(RECORD_STATUS_OPTIONS, data.recordStatus, 'Чернетка'), kind: 'select' },
    { label: 'Дата стану запису', value: data.recordStatusDate || 'Search', kind: 'input' },
    { label: 'Відповідальний', value: data.responsible || 'ПІБ відповідального', kind: 'input' },
  ];
}

type ProposalPrefillParams = {
  source?: 'automatic' | 'manual';
  title?: string;
  proposalType?: 'STATIC' | 'MOBILE' | 'MODULAR';
  capacity?: string;
  priority?: 'high' | 'medium' | 'low';
  reason?: string;
  status?: string;
  latitude?: string;
  longitude?: string;
  settlement?: string;
  region?: string;
};

type SearchParamsLike = Pick<URLSearchParams, 'get'>;

function readProposalPrefill(searchParams: SearchParamsLike): ProposalPrefillParams | null {
  const proposalType = searchParams.get('proposalType');
  const source = searchParams.get('source');
  const priority = searchParams.get('priority');

  if (
    !searchParams.get('title') &&
    !proposalType &&
    !searchParams.get('capacity') &&
    !searchParams.get('latitude') &&
    !searchParams.get('longitude')
  ) {
    return null;
  }

  return {
    source: source === 'manual' || source === 'automatic' ? source : 'automatic',
    title: searchParams.get('title') || undefined,
    proposalType:
      proposalType === 'STATIC' || proposalType === 'MOBILE' || proposalType === 'MODULAR'
        ? proposalType
        : undefined,
    capacity: searchParams.get('capacity') || undefined,
    priority: priority === 'high' || priority === 'medium' || priority === 'low' ? priority : undefined,
    reason: searchParams.get('reason') || undefined,
    status: searchParams.get('status') || undefined,
    latitude: searchParams.get('latitude') || undefined,
    longitude: searchParams.get('longitude') || undefined,
    settlement: searchParams.get('settlement') || undefined,
    region: searchParams.get('region') || undefined,
  };
}

function buildStateFromProposal(prefill: ProposalPrefillParams | null): WizardState {
  if (!prefill) {
    return initialState;
  }

  const sourceLabel = prefill.source === 'manual' ? 'Ручна пропозиція з карти' : 'Автоматична пропозиція з карти';

  return {
    ...initialState,
    step1: {
      ...initialState.step1,
      name: prefill.title?.trim() || initialState.step1.name,
      region: prefill.region?.trim() || initialState.step1.region,
      shelterKind: prefill.proposalType || initialState.step1.shelterKind,
      accessType: 'PUBLIC',
      shelterStatus: 'PROJECT',
      accountingStatus: 'NEW',
      recordStatus: 'DRAFT',
      responsible: prefill.priority
        ? `${sourceLabel} · пріоритет ${prefill.priority}`
        : sourceLabel,
    },
    step2: {
      ...initialState.step2,
      country: 'Україна',
      region: prefill.region?.trim() || 'Київська',
      settlement: prefill.settlement?.trim() || '',
      latCenter: prefill.latitude?.trim() || '',
      lonCenter: prefill.longitude?.trim() || '',
      latEntrance: prefill.latitude?.trim() || '',
      lonEntrance: prefill.longitude?.trim() || '',
      walkRadius: '500',
      relativeLocation: prefill.reason?.trim() || '',
      areaDescription: prefill.status ? `Статус автоматичної пропозиції: ${prefill.status}` : '',
    },
    step3: {
      ...initialState.step3,
      capacity: prefill.capacity?.trim() || '',
      readinessTime: prefill.proposalType === 'MOBILE' ? '15' : '30',
      alwaysReady: prefill.proposalType !== 'MOBILE',
      accessibleForDisabled: true,
      barrierFreeAccess: true,
      shelterClass:
        prefill.proposalType === 'STATIC'
          ? 'A'
          : prefill.proposalType === 'MODULAR'
            ? 'B'
            : 'C',
      populationCategories: 'Мешканці зони автоматичної пропозиції',
    },
  };
}

// ── Step metadata ──────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Основні',
  'Розташування',
  'Характеристики',
  'Власність',
  'Інвентаризація',
  'Огляд',
  'Документи',
  'Фінанси',
  'Медіа',
];

type ValidationWarning = {
  step: number;
  missing: string[];
};

function getMissingRequiredFields(step: number, state: WizardState) {
  switch (step) {
    case 1:
      return [
        !state.step1.name.trim() ? "Назва об'єкта" : null,
        !state.step1.shelterKind ? 'Вид укриття' : null,
        !state.step1.accessType ? 'Тип доступу' : null,
      ].filter(Boolean) as string[];
    case 2:
      return [
        !state.step2.latCenter.trim() ? 'Широта центр' : null,
        !state.step2.lonCenter.trim() ? 'Довгота центр' : null,
      ].filter(Boolean) as string[];
    case 3:
      return [
        !state.step3.capacity.trim() ? 'Місткість' : null,
      ].filter(Boolean) as string[];
    default:
      return [];
  }
}

function getInvalidSteps(state: WizardState) {
  return [1, 2, 3].filter((step) => getMissingRequiredFields(step, state).length > 0);
}

// ── Stepper component ─────────────────────────────────────────────────────────

function Stepper({ current, total, invalidSteps }: { current: number; total: number; invalidSteps: number[] }) {
  return (
    <div
      className="flex items-center px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)] overflow-x-auto"
      data-migra-component="Form/Stepper"
      data-migra-props={JSON.stringify({
        labels: STEP_LABELS.slice(0, total),
        current,
        total,
        invalidSteps,
      })}
    >
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < current;
        const isActive = stepNum === current;
        const isInvalid = invalidSteps.includes(stepNum);

        return (
          <div key={stepNum} className="flex items-center flex-shrink-0">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <div
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0',
                  isInvalid
                    ? 'bg-[#ff6b6b]/15 border border-[#ff6b6b]/50 text-[var(--color-danger)] shadow-[0_0_0_1px_rgba(255,107,107,0.15)]'
                    : isCompleted
                    ? 'bg-[var(--accent-20)] border border-[var(--accent-50)]'
                    : isActive
                    ? 'bg-[var(--accent)] shadow-[0_0_12px_var(--accent-35)]'
                    : 'bg-[var(--hover-md)] border border-[var(--border-strong)]',
                ].join(' ')}
              >
                {isCompleted && !isInvalid ? (
                  <Check className="w-3 h-3 text-[var(--accent)]" strokeWidth={3} />
                ) : (
                  <span
                    className={
                      isInvalid
                        ? 'text-[var(--color-danger)]'
                        : isActive
                        ? 'text-[var(--color-on-accent)]'
                        : 'text-[var(--text-muted)]'
                    }
                  >
                    {stepNum}
                  </span>
                )}
              </div>
              <span
                className={[
                  'text-[11px] font-medium whitespace-nowrap',
                  isInvalid
                    ? 'text-[var(--color-danger)]'
                    : isCompleted
                    ? 'text-[var(--accent-70)]'
                    : isActive
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)]',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {/* Connector */}
            {i < total - 1 && (
              <div
                className={[
                  'w-8 h-px mx-2 flex-shrink-0',
                  isInvalid ? 'bg-[#ff6b6b]/30' : isCompleted ? 'bg-[var(--accent-40)]' : 'bg-[var(--border-strong)]',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Field grid helper ─────────────────────────────────────────────────────────

function FieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div
      className={`grid gap-4 ${cols === 1 ? '' : cols === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}
    >
      {children}
    </div>
  );
}

const DEFAULT_PICKER_POINT: CoordinatePoint = {
  latitude: 50.4501,
  longitude: 30.5234,
};

function parseCoordinate(value: string) {
  const number = Number(value.trim().replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function getInitialPickerPoint(data: Step2): CoordinatePoint {
  const latitude = parseCoordinate(data.latCenter) ?? parseCoordinate(data.latEntrance) ?? DEFAULT_PICKER_POINT.latitude;
  const longitude = parseCoordinate(data.lonCenter) ?? parseCoordinate(data.lonEntrance) ?? DEFAULT_PICKER_POINT.longitude;

  return { latitude, longitude };
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

const STREET_TYPE_SEARCH_LABELS: Record<string, string> = {
  STREET: 'вулиця',
  AVENUE: 'проспект',
  LANE: 'провулок',
  SQUARE: 'площа',
  BOULEVARD: 'бульвар',
  EMBANKMENT: 'набережна',
};

function buildAddressQuery(data: Step2) {
  return [
    data.settlement,
    data.streetName ? `${streetTypeLabel(data.streetType)} ${data.streetName}`.trim() : '',
    data.building,
    data.region,
    data.country || 'Україна',
  ]
    .filter(Boolean)
    .join(', ');
}

function streetTypeLabel(type: string) {
  return STREET_TYPE_SEARCH_LABELS[type] ?? '';
}

// ── Step forms ────────────────────────────────────────────────────────────────

function Step1Form({
  data,
  onChange,
}: {
  data: Step1;
  onChange: (d: Step1) => void;
}) {
  function set(key: keyof Step1, value: string | boolean) {
    onChange({ ...data, [key]: value });
  }
  return (
    <div className="grid gap-4">
      <FieldGrid>
        <Input
          label="Обліковий номер"
          value={data.accountNumber}
          onChange={(e) => set('accountNumber', e.target.value)}
          placeholder="14-КВ-0012"
        />
        <Input
          label="Тимчасовий номер"
          value={data.tempNumber}
          onChange={(e) => set('tempNumber', e.target.value)}
          placeholder="ТН-2024-XXXX"
        />
        <Input
          label="Технічний номер"
          value={data.technicalNumber}
          onChange={(e) => set('technicalNumber', e.target.value)}
          placeholder="ТЕХ-XXXX-XX"
        />
        <Input
          label="Дата реєстрації"
          type="date"
          value={data.registrationDate}
          onChange={(e) => set('registrationDate', e.target.value)}
        />
      </FieldGrid>

      <Input
        label="Назва об'єкта"
        value={data.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Офіційна назва укриття"
        required
      />

      <FieldGrid>
        <Input
          label="Регіон"
          value={data.region}
          onChange={(e) => set('region', e.target.value)}
          placeholder="Київська"
        />
        <Select
          label="Вид укриття"
          value={data.shelterKind}
          onChange={(e) => set('shelterKind', e.target.value)}
          placeholder="Оберіть вид"
          required
          options={[
            { value: 'STATIC', label: 'Стаціонарне' },
            { value: 'MOBILE', label: 'Мобільне' },
            { value: 'MODULAR', label: 'Модульне' },
          ]}
        />
        <Select
          label="Тип доступу"
          value={data.accessType}
          onChange={(e) => set('accessType', e.target.value)}
          placeholder="Оберіть тип доступу"
          required
          options={[
            { value: 'PUBLIC', label: 'Публічний' },
            { value: 'PRIVATE', label: 'Приватний' },
          ]}
        />
        <Select
          label="Стан укриття"
          value={data.shelterStatus}
          onChange={(e) => set('shelterStatus', e.target.value)}
          placeholder="Оберіть статус"
          options={SHELTER_STATUS_OPTIONS}
        />
        <Input
          label="Дата стану укриття"
          type="date"
          value={data.shelterStatusDate}
          onChange={(e) => set('shelterStatusDate', e.target.value)}
        />
        <Select
          label="Стан обліку"
          value={data.accountingStatus}
          onChange={(e) => set('accountingStatus', e.target.value)}
          placeholder="Оберіть статус"
          options={ACCOUNTING_STATUS_OPTIONS}
        />
        <Input
          label="Дата стану обліку"
          type="date"
          value={data.accountingStatusDate}
          onChange={(e) => set('accountingStatusDate', e.target.value)}
        />
        <Select
          label="Стан запису"
          value={data.recordStatus}
          onChange={(e) => set('recordStatus', e.target.value)}
          placeholder="Оберіть статус"
          options={RECORD_STATUS_OPTIONS}
        />
        <Input
          label="Дата стану запису"
          type="date"
          value={data.recordStatusDate}
          onChange={(e) => set('recordStatusDate', e.target.value)}
        />
        <Input
          label="Відповідальний"
          value={data.responsible}
          onChange={(e) => set('responsible', e.target.value)}
          placeholder="ПІБ відповідального"
        />
      </FieldGrid>

      <div className="pt-1">
        <Checkbox
          checked={data.isPublished}
          onChange={(v) => set('isPublished', v)}
          label="Публікація (відображати в публічному реєстрі)"
        />
      </div>
    </div>
  );
}

function Step2Form({
  data,
  onChange,
}: {
  data: Step2;
  onChange: (d: Step2) => void;
}) {
  const [coordinatePickerOpen, setCoordinatePickerOpen] = useState(false);
  const [pickedPoint, setPickedPoint] = useState<CoordinatePoint>(() => getInitialPickerPoint(data));

  function set(key: keyof Step2, value: string) {
    onChange({ ...data, [key]: value });
  }

  function openCoordinatePicker() {
    setPickedPoint(getInitialPickerPoint(data));
    setCoordinatePickerOpen(true);
  }

  function applyPickedPoint() {
    const latitude = formatCoordinate(pickedPoint.latitude);
    const longitude = formatCoordinate(pickedPoint.longitude);

    onChange({
      ...data,
      latCenter: latitude,
      lonCenter: longitude,
      latEntrance: data.latEntrance.trim() ? data.latEntrance : latitude,
      lonEntrance: data.lonEntrance.trim() ? data.lonEntrance : longitude,
    });
    setCoordinatePickerOpen(false);
  }

  return (
    <div className="grid gap-6">
      {/* Адміністративна одиниця */}
      <div className="grid gap-4">
        <SectionLabel>Адміністративна одиниця</SectionLabel>
        <FieldGrid>
          <Input label="Країна" value={data.country} onChange={(e) => set('country', e.target.value)} placeholder="Україна" />
          <Input label="Область / Регіон" value={data.region} onChange={(e) => set('region', e.target.value)} placeholder="Київська" />
          <Input label="Район" value={data.district} onChange={(e) => set('district', e.target.value)} placeholder="Шевченківський" />
          <Input label="Громада" value={data.community} onChange={(e) => set('community', e.target.value)} placeholder="Київська міська" />
          <Input label="Населений пункт" value={data.settlement} onChange={(e) => set('settlement', e.target.value)} placeholder="Київ" />
          <Select
            label="Тип населеного пункту"
            value={data.settlementType}
            onChange={(e) => set('settlementType', e.target.value)}
            placeholder="Оберіть тип"
            options={[
              { value: 'CITY', label: 'Місто' },
              { value: 'TOWN', label: 'Містечко' },
              { value: 'VILLAGE', label: 'Село' },
              { value: 'HAMLET', label: 'Селище' },
            ]}
          />
        </FieldGrid>
      </div>

      {/* Вулиця та будинок */}
      <div className="grid gap-4">
        <SectionLabel>Вулиця та будинок</SectionLabel>
        <FieldGrid>
          <Select
            label="Тип вулиці"
            value={data.streetType}
            onChange={(e) => set('streetType', e.target.value)}
            placeholder="Оберіть тип"
            options={[
              { value: 'STREET', label: 'Вулиця' },
              { value: 'AVENUE', label: 'Проспект' },
              { value: 'LANE', label: 'Провулок' },
              { value: 'SQUARE', label: 'Площа' },
              { value: 'BOULEVARD', label: 'Бульвар' },
              { value: 'EMBANKMENT', label: 'Набережна' },
            ]}
          />
          <Input label="Назва вулиці" value={data.streetName} onChange={(e) => set('streetName', e.target.value)} placeholder="Хрещатик" />
          <Input label="Будівля" value={data.building} onChange={(e) => set('building', e.target.value)} placeholder="22" />
          <Input label="Корпус" value={data.corpus} onChange={(e) => set('corpus', e.target.value)} placeholder="А" />
          <Input label="Квартира / Офіс" value={data.apartment} onChange={(e) => set('apartment', e.target.value)} placeholder="101" />
          <Input label="Індекс" value={data.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="01001" />
          <Input label="КАТОТТГ" value={data.katottg} onChange={(e) => set('katottg', e.target.value)} placeholder="UA80000000000093317" />
        </FieldGrid>
      </div>

      {/* Геолокація */}
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>Геолокація</SectionLabel>
          <Button type="button" variant="outline" size="md" iconLeft={<MapPinned />} onClick={openCoordinatePicker}>
            Обрати на мапі
          </Button>
        </div>
        <FieldGrid>
          <Input label="Широта вхід" type="number" step="any" value={data.latEntrance} onChange={(e) => set('latEntrance', e.target.value)} placeholder="50.4499" />
          <Input label="Довгота вхід" type="number" step="any" value={data.lonEntrance} onChange={(e) => set('lonEntrance', e.target.value)} placeholder="30.5231" />
          <Input label="Широта центр" type="number" step="any" value={data.latCenter} onChange={(e) => set('latCenter', e.target.value)} placeholder="50.4501" required />
          <Input label="Довгота центр" type="number" step="any" value={data.lonCenter} onChange={(e) => set('lonCenter', e.target.value)} placeholder="30.5234" required />
          <Input label="Радіус пішохідної доступності, м" type="number" value={data.walkRadius} onChange={(e) => set('walkRadius', e.target.value)} placeholder="500" />
        </FieldGrid>
      </div>

      {/* Опис */}
      <div className="grid gap-4">
        <SectionLabel>Опис розташування</SectionLabel>
        <Textarea label="Відносне розташування" value={data.relativeLocation} onChange={(e) => set('relativeLocation', e.target.value)} placeholder="Орієнтири, сусідні об'єкти..." />
        <Textarea label="Опис місцевості" value={data.areaDescription} onChange={(e) => set('areaDescription', e.target.value)} placeholder="Характеристика прилеглої місцевості..." />
        <Textarea label="Небезпечні зони" value={data.dangerZones} onChange={(e) => set('dangerZones', e.target.value)} placeholder="Опис небезпечних зон поблизу..." />
      </div>

      {coordinatePickerOpen ? (
        <CoordinatePickerDialog
          point={pickedPoint}
          initialAddress={buildAddressQuery(data)}
          onPointChange={setPickedPoint}
          onApply={applyPickedPoint}
          onClose={() => setCoordinatePickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CoordinatePickerDialog({
  point,
  initialAddress,
  onPointChange,
  onApply,
  onClose,
}: {
  point: CoordinatePoint;
  initialAddress: string;
  onPointChange: (point: CoordinatePoint) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const [addressQuery, setAddressQuery] = useState(initialAddress);
  const [addressStatus, setAddressStatus] = useState('');
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);

  async function searchAddress() {
    const query = addressQuery.trim();
    if (!query) {
      setAddressStatus('Введіть адресу для пошуку.');
      return;
    }

    setAddressSearchLoading(true);
    setAddressStatus('');

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'ua',
        addressdetails: '1',
        'accept-language': 'uk',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error('search failed');
      }

      const results = (await response.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
      const first = results[0];

      if (!first) {
        setAddressStatus('Адресу не знайдено. Спробуйте уточнити населений пункт або номер будинку.');
        return;
      }

      const latitude = Number(first.lat);
      const longitude = Number(first.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setAddressStatus('Сервіс повернув некоректні координати.');
        return;
      }

      onPointChange({ latitude, longitude });
      setAddressStatus(first.display_name ? `Знайдено: ${first.display_name}` : 'Локацію знайдено.');
    } catch {
      setAddressStatus('Не вдалося виконати пошук адреси. Перевірте з’єднання або спробуйте пізніше.');
    } finally {
      setAddressSearchLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Закрити мапу"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coordinate-picker-title"
        className="relative z-[5001] flex w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_40px_140px_rgba(0,0,0,0.72)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <SectionLabel>
              Геолокація
            </SectionLabel>
            <h3 id="coordinate-picker-title" className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">Обрати координати</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <Input
              label="Адреса"
              value={addressQuery}
              onChange={(event) => setAddressQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void searchAddress();
                }
              }}
              placeholder="Наприклад: Київ, Хрещатик 22"
            />
            <Button
              type="button"
              variant="outline"
              size="md"
              loading={addressSearchLoading}
              iconLeft={<MapPinned />}
              onClick={() => void searchAddress()}
            >
              Знайти
            </Button>
          </div>
          {addressStatus ? (
            <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{addressStatus}</p>
          ) : null}
        </div>

        <div className="h-[min(68vh,560px)] min-h-[360px] bg-[var(--bg-surface-2)]">
          <CoordinatePickerMap point={point} onChange={onPointChange} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4">
          <div className="flex flex-wrap gap-2 text-[12px]">
            <span className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 font-mono text-[var(--text-primary)]">
              {formatCoordinate(point.latitude)}
            </span>
            <span className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 font-mono text-[var(--text-primary)]">
              {formatCoordinate(point.longitude)}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Скасувати
            </Button>
            <Button type="button" variant="primary" size="md" iconLeft={<Check />} onClick={onApply}>
              Застосувати
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step3Form({
  data,
  onChange,
}: {
  data: Step3;
  onChange: (d: Step3) => void;
}) {
  function set(key: keyof Step3, value: string | boolean) {
    onChange({ ...data, [key]: value });
  }
  return (
    <div className="grid gap-6">
      <FieldGrid>
        <Input
          label="Площа приміщення, м²"
          type="number"
          value={data.area}
          onChange={(e) => set('area', e.target.value)}
        />
        <Input
          label="Об'єм приміщення, м³"
          type="number"
          value={data.volume}
          onChange={(e) => set('volume', e.target.value)}
        />
        <Input
          label="Місткість, осіб"
          type="number"
          value={data.capacity}
          onChange={(e) => set('capacity', e.target.value)}
          required
        />
        <Select
          label="Клас сховища"
          value={data.shelterClass}
          onChange={(e) => set('shelterClass', e.target.value)}
          placeholder="Оберіть клас"
          options={[
            { value: 'A', label: 'Клас А' },
            { value: 'B', label: 'Клас Б' },
            { value: 'C', label: 'Клас В' },
            { value: 'PRU', label: 'ПРУ' },
          ]}
        />
        <Input
          label="Час приведення у готовність, хв"
          type="number"
          value={data.readinessTime}
          onChange={(e) => set('readinessTime', e.target.value)}
          placeholder="30"
        />
        <Input
          label="Кількість поверхів"
          type="number"
          min="1"
          value={data.floorsCount}
          onChange={(e) => set('floorsCount', e.target.value)}
        />
        <Input
          label="Кількість входів"
          type="number"
          min="1"
          value={data.entrancesCount}
          onChange={(e) => set('entrancesCount', e.target.value)}
        />
        <Input
          label="Кількість аварійних виходів"
          type="number"
          min="0"
          value={data.emergencyExitsCount}
          onChange={(e) => set('emergencyExitsCount', e.target.value)}
        />
      </FieldGrid>

      <Textarea
        label="Категорії населення"
        value={data.populationCategories}
        onChange={(e) => set('populationCategories', e.target.value)}
        placeholder="Перелік категорій населення, для яких призначене укриття..."
      />

      <div className="flex flex-col gap-3">
        <Checkbox
          checked={data.alwaysReady}
          onChange={(v) => set('alwaysReady', v)}
          label="Постійна готовність"
        />
        <Checkbox
          checked={data.accessibleForDisabled}
          onChange={(v) => set('accessibleForDisabled', v)}
          label="Доступність для маломобільних груп"
        />
        <Checkbox
          checked={data.barrierFreeAccess}
          onChange={(v) => set('barrierFreeAccess', v)}
          label="Безперешкодний доступ"
        />
      </div>
    </div>
  );
}

function Step4Form({
  data,
  onChange,
}: {
  data: Step4;
  onChange: (d: Step4) => void;
}) {
  function set(key: keyof Step4, value: string | boolean) {
    onChange({ ...data, [key]: value });
  }
  return (
    <div className="grid gap-6">
      {/* Загальна інформація */}
      <div className="grid gap-4">
        <SectionLabel>Загальна інформація</SectionLabel>
        <FieldGrid>
          <Select
            label="Форма власності"
            value={data.ownershipForm}
            onChange={(e) => set('ownershipForm', e.target.value)}
            placeholder="Оберіть форму"
            options={[
              { value: 'STATE', label: 'Державна' },
              { value: 'MUNICIPAL', label: 'Комунальна' },
              { value: 'PRIVATE', label: 'Приватна' },
              { value: 'COLLECTIVE', label: 'Колективна' },
            ]}
          />
          <Input label="Відомча належність" value={data.departmentalAffiliation} onChange={(e) => set('departmentalAffiliation', e.target.value)} />
          <Input label="Орган державного управління" value={data.governmentBody} onChange={(e) => set('governmentBody', e.target.value)} />
          <Input label="Установа" value={data.institution} onChange={(e) => set('institution', e.target.value)} />
          <Input label="Балансоутримувач" value={data.balanceHolder} onChange={(e) => set('balanceHolder', e.target.value)} />
          <Select
            label="Форма оперативного управління"
            value={data.operationalManagementForm}
            onChange={(e) => set('operationalManagementForm', e.target.value)}
            placeholder="Оберіть форму"
            options={[
              { value: 'OPERATIONAL_MANAGEMENT', label: 'Оперативне управління' },
              { value: 'LEASE', label: 'Оренда' },
              { value: 'FREE_USE', label: 'Безоплатне користування' },
              { value: 'OWNERSHIP', label: 'Власність' },
            ]}
          />
          <Input label="Дата початку експлуатації" type="date" value={data.operationStartDate} onChange={(e) => set('operationStartDate', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Організація */}
      <div className="grid gap-4">
        <SectionLabel>Організація (балансоутримувач)</SectionLabel>
        <FieldGrid>
          <Input label="Назва" value={data.orgName} onChange={(e) => set('orgName', e.target.value)} />
          <Input label="Код ЄДРПОУ" value={data.orgEdrpou} onChange={(e) => set('orgEdrpou', e.target.value)} placeholder="00000000" />
          <Input label="Адреса" value={data.orgAddress} onChange={(e) => set('orgAddress', e.target.value)} />
          <Input label="Основний вид діяльності" value={data.orgActivity} onChange={(e) => set('orgActivity', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Контактна особа */}
      <div className="grid gap-4">
        <SectionLabel>Контактна особа</SectionLabel>
        <FieldGrid>
          <Input label="Прізвище" value={data.contactLastName} onChange={(e) => set('contactLastName', e.target.value)} />
          <Input label="Ім'я" value={data.contactFirstName} onChange={(e) => set('contactFirstName', e.target.value)} />
          <Input label="По батькові" value={data.contactMiddleName} onChange={(e) => set('contactMiddleName', e.target.value)} />
          <Input label="Посада" value={data.contactPosition} onChange={(e) => set('contactPosition', e.target.value)} />
          <Input label="Телефон" type="tel" value={data.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
          <Input label="Email" type="email" value={data.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
        </FieldGrid>
        <Checkbox checked={data.contactIsCurrent} onChange={(v) => set('contactIsCurrent', v)} label="Актуальний" />
      </div>

      {/* Керівник */}
      <div className="grid gap-4">
        <SectionLabel>Керівник</SectionLabel>
        <FieldGrid>
          <Input label="Прізвище" value={data.managerLastName} onChange={(e) => set('managerLastName', e.target.value)} />
          <Input label="Ім'я" value={data.managerFirstName} onChange={(e) => set('managerFirstName', e.target.value)} />
          <Input label="По батькові" value={data.managerMiddleName} onChange={(e) => set('managerMiddleName', e.target.value)} />
          <Input label="Посада" value={data.managerPosition} onChange={(e) => set('managerPosition', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Власник */}
      <div className="grid gap-4">
        <SectionLabel>Власник</SectionLabel>
        <FieldGrid>
          <Input label="Назва" value={data.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
          <Input label="Код ЄДРПОУ" value={data.ownerEdrpou} onChange={(e) => set('ownerEdrpou', e.target.value)} placeholder="00000000" />
          <Input label="Адреса" value={data.ownerAddress} onChange={(e) => set('ownerAddress', e.target.value)} />
          <Input label="Основний вид діяльності" value={data.ownerActivity} onChange={(e) => set('ownerActivity', e.target.value)} />
        </FieldGrid>
      </div>
    </div>
  );
}

function Sub({ label }: { label: string }) {
  return <SectionLabel className="col-span-full mt-2">{label}</SectionLabel>;
}

function Step5Form({ data, onChange }: { data: Step5; onChange: (d: Step5) => void }) {
  function set(key: keyof Step5, value: string | boolean) {
    onChange({ ...data, [key]: value });
  }
  return (
    <div className="grid gap-6">

      {/* Будівля */}
      <div className="grid gap-4">
        <SectionLabel>Будівля</SectionLabel>
        <FieldGrid>
          <Input label="Реєстровий номер" value={data.buildingRegistryNumber} onChange={(e) => set('buildingRegistryNumber', e.target.value)} />
          <Input label="Дата технічної інвентаризації" type="date" value={data.buildingInventoryDate} onChange={(e) => set('buildingInventoryDate', e.target.value)} />
          <Input label="Назва БТІ" value={data.btiName} onChange={(e) => set('btiName', e.target.value)} />
          <Input label="Код призначення" value={data.purposeCode} onChange={(e) => set('purposeCode', e.target.value)} />
          <Input label="Назва призначення" value={data.purposeName} onChange={(e) => set('purposeName', e.target.value)} />
          <Input label="Призначення у мирний час" value={data.peacetimePurpose} onChange={(e) => set('peacetimePurpose', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Автор проєкту */}
      <div className="grid gap-4">
        <SectionLabel>Автор проєкту</SectionLabel>
        <FieldGrid>
          <Input label="Назва" value={data.designerName} onChange={(e) => set('designerName', e.target.value)} />
          <Input label="Код ЄДРПОУ" value={data.designerEdrpou} onChange={(e) => set('designerEdrpou', e.target.value)} />
          <Input label="Посилання на проєктну документацію" value={data.designDocLink} onChange={(e) => set('designDocLink', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Підрядник */}
      <div className="grid gap-4">
        <SectionLabel>Підрядник</SectionLabel>
        <FieldGrid>
          <Input label="Назва" value={data.contractorName} onChange={(e) => set('contractorName', e.target.value)} />
          <Input label="Код ЄДРПОУ" value={data.contractorEdrpou} onChange={(e) => set('contractorEdrpou', e.target.value)} />
        </FieldGrid>
        <Checkbox checked={data.isGeneralContractor} onChange={(v) => set('isGeneralContractor', v)} label="Ознака генерального підрядника" />
      </div>

      {/* Двері та ставні */}
      <div className="grid gap-4">
        <SectionLabel>Двері та ставні</SectionLabel>
        <FieldGrid>
          <Input label="Вид дверей / ставней" value={data.doorType} onChange={(e) => set('doorType', e.target.value)} />
          <Input label="Марка / Шифр" value={data.doorMark} onChange={(e) => set('doorMark', e.target.value)} />
          <Input label="Кількість" type="number" value={data.doorCount} onChange={(e) => set('doorCount', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Вентиляція */}
      <div className="grid gap-4">
        <SectionLabel>Технологічні системи — Вентиляція</SectionLabel>
        <Input label="Система вентиляції" value={data.ventilationSystem} onChange={(e) => set('ventilationSystem', e.target.value)} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Sub label="Вентилятор" />
          <Input label="Тип" value={data.fanType} onChange={(e) => set('fanType', e.target.value)} />
          <Input label="Продуктивність" value={data.fanCapacity} onChange={(e) => set('fanCapacity', e.target.value)} />
          <Input label="Кількість" type="number" value={data.fanCount} onChange={(e) => set('fanCount', e.target.value)} />

          <Sub label="Фільтри і засоби регенерації" />
          <Input label="Тип" value={data.filterType} onChange={(e) => set('filterType', e.target.value)} />
          <Input label="Кількість" type="number" value={data.filterCount} onChange={(e) => set('filterCount', e.target.value)} />

          <Sub label="Герметичні клапани" />
          <Input label="Тип" value={data.valveType} onChange={(e) => set('valveType', e.target.value)} />
          <Input label="Продуктивність" value={data.valveCapacity} onChange={(e) => set('valveCapacity', e.target.value)} />
          <Input label="Кількість" type="number" value={data.valveCount} onChange={(e) => set('valveCount', e.target.value)} />

          <Sub label="Противибухові пристрої" />
          <Input label="Тип" value={data.antiBlastType} onChange={(e) => set('antiBlastType', e.target.value)} />
          <Input label="Кількість" type="number" value={data.antiBlastCount} onChange={(e) => set('antiBlastCount', e.target.value)} />

          <Sub label="Насоси" />
          <Input label="Тип" value={data.pumpType} onChange={(e) => set('pumpType', e.target.value)} />
          <Input label="Продуктивність" value={data.pumpCapacity} onChange={(e) => set('pumpCapacity', e.target.value)} />
          <Input label="Кількість" type="number" value={data.pumpCount} onChange={(e) => set('pumpCount', e.target.value)} />

          <Sub label="Калорифери / Повітроохолоджувачі" />
          <Input label="Тип" value={data.heaterType} onChange={(e) => set('heaterType', e.target.value)} />
          <Input label="Продуктивність" value={data.heaterCapacity} onChange={(e) => set('heaterCapacity', e.target.value)} />
          <Input label="Кількість" type="number" value={data.heaterCount} onChange={(e) => set('heaterCount', e.target.value)} />

          <Sub label="Холодильні машини" />
          <Input label="Тип" value={data.coolingType} onChange={(e) => set('coolingType', e.target.value)} />
          <Input label="Продуктивність" value={data.coolingCapacity} onChange={(e) => set('coolingCapacity', e.target.value)} />
          <Input label="Кількість" type="number" value={data.coolingCount} onChange={(e) => set('coolingCount', e.target.value)} />

          <Sub label="Вимірювальні прилади" />
          <Input label="Тип" value={data.measuringType} onChange={(e) => set('measuringType', e.target.value)} />
          <Input label="Кількість" type="number" value={data.measuringCount} onChange={(e) => set('measuringCount', e.target.value)} />
        </div>
        <Input label="Ступінь герметичності" value={data.sealingDegree} onChange={(e) => set('sealingDegree', e.target.value)} />
      </div>

      {/* Електроживлення */}
      <div className="grid gap-4">
        <SectionLabel>Електроживлення</SectionLabel>
        <FieldGrid>
          <Input label="Джерело основного електропостачання" value={data.mainPowerSource} onChange={(e) => set('mainPowerSource', e.target.value)} />
          <Input label="Категорія надійності електропостачання" value={data.powerReliabilityCategory} onChange={(e) => set('powerReliabilityCategory', e.target.value)} />
          <Input label="Освітлення" value={data.lighting} onChange={(e) => set('lighting', e.target.value)} />
          <Input label="Резервне / аварійне електропостачання" value={data.backupPower} onChange={(e) => set('backupPower', e.target.value)} />
          <Input label="Електроживлення інженерних систем" value={data.engineeringPower} onChange={(e) => set('engineeringPower', e.target.value)} />
          <Input label="Захист електромереж" value={data.powerProtection} onChange={(e) => set('powerProtection', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Водопостачання */}
      <div className="grid gap-4">
        <SectionLabel>Водопостачання</SectionLabel>
        <Checkbox checked={data.hasWaterSupply} onChange={(v) => set('hasWaterSupply', v)} label="Наявність системи водопостачання" />
        <FieldGrid>
          <Input label="Джерело водопостачання" value={data.waterSource} onChange={(e) => set('waterSource', e.target.value)} />
          <Input label="Призначення води" value={data.waterPurpose} onChange={(e) => set('waterPurpose', e.target.value)} />
          <Input label="Запас води у" value={data.waterReserveLocation} onChange={(e) => set('waterReserveLocation', e.target.value)} />
          <Input label="Ємність запасу води, л" type="number" value={data.waterCapacityLiters} onChange={(e) => set('waterCapacityLiters', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Каналізація */}
      <div className="grid gap-4">
        <SectionLabel>Каналізація</SectionLabel>
        <FieldGrid>
          <Input label="Тип системи каналізації" value={data.sewageSystemType} onChange={(e) => set('sewageSystemType', e.target.value)} />
          <Input label="Вид системи каналізації" value={data.sewageSystemKind} onChange={(e) => set('sewageSystemKind', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Опалення */}
      <div className="grid gap-4">
        <SectionLabel>Опалення</SectionLabel>
        <FieldGrid>
          <Input label="Клас" value={data.heatingClass} onChange={(e) => set('heatingClass', e.target.value)} />
          <Input label="Підклас" value={data.heatingSubclass} onChange={(e) => set('heatingSubclass', e.target.value)} />
          <Input label="Тип" value={data.heatingType} onChange={(e) => set('heatingType', e.target.value)} />
        </FieldGrid>
      </div>

      {/* Засоби зв'язку */}
      <div className="grid gap-4">
        <SectionLabel>Засоби зв'язку</SectionLabel>
        <Input label="Засоби зв'язку" value={data.communicationMeans} onChange={(e) => set('communicationMeans', e.target.value)} />
        <Checkbox checked={data.hasRadioPoint} onChange={(v) => set('hasRadioPoint', v)} label="Радіоточка" />
      </div>

      {/* Інше майно */}
      <div className="grid gap-4">
        <SectionLabel>Інше майно</SectionLabel>
        <FieldGrid>
          <Input label="Тип" value={data.otherPropertyType} onChange={(e) => set('otherPropertyType', e.target.value)} />
          <Input label="Найменування" value={data.otherPropertyName} onChange={(e) => set('otherPropertyName', e.target.value)} />
          <Input label="Кількість" type="number" value={data.otherPropertyCount} onChange={(e) => set('otherPropertyCount', e.target.value)} />
        </FieldGrid>
      </div>

    </div>
  );
}

function Step6Form({
  data,
  onChange,
}: {
  data: Step6;
  onChange: (d: Step6) => void;
}) {
  function set(key: keyof Step6, value: string) {
    onChange({ ...data, [key]: value });
  }
  return (
    <div className="grid gap-4">
      <FieldGrid>
        <Input
          label="Дата останнього огляду"
          type="date"
          value={data.lastInspectionDate}
          onChange={(e) => set('lastInspectionDate', e.target.value)}
        />
        <Input
          label="Інспектор"
          value={data.inspector}
          onChange={(e) => set('inspector', e.target.value)}
        />
        <Select
          label="Результат огляду"
          value={data.inspectionResult}
          onChange={(e) => set('inspectionResult', e.target.value)}
          placeholder="Оберіть результат"
          options={[
            { value: 'PASSED', label: 'Пройдено' },
            { value: 'CONDITIONAL', label: 'Умовно пройдено' },
            { value: 'FAILED', label: 'Не пройдено' },
          ]}
        />
        <Input
          label="Дата наступного планового огляду"
          type="date"
          value={data.nextInspectionDate}
          onChange={(e) => set('nextInspectionDate', e.target.value)}
        />
      </FieldGrid>
      <Textarea
        label="Виявлені порушення"
        value={data.violations}
        onChange={(e) => set('violations', e.target.value)}
      />
      <Textarea
        label="Коментарі інспектора"
        value={data.inspectorComments}
        onChange={(e) => set('inspectorComments', e.target.value)}
      />
    </div>
  );
}

function Step7Form({
  data,
  onChange,
}: {
  data: Step7;
  onChange: (d: Step7) => void;
}) {
  function set(key: keyof Step7, value: string) {
    onChange({ ...data, [key]: value });
  }

  const docFields: { label: string; numKey: keyof Step7; dateKey: keyof Step7 }[] = [
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
    <div className="grid gap-5">
      {docFields.map(({ label, numKey, dateKey }) => (
        <div key={numKey}>
          <p className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            {label}
          </p>
          <FieldGrid>
            <Input
              label="Номер"
              value={data[numKey] as string}
              onChange={(e) => set(numKey, e.target.value)}
            />
            <Input
              label="Дата"
              type="date"
              value={data[dateKey] as string}
              onChange={(e) => set(dateKey, e.target.value)}
            />
          </FieldGrid>
        </div>
      ))}
      <Textarea
        label="Примітки щодо документів"
        value={data.documentNotes}
        onChange={(e) => set('documentNotes', e.target.value)}
      />
    </div>
  );
}

function Step8Form({
  data,
  onChange,
}: {
  data: Step8;
  onChange: (d: Step8) => void;
}) {
  function set(key: keyof Step8, value: string) {
    onChange({ ...data, [key]: value });
  }
  return (
    <div className="grid gap-4">
      <FieldGrid>
        <Input
          label="Балансова вартість, грн"
          type="number"
          value={data.balanceValue}
          onChange={(e) => set('balanceValue', e.target.value)}
        />
        <Input
          label="Щорічні витрати на обслуговування, грн"
          type="number"
          value={data.annualMaintenanceCost}
          onChange={(e) => set('annualMaintenanceCost', e.target.value)}
        />
        <Select
          label="Джерело фінансування"
          value={data.fundingSource}
          onChange={(e) => set('fundingSource', e.target.value)}
          placeholder="Оберіть джерело"
          options={[
            { value: 'STATE_BUDGET', label: 'Держбюджет' },
            { value: 'LOCAL_BUDGET', label: 'Місцевий бюджет' },
            { value: 'PRIVATE', label: 'Власні кошти' },
            { value: 'MIXED', label: 'Змішане' },
          ]}
        />
        <Input
          label="Бюджетний код"
          value={data.budgetCode}
          onChange={(e) => set('budgetCode', e.target.value)}
        />
        <Input
          label="Дата останньої оцінки вартості"
          type="date"
          value={data.lastValuationDate}
          onChange={(e) => set('lastValuationDate', e.target.value)}
        />
      </FieldGrid>
    </div>
  );
}

function Step9Form({
  data,
  onChange,
}: {
  data: Step9;
  onChange: (d: Step9) => void;
}) {
  async function readFileAsDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('Не вдалося прочитати файл'));
      reader.readAsDataURL(file);
    });
  }

  function setMedia(media: ShelterMedia[]) {
    onChange({ ...data, media });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const items = await Promise.all(
      Array.from(files).map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
        role: 'UNASSIGNED' as MediaRole,
      }))
    );

    setMedia([...data.media, ...items]);
  }

  function updateRole(id: string, role: MediaRole) {
    setMedia(
      data.media.map((item) => {
        if (item.id === id) {
          return { ...item, role };
        }

        if (role !== 'UNASSIGNED' && item.role === role) {
          return { ...item, role: 'UNASSIGNED' };
        }

        return item;
      })
    );
  }

  function removeMedia(id: string) {
    setMedia(data.media.filter((item) => item.id !== id));
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-4">
        <SectionLabel>Медіа</SectionLabel>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          Завантажте фото укриття і позначте одне як фото фасаду та одне як фото входу.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--hover)] px-4 py-2 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-md)]">
            Додати фото
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => void handleFiles(event.target.files)}
            />
          </label>
          <span className="text-[12px] text-[var(--text-muted)]">
            {data.media.length} файлів у списку
          </span>
        </div>
      </div>

      {data.media.length > 0 ? (
        <div className="grid gap-4">
          {data.media.map((item) => (
            <div
              key={item.id}
              className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:grid-cols-[180px_minmax(0,1fr)]"
            >
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/20">
                <img
                  src={item.dataUrl}
                  alt={item.name}
                  className="h-40 w-full object-cover"
                />
              </div>

              <div className="grid gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{item.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {item.mimeType || 'image'} · {(item.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeMedia(item.id)}>
                    Видалити
                  </Button>
                </div>

                <FieldGrid>
                  <Select
                    label="Призначення"
                    value={item.role}
                    onChange={(event) => updateRole(item.id, event.target.value as MediaRole)}
                    placeholder="Оберіть роль"
                    options={[
                      { value: 'UNASSIGNED', label: 'Не призначено' },
                      { value: 'FACADE', label: 'Фото фасаду' },
                      { value: 'ENTRANCE', label: 'Фото входу' },
                    ]}
                  />
                </FieldGrid>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Фото ще не додані. Після завантаження тут з’являться прев’ю та вибір ролі.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── Main Wizard page ──────────────────────────────────────────────────────────

export default function NewShelterRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-6 text-[13px] text-[var(--text-secondary)]">
          Завантаження форми...
        </div>
      }
    >
      <NewShelterRequestContent />
    </Suspense>
  );
}

function NewShelterRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<WizardState>(() => buildStateFromProposal(readProposalPrefill(searchParams)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('');
  const [validationWarning, setValidationWarning] = useState<ValidationWarning | null>(null);
  const canCreate = canCreateShelterRequest(role);
  const invalidSteps = getInvalidSteps(state);

  useEffect(() => {
    setRole(getStoredAuth()?.user.role ?? '');
  }, []);

  function updateStep<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function loadDemo() {
    setState(DEMO_STATE);
    setCurrentStep(1);
    setValidationWarning(null);
  }

  function goNext() {
    const missing = getMissingRequiredFields(currentStep, state);
    if (missing.length > 0) {
      setValidationWarning({ step: currentStep, missing });
      return;
    }

    if (currentStep < 9) {
      setCurrentStep((s) => s + 1);
      setValidationWarning(null);
    }
  }

  function goBack() {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }

  async function handleSubmit() {
    if (!canCreate) {
      setError('Створювати пропозиції можуть лише BALANCE_HOLDER або GOV_ORG.');
      return;
    }

    const missingRequiredFields = [1, 2, 3].flatMap((step) => getMissingRequiredFields(step, state));

    if (missingRequiredFields.length > 0) {
      setError(`Обов'язкові поля не заповнені: ${missingRequiredFields.join(', ')}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name: state.step1.name,
        capacity: state.step3.capacity ? Number(state.step3.capacity) : undefined,
        latitude: state.step2.latCenter ? Number(state.step2.latCenter) : undefined,
        longitude: state.step2.lonCenter ? Number(state.step2.lonCenter) : undefined,
        address: [state.step2.streetType, state.step2.streetName, state.step2.building].filter(Boolean).join(' ') || undefined,
        // Розділ 1 — Основні параметри
        accountNumber: state.step1.accountNumber || undefined,
        tempNumber: state.step1.tempNumber || undefined,
        technicalNumber: state.step1.technicalNumber || undefined,
        registrationDate: state.step1.registrationDate || undefined,
        region: state.step1.region || undefined,
        type: state.step1.shelterKind || undefined,
        accessType: state.step1.accessType || undefined,
        shelterStatus: state.step1.shelterStatus || undefined,
        shelterStatusDate: state.step1.shelterStatusDate || undefined,
        accountingStatus: state.step1.accountingStatus || undefined,
        accountingStatusDate: state.step1.accountingStatusDate || undefined,
        recordStatus: state.step1.recordStatus || undefined,
        recordStatusDate: state.step1.recordStatusDate || undefined,
        isPublished: state.step1.isPublished,
        responsible: state.step1.responsible || undefined,
        // Розділ 2 — Розташування та доступність
        country: state.step2.country || undefined,
        district: state.step2.district || undefined,
        community: state.step2.community || undefined,
        settlement: state.step2.settlement || undefined,
        settlementType: state.step2.settlementType || undefined,
        streetType: state.step2.streetType || undefined,
        streetName: state.step2.streetName || undefined,
        building: state.step2.building || undefined,
        corpus: state.step2.corpus || undefined,
        apartment: state.step2.apartment || undefined,
        postalCode: state.step2.postalCode || undefined,
        katottg: state.step2.katottg || undefined,
        latEntrance: state.step2.latEntrance ? Number(state.step2.latEntrance) : undefined,
        lonEntrance: state.step2.lonEntrance ? Number(state.step2.lonEntrance) : undefined,
        latCenter: state.step2.latCenter ? Number(state.step2.latCenter) : undefined,
        lonCenter: state.step2.lonCenter ? Number(state.step2.lonCenter) : undefined,
        walkRadius: state.step2.walkRadius ? Number(state.step2.walkRadius) : undefined,
        relativeLocation: state.step2.relativeLocation || undefined,
        areaDescription: state.step2.areaDescription || undefined,
        dangerZones: state.step2.dangerZones || undefined,
        // Розділ 3 — Характеристики укриття
        alwaysReady: state.step3.alwaysReady,
        readinessTime: state.step3.readinessTime ? Number(state.step3.readinessTime) : undefined,
        populationCategories: state.step3.populationCategories || undefined,
        area: state.step3.area ? Number(state.step3.area) : undefined,
        volume: state.step3.volume ? Number(state.step3.volume) : undefined,
        accessibleForDisabled: state.step3.accessibleForDisabled,
        barrierFreeAccess: state.step3.barrierFreeAccess,
        shelterClass: state.step3.shelterClass || undefined,
        floorsCount: state.step3.floorsCount ? Number(state.step3.floorsCount) : undefined,
        entrancesCount: state.step3.entrancesCount ? Number(state.step3.entrancesCount) : undefined,
        emergencyExitsCount: state.step3.emergencyExitsCount ? Number(state.step3.emergencyExitsCount) : undefined,
        // Розділ 4 — Власність та відповідальність
        ownershipForm: state.step4.ownershipForm || undefined,
        departmentalAffiliation: state.step4.departmentalAffiliation || undefined,
        governmentBody: state.step4.governmentBody || undefined,
        institution: state.step4.institution || undefined,
        balanceHolder: state.step4.balanceHolder || undefined,
        operationalManagementForm: state.step4.operationalManagementForm || undefined,
        operationStartDate: state.step4.operationStartDate || undefined,
        orgName: state.step4.orgName || undefined,
        orgEdrpou: state.step4.orgEdrpou || undefined,
        orgAddress: state.step4.orgAddress || undefined,
        orgActivity: state.step4.orgActivity || undefined,
        contactLastName: state.step4.contactLastName || undefined,
        contactFirstName: state.step4.contactFirstName || undefined,
        contactMiddleName: state.step4.contactMiddleName || undefined,
        contactPosition: state.step4.contactPosition || undefined,
        contactPhone: state.step4.contactPhone || undefined,
        contactEmail: state.step4.contactEmail || undefined,
        contactIsCurrent: state.step4.contactIsCurrent,
        managerLastName: state.step4.managerLastName || undefined,
        managerFirstName: state.step4.managerFirstName || undefined,
        managerMiddleName: state.step4.managerMiddleName || undefined,
        managerPosition: state.step4.managerPosition || undefined,
        ownerName: state.step4.ownerName || undefined,
        ownerEdrpou: state.step4.ownerEdrpou || undefined,
        ownerAddress: state.step4.ownerAddress || undefined,
        ownerActivity: state.step4.ownerActivity || undefined,
        // Розділ 5 — Технічна інвентаризація та інженерні системи
        buildingRegistryNumber: state.step5.buildingRegistryNumber || undefined,
        buildingInventoryDate: state.step5.buildingInventoryDate || undefined,
        btiName: state.step5.btiName || undefined,
        purposeCode: state.step5.purposeCode || undefined,
        purposeName: state.step5.purposeName || undefined,
        peacetimePurpose: state.step5.peacetimePurpose || undefined,
        designerName: state.step5.designerName || undefined,
        designerEdrpou: state.step5.designerEdrpou || undefined,
        designDocLink: state.step5.designDocLink || undefined,
        contractorName: state.step5.contractorName || undefined,
        contractorEdrpou: state.step5.contractorEdrpou || undefined,
        isGeneralContractor: state.step5.isGeneralContractor,
        doorType: state.step5.doorType || undefined,
        doorMark: state.step5.doorMark || undefined,
        doorCount: state.step5.doorCount ? Number(state.step5.doorCount) : undefined,
        ventilationSystem: state.step5.ventilationSystem || undefined,
        fanType: state.step5.fanType || undefined,
        fanCapacity: state.step5.fanCapacity || undefined,
        fanCount: state.step5.fanCount ? Number(state.step5.fanCount) : undefined,
        filterType: state.step5.filterType || undefined,
        filterCount: state.step5.filterCount ? Number(state.step5.filterCount) : undefined,
        valveType: state.step5.valveType || undefined,
        valveCapacity: state.step5.valveCapacity || undefined,
        valveCount: state.step5.valveCount ? Number(state.step5.valveCount) : undefined,
        antiBlastType: state.step5.antiBlastType || undefined,
        antiBlastCount: state.step5.antiBlastCount ? Number(state.step5.antiBlastCount) : undefined,
        pumpType: state.step5.pumpType || undefined,
        pumpCapacity: state.step5.pumpCapacity || undefined,
        pumpCount: state.step5.pumpCount ? Number(state.step5.pumpCount) : undefined,
        heaterType: state.step5.heaterType || undefined,
        heaterCapacity: state.step5.heaterCapacity || undefined,
        heaterCount: state.step5.heaterCount ? Number(state.step5.heaterCount) : undefined,
        coolingType: state.step5.coolingType || undefined,
        coolingCapacity: state.step5.coolingCapacity || undefined,
        coolingCount: state.step5.coolingCount ? Number(state.step5.coolingCount) : undefined,
        measuringType: state.step5.measuringType || undefined,
        measuringCount: state.step5.measuringCount ? Number(state.step5.measuringCount) : undefined,
        sealingDegree: state.step5.sealingDegree || undefined,
        mainPowerSource: state.step5.mainPowerSource || undefined,
        powerReliabilityCategory: state.step5.powerReliabilityCategory || undefined,
        lighting: state.step5.lighting || undefined,
        backupPower: state.step5.backupPower || undefined,
        engineeringPower: state.step5.engineeringPower || undefined,
        powerProtection: state.step5.powerProtection || undefined,
        hasWaterSupply: state.step5.hasWaterSupply,
        waterSource: state.step5.waterSource || undefined,
        waterPurpose: state.step5.waterPurpose || undefined,
        waterReserveLocation: state.step5.waterReserveLocation || undefined,
        waterCapacityLiters: state.step5.waterCapacityLiters ? Number(state.step5.waterCapacityLiters) : undefined,
        sewageSystemType: state.step5.sewageSystemType || undefined,
        sewageSystemKind: state.step5.sewageSystemKind || undefined,
        heatingClass: state.step5.heatingClass || undefined,
        heatingSubclass: state.step5.heatingSubclass || undefined,
        heatingType: state.step5.heatingType || undefined,
        communicationMeans: state.step5.communicationMeans || undefined,
        hasRadioPoint: state.step5.hasRadioPoint,
        otherPropertyType: state.step5.otherPropertyType || undefined,
        otherPropertyName: state.step5.otherPropertyName || undefined,
        otherPropertyCount: state.step5.otherPropertyCount ? Number(state.step5.otherPropertyCount) : undefined,
        lastInspectionDate: state.step6.lastInspectionDate || undefined,
        inspector: state.step6.inspector || undefined,
        inspectionResult: state.step6.inspectionResult || undefined,
        nextInspectionDate: state.step6.nextInspectionDate || undefined,
        violations: state.step6.violations || undefined,
        inspectorComments: state.step6.inspectorComments || undefined,
        technicalPassportNumber: state.step7.technicalPassportNumber || undefined,
        technicalPassportDate: state.step7.technicalPassportDate || undefined,
        acceptanceActNumber: state.step7.acceptanceActNumber || undefined,
        acceptanceActDate: state.step7.acceptanceActDate || undefined,
        operationPermitNumber: state.step7.operationPermitNumber || undefined,
        operationPermitDate: state.step7.operationPermitDate || undefined,
        insurancePolicyNumber: state.step7.insurancePolicyNumber || undefined,
        insurancePolicyDate: state.step7.insurancePolicyDate || undefined,
        documentNotes: state.step7.documentNotes || undefined,
        balanceValue: state.step8.balanceValue ? Number(state.step8.balanceValue) : undefined,
        annualMaintenanceCost: state.step8.annualMaintenanceCost
          ? Number(state.step8.annualMaintenanceCost)
          : undefined,
        fundingSource: state.step8.fundingSource || undefined,
        budgetCode: state.step8.budgetCode || undefined,
        lastValuationDate: state.step8.lastValuationDate || undefined,
        media: state.step9.media.length
          ? state.step9.media.map(({ id, name, dataUrl, mimeType, size, role }) => ({
              id,
              name,
              dataUrl,
              mimeType,
              size,
              role,
            }))
          : undefined,
      };

      await apiFetch<{ id: string }>('/shelter-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push('/shelter-requests');
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Помилка створення пропозиції'
      );
    } finally {
      setLoading(false);
    }
  }

  const stepTitles = [
    'Основні параметри',
    'Розташування та доступність',
    'Характеристики укриття',
    'Власність та відповідальність',
    'Технічна інвентаризація',
    'Огляд',
    'Документи',
    'Фінанси',
    'Медіа',
  ];
  const stepCardMigraProps =
    currentStep === 1
      ? {
          'data-migra-component': 'Form/RequestBasics',
          'data-migra-props': JSON.stringify({
            title: `Крок ${currentStep} з 9 — ${stepTitles[currentStep - 1]}`,
            fields: buildStep1MigraFields(state.step1),
          }),
        }
      : {};

  return (
    <AppShell>
      <PageHeader
        title="Нова пропозиція на укриття"
        subtitle="Реєстр / Пропрозиції / Нова"
        actions={
          <Button variant="ghost" size="md" onClick={loadDemo}>
            Демо дані
          </Button>
        }
      />

      <div className="px-6 pt-2">
        <p className="text-[11px] text-[var(--text-secondary)]">
          Поля з <span className="text-[var(--color-danger)]">*</span> є обов&apos;язковими.
        </p>
      </div>

      {!canCreate ? (
        <div className="px-6 pt-4">
          <Card>
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">Недостатньо прав</p>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Ця форма доступна лише для BALANCE_HOLDER та GOV_ORG. Зараз ви можете переглядати пропозиції, але не створювати їх.
            </p>
          </Card>
        </div>
      ) : null}

      <Stepper current={currentStep} total={9} invalidSteps={invalidSteps} />

      {validationWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md">
            <Card
              padding="lg"
              data-migra-component="Dialog/ValidationWarning"
              data-migra-props={JSON.stringify({
                severity: 'warning',
                title: 'обовʼязкові поля не заповнені',
                message: `Заповніть: ${validationWarning.missing.join(', ')}.`,
                secondaryAction: 'закрити',
                primaryAction: 'продовжити',
              })}
            >
              <Alert severity="warning">
                <p className="text-[12px] font-semibold text-[var(--text-primary)]">обовʼязкові поля не заповнені</p>
                <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
                  Заповніть: {validationWarning.missing.join(', ')}.
                </p>
              </Alert>
              <div className="mt-4 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setValidationWarning(null)}>
                  закрити
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setValidationWarning(null);
                    if (validationWarning.step < 9) {
                      setCurrentStep((s) => Math.min(s + 1, 9));
                    }
                  }}
                >
                  продовжити
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl flex flex-col gap-6">
          {error && (
            <Alert severity="danger">{error}</Alert>
          )}

          <Card padding="lg" {...stepCardMigraProps}>
            <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">
              Крок {currentStep} з 9 — {stepTitles[currentStep - 1]}
            </p>

            {currentStep === 1 && (
              <Step1Form data={state.step1} onChange={(d) => updateStep('step1', d)} />
            )}
            {currentStep === 2 && (
              <Step2Form data={state.step2} onChange={(d) => updateStep('step2', d)} />
            )}
            {currentStep === 3 && (
              <Step3Form data={state.step3} onChange={(d) => updateStep('step3', d)} />
            )}
            {currentStep === 4 && (
              <Step4Form data={state.step4} onChange={(d) => updateStep('step4', d)} />
            )}
            {currentStep === 5 && (
              <Step5Form data={state.step5} onChange={(d) => updateStep('step5', d)} />
            )}
            {currentStep === 6 && (
              <Step6Form data={state.step6} onChange={(d) => updateStep('step6', d)} />
            )}
            {currentStep === 7 && (
              <Step7Form data={state.step7} onChange={(d) => updateStep('step7', d)} />
            )}
            {currentStep === 8 && (
              <Step8Form data={state.step8} onChange={(d) => updateStep('step8', d)} />
            )}
            {currentStep === 9 && (
              <Step9Form data={state.step9} onChange={(d) => updateStep('step9', d)} />
            )}
          </Card>

          {/* Footer navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={goBack}
              disabled={currentStep === 1}
            >
              Назад
            </Button>

            {currentStep < 9 ? (
              <Button variant="primary" onClick={goNext}>
                Далі →
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={loading}
                onClick={() => void handleSubmit()}
              >
                Подати заявку
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
