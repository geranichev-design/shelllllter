'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Bookmark,
  CalendarDays,
  CalendarPlus,
  Check,
  ClipboardCheck,
  Clock,
  Eye,
  Filter,
  LineChart,
  MapPin,
  MessageSquare,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { AppShell } from '@/app/components/AppShell';
import { Badge, Button, Card, DropdownButton, EmptyState, Input, Select, SectionLabel, Textarea, ToggleButton } from '@repo/ui';
import { InspectionHeader } from './InspectionHeader';

type InspectionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CONFIRMED';
type ApprovalStage = 'SUBMITTED' | 'REMARKS' | 'REJECTED' | 'APPROVED' | 'PUBLISHED';
type InspectionType = 'PLANNED' | 'UNPLANNED' | 'CONTROL';
type DateBasis = 'LAST_PLANNED_START' | 'LAST_PLANNED_END' | 'LAST_ANY_END';
type SortKey = 'shelterNumber' | 'shelterType' | 'shelterAddress' | 'inspectionStatus' | 'approvalStage' | 'dateMonth' | 'monthsSinceReference';
type PlanWorkflowStage = 'empty' | 'parameters' | 'draft' | 'approval' | 'approved' | 'published';

interface PlannedInspection {
  id: string;
  shelterId: string;
  shelterNumber: string;
  shelterType: string;
  shelterAddress: string;
  region: string;
  type: InspectionType;
  inspectionStatus: InspectionStatus;
  approvalStage: ApprovalStage;
  dateMonth: string;
  basis: DateBasis;
  basisLabel: string;
  referenceDate: string;
  referenceLabel: string;
  originalDateMonth?: string;
  cancelled?: boolean;
  comment?: string;
}

interface ShelterPlanningSource {
  id: string;
  shelterNumber: string;
  shelterType: string;
  shelterAddress: string;
  region: string;
  lastPlannedStart: string;
  lastPlannedEnd: string;
  lastAnyEnd: string;
}

interface PublishedPlanRecord {
  id: string;
  title: string;
  year: string;
  basis: DateBasis;
  current: boolean;
  createdBy: string;
  createdAt: string;
  approvedBy: string;
  approvedAt: string;
  publishedBy: string;
  publishedAt: string;
  inspections: PlannedInspection[];
}

const SHELTER_PLANNING_SOURCES: ShelterPlanningSource[] = [
  {
    id: 'kyiv-1',
    shelterNumber: '001-КВ',
    shelterType: 'Сховище',
    shelterAddress: 'м. Київ, вул. Хрещатик, 1',
    region: 'Київ',
    lastPlannedStart: '2025-06-04',
    lastPlannedEnd: '2025-06-05',
    lastAnyEnd: '2025-11-18',
  },
  {
    id: 'kyiv-2',
    shelterNumber: '002-КВ',
    shelterType: 'Протирадіаційне укриття',
    shelterAddress: 'м. Київ, вул. Лесі Українки, 26',
    region: 'Київ',
    lastPlannedStart: '2025-06-11',
    lastPlannedEnd: '2025-06-12',
    lastAnyEnd: '2025-06-12',
  },
  {
    id: 'kyiv-3',
    shelterNumber: '003-КВ',
    shelterType: 'Найпростіше укриття',
    shelterAddress: 'м. Київ, вул. Городецького, 5',
    region: 'Київ',
    lastPlannedStart: '2025-06-18',
    lastPlannedEnd: '2025-06-19',
    lastAnyEnd: '2025-10-02',
  },
  {
    id: 'kyiv-4',
    shelterNumber: '004-КВ',
    shelterType: 'Сховище',
    shelterAddress: 'м. Київ, пр. Перемоги, 50',
    region: 'Київ',
    lastPlannedStart: '2025-07-02',
    lastPlannedEnd: '2025-07-03',
    lastAnyEnd: '2025-12-09',
  },
  {
    id: 'kharkiv-5',
    shelterNumber: '005-ХА',
    shelterType: 'Протирадіаційне укриття',
    shelterAddress: 'Харківська обл., м. Харків, вул. Б. Хмельницького, 3',
    region: 'Харківська',
    lastPlannedStart: '2025-07-03',
    lastPlannedEnd: '2025-07-04',
    lastAnyEnd: '2025-07-04',
  },
  {
    id: 'kharkiv-6',
    shelterNumber: '006-ХА',
    shelterType: 'Найпростіше укриття',
    shelterAddress: 'Харківська обл., м. Харків, пл. Свободи, 7',
    region: 'Харківська',
    lastPlannedStart: '2025-07-09',
    lastPlannedEnd: '2025-07-10',
    lastAnyEnd: '2025-09-15',
  },
  {
    id: 'lviv-7',
    shelterNumber: '007-ЛВ',
    shelterType: 'Сховище',
    shelterAddress: 'Львівська обл., м. Львів, вул. Шевченка, 12',
    region: 'Львівська',
    lastPlannedStart: '2025-05-15',
    lastPlannedEnd: '2025-05-16',
    lastAnyEnd: '2025-05-16',
  },
  {
    id: 'lviv-8',
    shelterNumber: '008-ЛВ',
    shelterType: 'Протирадіаційне укриття',
    shelterAddress: 'Львівська обл., м. Львів, вул. Городоцька, 9',
    region: 'Львівська',
    lastPlannedStart: '2025-05-21',
    lastPlannedEnd: '2025-05-22',
    lastAnyEnd: '2025-08-30',
  },
];

const REGIONS = [
  { value: '', label: 'Вся Україна' },
  { value: 'Київ', label: 'м. Київ' },
  { value: 'Харківська', label: 'Харківська обл.' },
  { value: 'Львівська', label: 'Львівська обл.' },
];

function regionLabel(region: string) {
  return REGIONS.find((option) => option.value === region)?.label ?? region;
}

const INSPECTION_TYPE_OPTIONS = [
  { value: 'PLANNED', label: 'Планове' },
  { value: 'UNPLANNED', label: 'Позапланове' },
  { value: 'CONTROL', label: 'Контрольне' },
];

const DATE_BASIS_OPTIONS: { value: DateBasis; label: string; referenceLabel: string }[] = [
  {
    value: 'LAST_PLANNED_START',
    label: 'Дата початку останнього планового обстеження',
    referenceLabel: 'Від попереднього планового обстеження',
  },
  {
    value: 'LAST_PLANNED_END',
    label: 'Дата закінчення останнього планового обстеження',
    referenceLabel: 'Від попереднього планового обстеження',
  },
  {
    value: 'LAST_ANY_END',
    label: 'Дата закінчення останнього обстеження без урахування виду',
    referenceLabel: 'Від попереднього фактичного обстеження',
  },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2].map((year) => ({
  value: String(year),
  label: String(year),
}));

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

const INSPECTION_STATUS_OPTIONS = [
  { value: '', label: 'Усі статуси огляду' },
  { value: 'PLANNED', label: 'Заплановане' },
  { value: 'IN_PROGRESS', label: 'Виконується' },
  { value: 'COMPLETED', label: 'Завершено' },
  { value: 'CONFIRMED', label: 'Підтверджено' },
];

const APPROVAL_STAGE_OPTIONS = [
  { value: '', label: 'Усі стадії погодження' },
  { value: 'SUBMITTED', label: 'Заплановані' },
  { value: 'REMARKS', label: 'З пропозиціями щодо зміни' },
  { value: 'REJECTED', label: 'З відхиленими пропозиціями' },
  { value: 'APPROVED', label: 'Погоджені' },
  { value: 'PUBLISHED', label: 'Опубліковані' },
];

const SORT_OPTIONS = [
  { value: 'dateMonth', label: 'Дата обстеження' },
  { value: 'shelterNumber', label: 'Номер укриття' },
  { value: 'shelterType', label: 'Тип укриття' },
  { value: 'shelterAddress', label: 'Адреса' },
  { value: 'inspectionStatus', label: 'Статус огляду' },
  { value: 'approvalStage', label: 'Стадія погодження' },
  { value: 'monthsSinceReference', label: 'Строк від попереднього' },
];

const EMPTY_MONTH_OPTION = { value: '', label: 'Усі місяці' };

function inspectionStatusLabel(status: InspectionStatus) {
  const map: Record<InspectionStatus, string> = {
    PLANNED: 'Заплановане',
    IN_PROGRESS: 'Виконується',
    COMPLETED: 'Завершено',
    CONFIRMED: 'Підтверджено',
  };
  return map[status];
}

function inspectionStatusSeverity(status: InspectionStatus): 'ok' | 'warning' | 'neutral' | 'info' {
  const map: Record<InspectionStatus, 'ok' | 'warning' | 'neutral' | 'info'> = {
    PLANNED: 'info',
    IN_PROGRESS: 'warning',
    COMPLETED: 'neutral',
    CONFIRMED: 'ok',
  };
  return map[status];
}

function approvalStageLabel(stage: ApprovalStage) {
  const map: Record<ApprovalStage, string> = {
    SUBMITTED: 'Заплановані',
    REMARKS: 'З пропозиціями щодо зміни',
    REJECTED: 'З відхиленими пропозиціями',
    APPROVED: 'Погоджені',
    PUBLISHED: 'Опубліковані',
  };
  return map[stage];
}

function approvalStageSeverity(stage: ApprovalStage): 'ok' | 'warning' | 'neutral' | 'info' {
  const map: Record<ApprovalStage, 'ok' | 'warning' | 'neutral' | 'info'> = {
    SUBMITTED: 'info',
    REMARKS: 'warning',
    REJECTED: 'neutral',
    APPROVED: 'ok',
    PUBLISHED: 'neutral',
  };
  return map[stage];
}

function approvalStageIcon(stage: ApprovalStage) {
  if (stage === 'REMARKS') return <MessageSquare className="h-4 w-4 text-[var(--color-warning)]" />;
  if (stage === 'REJECTED') return <X className="h-4 w-4 text-[var(--text-muted)]" />;
  if (stage === 'APPROVED') return <ClipboardCheck className="h-4 w-4 text-[var(--accent)]" />;
  if (stage === 'PUBLISHED') return <Check className="h-4 w-4 text-[var(--text-secondary)]" />;
  return <Clock className="h-4 w-4 text-[var(--color-info)]" />;
}

function typeLabel(type: InspectionType) {
  const map: Record<InspectionType, string> = {
    PLANNED: 'Планове',
    UNPLANNED: 'Позапланове',
    CONTROL: 'Контрольне',
  };
  return map[type];
}

function getBasisOption(basis: DateBasis) {
  return DATE_BASIS_OPTIONS.find((option) => option.value === basis) ?? DATE_BASIS_OPTIONS[0];
}

function getBasisDate(source: ShelterPlanningSource, basis: DateBasis) {
  if (basis === 'LAST_PLANNED_START') return source.lastPlannedStart;
  if (basis === 'LAST_PLANNED_END') return source.lastPlannedEnd;
  return source.lastAnyEnd;
}

function dateToMonth(iso: string) {
  return iso.slice(0, 7);
}

function monthToDate(month: string) {
  return `${month}-01`;
}

function addMonths(month: string, months: number) {
  const date = new Date(monthToDate(month));
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 7);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatMonthYear(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${MONTHS[monthNumber - 1]} ${year}`;
}

function monthsSince(referenceDate: string, dateMonth: string) {
  const reference = new Date(referenceDate);
  const target = new Date(monthToDate(dateMonth));
  return (target.getFullYear() - reference.getFullYear()) * 12 + target.getMonth() - reference.getMonth();
}

function shiftDateToYear(iso: string, year: number) {
  const date = new Date(iso);
  date.setFullYear(year);
  return date.toISOString().slice(0, 10);
}

function monthOptionsForPlan(inspections: PlannedInspection[]) {
  const months = Array.from(new Set(inspections.map((inspection) => inspection.dateMonth))).sort();
  return [EMPTY_MONTH_OPTION, ...months.map((month) => ({ value: month, label: formatMonthYear(month) }))];
}

function monthOptionsForYear(dateMonth: string) {
  const year = dateMonth.slice(0, 4);
  return MONTHS.map((month, index) => {
    const value = `${year}-${String(index + 1).padStart(2, '0')}`;
    return { value, label: month };
  });
}

function shelterTypeOptionsForPlan(inspections: PlannedInspection[]) {
  const types = Array.from(new Set(inspections.map((inspection) => inspection.shelterType))).sort();
  return [{ value: '', label: 'Усі типи укриття' }, ...types.map((type) => ({ value: type, label: type }))];
}

function generateInspectionPlan(year: number, basis: DateBasis): PlannedInspection[] {
  const basisOption = getBasisOption(basis);

  return SHELTER_PLANNING_SOURCES.map((source, index): PlannedInspection => {
    const referenceDate = getBasisDate(source, basis);
    const plannedDate = shiftDateToYear(referenceDate, year);
    const dateMonth = addMonths(dateToMonth(plannedDate), index % 2);
    const hasComment = basis === 'LAST_ANY_END' && source.lastAnyEnd !== source.lastPlannedEnd;

    return {
      id: `plan-${year}-${basis}-${source.id}`,
      shelterId: source.id,
      shelterNumber: source.shelterNumber,
      shelterType: source.shelterType,
      shelterAddress: source.shelterAddress,
      region: source.region,
      type: 'PLANNED',
      inspectionStatus: 'PLANNED',
      approvalStage: hasComment ? 'REMARKS' : 'SUBMITTED',
      dateMonth,
      basis,
      basisLabel: basisOption.label,
      referenceDate,
      referenceLabel: basisOption.referenceLabel,
      comment: hasComment ? 'Є пізніше фактичне обстеження, дата плану зміщена від нього.' : '',
    };
  }).sort((a, b) => a.dateMonth.localeCompare(b.dateMonth) || a.shelterNumber.localeCompare(b.shelterNumber));
}

function applyPlanFilters({
  inspections,
  search,
  inspectionStatus,
  approvalStage,
  shelterType,
  month,
  sortKey,
  sortDirection,
}: {
  inspections: PlannedInspection[];
  search: string;
  inspectionStatus: string;
  approvalStage: string;
  shelterType: string;
  month: string;
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
}) {
  const q = search.trim().toLocaleLowerCase('uk-UA');

  const filtered = inspections.filter((inspection) => {
    const searchMatch =
      !q ||
      inspection.shelterNumber.toLocaleLowerCase('uk-UA').includes(q) ||
      inspection.shelterAddress.toLocaleLowerCase('uk-UA').includes(q) ||
      inspection.shelterType.toLocaleLowerCase('uk-UA').includes(q);
    const inspectionStatusMatch = !inspectionStatus || inspection.inspectionStatus === inspectionStatus;
    const approvalStageMatch = !approvalStage || inspection.approvalStage === approvalStage;
    const typeMatch = !shelterType || inspection.shelterType === shelterType;
    const monthMatch = !month || inspection.dateMonth === month;
    return searchMatch && inspectionStatusMatch && approvalStageMatch && typeMatch && monthMatch;
  });

  return [...filtered].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    if (sortKey === 'monthsSinceReference') {
      return (monthsSince(a.referenceDate, a.dateMonth) - monthsSince(b.referenceDate, b.dateMonth)) * direction;
    }

    const valueA = a[sortKey as Exclude<SortKey, 'monthsSinceReference'>];
    const valueB = b[sortKey as Exclude<SortKey, 'monthsSinceReference'>];
    return String(valueA).localeCompare(String(valueB), 'uk-UA') * direction;
  });
}

function InspectionSummaryDock({
  inspections,
  contextLabel,
  onMonthSelect,
}: {
  inspections: PlannedInspection[];
  contextLabel: string;
  onMonthSelect?: (month: string) => void;
}) {
  const [showChart, setShowChart] = useState(false);

  const counts = useMemo(
    () => ({
      total: inspections.length,
      remarks: inspections.filter((inspection) => inspection.approvalStage === 'REMARKS').length,
      rejected: inspections.filter((inspection) => inspection.approvalStage === 'REJECTED').length,
      approved: inspections.filter((inspection) => inspection.approvalStage === 'APPROVED').length,
      published: inspections.filter((inspection) => inspection.approvalStage === 'PUBLISHED').length,
    }),
    [inspections]
  );

  const items = [
    { key: 'total', label: 'Заплановано', value: counts.total, icon: <Clock className="h-4 w-4 text-[var(--color-info)]" /> },
    { key: 'remarks', label: 'З пропозиціями', value: counts.remarks, icon: approvalStageIcon('REMARKS') },
    { key: 'rejected', label: 'Відхилені пропозиції', value: counts.rejected, icon: approvalStageIcon('REJECTED') },
    { key: 'approved', label: 'Погоджено', value: counts.approved, icon: approvalStageIcon('APPROVED') },
    { key: 'published', label: 'Опубліковано', value: counts.published, icon: approvalStageIcon('PUBLISHED') },
  ];

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 md:left-[248px]">
      <div className="mx-auto max-w-7xl">
        {showChart && (
          <div className="mb-2">
            <MonthlyDistribution
              inspections={inspections}
              onMonthSelect={(month) => { onMonthSelect?.(month); setShowChart(false); }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <ToggleButton
              size="sm"
              active={showChart}
              onClick={() => setShowChart((v) => !v)}
              title="Графік по місяцях"
              iconLeft={<LineChart />}
            >
              Графік
            </ToggleButton>
            <div className="h-4 w-px bg-[var(--border)]" />
            {items.map((item) => (
              <div key={item.key} className="inline-flex items-center gap-2">
                {item.icon}
                <span className="text-[11px] text-[var(--text-muted)]">{item.label}</span>
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">{item.value}</span>
              </div>
            ))}
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">{contextLabel}</span>
        </div>
      </div>
    </div>
  );
}

function MonthlyDistribution({
  inspections,
  onMonthSelect,
}: {
  inspections: PlannedInspection[];
  onMonthSelect?: (month: string) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleHide() {
    hideTimer.current = setTimeout(() => setHoveredIdx(null), 120);
  }
  function cancelHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }

  const year = useMemo(() => {
    const ys = inspections.map((i) => i.dateMonth.slice(0, 4));
    if (!ys.length) return String(new Date().getFullYear());
    const freq: Record<string, number> = {};
    for (const y of ys) freq[y] = (freq[y] ?? 0) + 1;
    return Object.entries(freq).sort(([, a], [, b]) => b - a)[0][0];
  }, [inspections]);

  const monthData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of inspections) {
      if (i.dateMonth.startsWith(year)) map[i.dateMonth] = (map[i.dateMonth] ?? 0) + 1;
    }
    return Array.from({ length: 12 }, (_, idx) => {
      const month = `${year}-${String(idx + 1).padStart(2, '0')}`;
      return { month, count: map[month] ?? 0, label: MONTHS[idx].slice(0, 3) };
    });
  }, [inspections, year]);

  const max = Math.max(...monthData.map((d) => d.count), 1);

  const H = 56;
  const PY = 7;
  // Спостерігаємо постійно-змонтований контейнер (не SVG, який зникає при collapse)
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(480);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = monthData.map((d, i) => ({
    ...d,
    i,
    x: ((i + 0.5) / 12) * W,
    y: PY + (1 - d.count / max) * (H - PY * 2),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${pts[11].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;

  const hovered = hoveredIdx !== null ? pts[hoveredIdx] : null;
  const tooltipPct = hovered ? Math.min(Math.max(((hovered.i + 0.5) / 12) * 100, 10), 90) : 0;

  return (
    <Card padding="lg" className="overflow-visible">
      <div ref={containerRef}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionLabel>
          Кількість запланованих обстежень по місяцях
        </SectionLabel>
        <span className="text-[11px] text-[var(--text-muted)]">{inspections.length} загалом</span>
      </div>

      {(
        <div className="relative mt-3 select-none" onMouseLeave={scheduleHide}>
          <svg
            ref={svgRef}
            width="100%"
            height={H}
            style={{ display: 'block', overflow: 'visible' }}
          >
            {/* Grid */}
            {[0, 0.5, 1].map((t) => {
              const y = PY + t * (H - PY * 2);
              return <line key={t} x1={0} y1={y} x2={W} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" />;
            })}
            {/* Area */}
            <path d={areaPath} fill="var(--accent)" fillOpacity="0.08" />
            {/* Line */}
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            {/* Vertical indicator */}
            {hovered && (
              <line
                x1={hovered.x} y1={PY} x2={hovered.x} y2={H - PY}
                stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 2" opacity={0.5}
              />
            )}
            {/* Dots */}
            {pts.map((p) => (
              <circle
                key={p.i}
                cx={p.x} cy={p.y}
                r={hoveredIdx === p.i ? 4 : p.count > 0 ? 3 : 2}
                fill={p.count > 0 ? 'var(--accent)' : 'var(--border)'}
                stroke="var(--bg-surface)"
                strokeWidth="1.5"
              />
            ))}
            {/* Hover columns */}
            {pts.map((p) => (
              <rect
                key={p.i}
                x={(p.i / 12) * W}
                y={0}
                width={W / 12}
                height={H}
                fill="transparent"
                style={{ cursor: p.count > 0 ? 'pointer' : 'default' }}
                onMouseEnter={() => { cancelHide(); setHoveredIdx(p.i); }}
              />
            ))}
          </svg>

          {/* Month labels */}
          <div className="flex">
            {monthData.map((d, i) => (
              <span
                key={i}
                className={`flex-1 text-center text-[9px] transition-colors ${
                  hoveredIdx === i ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {d.label}
              </span>
            ))}
          </div>

          {/* Tooltip */}
          {hovered && (
            <div
              className="absolute z-50"
              style={{ left: `${tooltipPct}%`, top: 0, transform: 'translate(-50%, -115%)', pointerEvents: 'auto' }}
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              <div className="w-max rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
                <p className="text-[11px] font-semibold text-[var(--text-primary)]">{hovered.count} обстежень</p>
                <p className="text-[10px] text-[var(--text-muted)]">{formatMonthYear(hovered.month)}</p>
                {hovered.count > 0 && onMonthSelect && (
                  <button
                    type="button"
                    onClick={() => { onMonthSelect(hovered.month); setHoveredIdx(null); }}
                    className="mt-1.5 w-full rounded-[var(--radius-md)] bg-[var(--accent-10)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-20)]"
                  >
                    Показати
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )
      }
      </div>
    </Card>
  );
}

function ApprovalStageOverview({ inspections }: { inspections: PlannedInspection[] }) {
  const items = (['SUBMITTED', 'REMARKS', 'REJECTED', 'APPROVED', 'PUBLISHED'] as ApprovalStage[]).map((stage) => ({
    stage,
    count: inspections.filter((inspection) => inspection.approvalStage === stage).length,
  }));

  return (
    <div className="grid gap-2 md:grid-cols-5">
      {items.map(({ stage, count }) => (
        <div key={stage} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--hover)] px-3 py-2.5">
          <div className="flex items-center gap-2">
            {approvalStageIcon(stage)}
            <p className="min-h-8 text-[10px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--text-muted)]">
              {approvalStageLabel(stage)}
            </p>
          </div>
          <p className="mt-1 text-[20px] font-bold leading-none text-[var(--text-primary)]">{count}</p>
        </div>
      ))}
    </div>
  );
}

function PlanFilterPanel({
  inspections,
  initialSearch,
  initialInspectionStatus,
  initialApprovalStage,
  initialShelterType,
  initialMonth,
  onApply,
  onClear,
}: {
  inspections: PlannedInspection[];
  initialSearch: string;
  initialInspectionStatus: string;
  initialApprovalStage: string;
  initialShelterType: string;
  initialMonth: string;
  onApply: (filters: { search: string; inspectionStatus: string; approvalStage: string; shelterType: string; month: string }) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [inspectionStatus, setInspectionStatus] = useState(initialInspectionStatus);
  const [approvalStage, setApprovalStage] = useState(initialApprovalStage);
  const [shelterType, setShelterType] = useState(initialShelterType);
  const [month, setMonth] = useState(initialMonth);

  function handleClear() {
    setSearch('');
    setInspectionStatus('');
    setApprovalStage('');
    setShelterType('');
    setMonth('');
    onClear();
  }

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-[minmax(180px,1fr)_180px_220px_200px_160px]">
        <Input
          label="Пошук"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          iconLeft={<Search />}
          placeholder="Номер, тип або адреса"
        />
        <Select
          label="Статус огляду"
          value={inspectionStatus}
          onChange={(event) => setInspectionStatus(event.target.value)}
          options={INSPECTION_STATUS_OPTIONS}
        />
        <Select
          label="Стадія погодження"
          value={approvalStage}
          onChange={(event) => setApprovalStage(event.target.value)}
          options={APPROVAL_STAGE_OPTIONS}
        />
        <Select
          label="Тип укриття"
          value={shelterType}
          onChange={(event) => setShelterType(event.target.value)}
          options={shelterTypeOptionsForPlan(inspections)}
        />
        <Select label="Місяць" value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptionsForPlan(inspections)} />
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
        <Button type="button" variant="outline" size="md" onClick={handleClear}>Очистити</Button>
        <Button type="button" variant="primary" size="md" onClick={() => onApply({ search, inspectionStatus, approvalStage, shelterType, month })}>Застосувати</Button>
      </div>
    </>
  );
}

function PlanSortPanel({
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionToggle,
}: {
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  onSortKeyChange: (value: SortKey) => void;
  onSortDirectionToggle: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[240px_auto] sm:items-end">
      <Select
        label="Сортувати"
        value={sortKey}
        onChange={(event) => onSortKeyChange(event.target.value as SortKey)}
        options={SORT_OPTIONS}
      />
      <Button type="button" variant="outline" size="md" iconLeft={<ArrowUpDown />} onClick={onSortDirectionToggle}>
        {sortDirection === 'asc' ? 'За зростанням' : 'За спаданням'}
      </Button>
    </div>
  );
}

function ListView({
  inspections,
  editable,
  selectable,
  selectedIds,
  favoriteIds,
  onOpenInspection,
  onToggleFavorite,
  onToggleInspection,
  onCancelInspection,
  onRejectChanges,
  onDateMonthChange,
}: {
  inspections: PlannedInspection[];
  editable?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  favoriteIds?: Set<string>;
  onOpenInspection: (inspection: PlannedInspection) => void;
  onToggleFavorite?: (id: string) => void;
  onToggleInspection?: (id: string) => void;
  onCancelInspection?: (id: string, reason: string) => void;
  onRejectChanges?: (id: string) => void;
  onDateMonthChange?: (id: string, dateMonth: string) => void;
}) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removalReason, setRemovalReason] = useState('');

  function startRemoval(id: string) {
    setRemovingId(id);
    setRemovalReason('');
  }

  function confirmRemoval(id: string) {
    const reason = removalReason.trim();
    if (!reason) return;
    onCancelInspection?.(id, reason);
    setRemovingId(null);
    setRemovalReason('');
  }

  if (!inspections.length) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Обстежень не знайдено"
        message="Змініть фільтри або сформуйте новий план"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1420px] text-left">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {selectable && <th className="w-10 px-2 py-2">Вибір</th>}
            <th className="w-10 px-2 py-2">Обране</th>
            <th className="px-2 py-2">Номер укриття</th>
            <th className="px-2 py-2">Тип обстеження</th>
            <th className="px-2 py-2">Тип укриття</th>
            <th className="px-2 py-2">Регіон</th>
            <th className="px-2 py-2">Адреса укриття</th>
            <th className="px-2 py-2">Статус огляду</th>
            <th className="px-2 py-2">Стадія погодження</th>
            <th className="px-2 py-2">Дата перевірки</th>
            <th className="px-2 py-2">Строк від попереднього</th>
            <th className="px-2 py-2 text-right">Дії</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {inspections.map((inspection) => (
            <tr key={inspection.id} className="align-top hover:bg-[var(--hover)]">
              {selectable && (
                <td className="px-2 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Вибрати обстеження ${inspection.shelterNumber}`}
                    checked={selectedIds?.has(inspection.id) ?? false}
                    onChange={() => onToggleInspection?.(inspection.id)}
                    className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                  />
                </td>
              )}
              <td className="px-2 py-3">
                <button
                  type="button"
                  onClick={() => onToggleFavorite?.(inspection.id)}
                  aria-label={
                    favoriteIds?.has(inspection.id)
                      ? `Прибрати обстеження ${inspection.shelterNumber} з обраних`
                      : `Додати обстеження ${inspection.shelterNumber} до обраних`
                  }
                  title={favoriteIds?.has(inspection.id) ? 'Прибрати з обраних' : 'Додати до обраних'}
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)]"
                >
                  <Bookmark
                    className="h-4 w-4 transition-colors"
                    style={
                      favoriteIds?.has(inspection.id)
                        ? { fill: 'var(--accent)', stroke: 'var(--accent)' }
                        : undefined
                    }
                  />
                </button>
              </td>
              <td className="px-2 py-3 text-[12px] font-semibold">
                <a
                  href={`/shelters/${inspection.shelterId}`}
                  className="text-[var(--accent)] hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {inspection.shelterNumber}
                </a>
              </td>
              <td className="px-2 py-3 text-[12px] text-[var(--text-secondary)]">{typeLabel(inspection.type)}</td>
              <td className="px-2 py-3 text-[12px] text-[var(--text-secondary)]">{inspection.shelterType}</td>
              <td className="px-2 py-3 text-[12px] text-[var(--text-secondary)]">{inspection.region}</td>
              <td className="px-2 py-3 text-[12px] text-[var(--text-secondary)]">
                <span className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                  {inspection.shelterAddress}
                </span>
              </td>
              <td className="px-2 py-3">
                <Badge severity={inspectionStatusSeverity(inspection.inspectionStatus)} dot>
                  {inspectionStatusLabel(inspection.inspectionStatus)}
                </Badge>
              </td>
              <td className="px-2 py-3">
                <Badge severity={approvalStageSeverity(inspection.approvalStage)} dot>
                  {approvalStageLabel(inspection.approvalStage)}
                </Badge>
              </td>
              <td className="px-2 py-3 text-[12px] text-[var(--text-secondary)]">
                {editable && onDateMonthChange ? (
                  <div className="grid gap-1.5">
                    <select
                      value={inspection.dateMonth}
                      onChange={(event) => onDateMonthChange(inspection.id, event.target.value)}
                      disabled={inspection.cancelled || inspection.approvalStage === 'APPROVED' || inspection.approvalStage === 'PUBLISHED'}
                      aria-label={`Місяць перевірки для укриття ${inspection.shelterNumber}`}
                      className="h-8 min-w-[132px] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    >
                      {monthOptionsForYear(inspection.dateMonth).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {inspection.originalDateMonth && onRejectChanges ? (
                      <button
                        type="button"
                        onClick={() => onRejectChanges(inspection.id)}
                        className="w-fit text-[11px] font-medium text-[var(--color-danger)] transition-colors hover:opacity-80"
                      >
                        Скасувати зміни
                      </button>
                    ) : null}
                  </div>
                ) : (
                  formatMonthYear(inspection.dateMonth)
                )}
              </td>
              <td className="px-2 py-3">
                <button
                  type="button"
                  onClick={() => onOpenInspection(inspection)}
                  className="text-left text-[12px] font-medium text-[var(--accent)] hover:underline"
                >
                  {monthsSince(inspection.referenceDate, inspection.dateMonth)} міс.
                  <span className="mt-0.5 block text-[10px] font-normal text-[var(--text-muted)]">{inspection.referenceLabel}</span>
                </button>
              </td>
              <td className="px-2 py-3">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" iconLeft={<Eye />} onClick={() => onOpenInspection(inspection)}>
                    Відкрити
                  </Button>
                  {editable && onCancelInspection ? (
                    removingId === inspection.id ? (
                      <div className="w-56 rounded-[var(--radius-md)] border border-[#ff6b6b]/30 bg-[#ff6b6b]/5 p-2">
                        <Textarea
                          value={removalReason}
                          onChange={(event) => setRemovalReason(event.target.value)}
                          placeholder="Причина вилучення"
                          rows={2}
                          className="text-[12px]"
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRemovingId(null);
                              setRemovalReason('');
                            }}
                          >
                            Скасувати
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            iconLeft={<Trash2 />}
                            onClick={() => confirmRemoval(inspection.id)}
                            disabled={!removalReason.trim()}
                          >
                            Вилучити
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        iconLeft={<Trash2 />}
                        onClick={() => startRemoval(inspection.id)}
                        disabled={inspection.cancelled || inspection.approvalStage === 'APPROVED' || inspection.approvalStage === 'PUBLISHED'}
                      >
                        Вилучити
                      </Button>
                    )
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanWorkspace({
  title,
  workflowStage,
  inspections,
  totalCount,
  editable,
  selectable,
  selectedIds,
  favoriteIds,
  onOpenInspection,
  onToggleFavorite,
  onToggleInspection,
  onCancelInspection,
  onRejectChanges,
  onDateMonthChange,
}: {
  title: string;
  workflowStage?: PlanWorkflowStage;
  inspections: PlannedInspection[];
  totalCount?: number;
  editable?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  favoriteIds?: Set<string>;
  onOpenInspection: (inspection: PlannedInspection) => void;
  onToggleFavorite?: (id: string) => void;
  onToggleInspection?: (id: string) => void;
  onCancelInspection?: (id: string, reason: string) => void;
  onRejectChanges?: (id: string) => void;
  onDateMonthChange?: (id: string, dateMonth: string) => void;
}) {
  const overallCount = totalCount ?? inspections.length;

  return (
    <Card padding="lg">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>{title}</SectionLabel>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
            Показано: <strong className="text-[var(--text-primary)]">{inspections.length}</strong> з{' '}
            <strong className="text-[var(--text-primary)]">{overallCount}</strong>
          </p>
        </div>
      </div>

      {workflowStage ? (
        <div className="mb-5">
          <WorkflowStepper stage={workflowStage} />
        </div>
      ) : null}

      <ListView
        inspections={inspections}
        editable={editable}
        selectable={selectable}
        selectedIds={selectedIds}
        favoriteIds={favoriteIds}
        onOpenInspection={onOpenInspection}
        onToggleFavorite={onToggleFavorite}
        onToggleInspection={onToggleInspection}
        onCancelInspection={onCancelInspection}
        onRejectChanges={onRejectChanges}
        onDateMonthChange={onDateMonthChange}
      />
    </Card>
  );
}

const WORKFLOW_STEPS: { key: Exclude<PlanWorkflowStage, 'empty' | 'parameters'>; label: string }[] = [
  { key: 'draft', label: 'План сформовано' },
  { key: 'approval', label: 'Погодження' },
  { key: 'approved', label: 'Погоджено' },
  { key: 'published', label: 'Опубліковано' },
];

function WorkflowStepper({ stage }: { stage: PlanWorkflowStage }) {
  const activeIndex = WORKFLOW_STEPS.findIndex((step) => step.key === stage);

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="grid gap-2 md:grid-cols-4">
        {WORKFLOW_STEPS.map((step, index) => {
          const done = activeIndex > index;
          const active = activeIndex === index;

          return (
            <div key={step.key} className="flex items-center gap-3">
              <span
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                  done || active
                    ? 'border-[var(--accent)] bg-[var(--accent-10)] text-[var(--accent)]'
                    : 'border-[var(--border-strong)] text-[var(--text-muted)]',
                ].join(' ')}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={active ? 'text-[13px] font-semibold text-[var(--text-primary)]' : 'text-[13px] font-medium text-[var(--text-secondary)]'}>
                  {step.label}
                </p>
                <div className={['mt-1 h-1 rounded-full', done || active ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'].join(' ')} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanningParametersForm({
  year,
  basis,
  onYearChange,
  onBasisChange,
  onCreatePlan,
}: {
  year: string;
  basis: DateBasis;
  onYearChange: (year: string) => void;
  onBasisChange: (basis: DateBasis) => void;
  onCreatePlan: () => void;
}) {
  return (
    <Card padding="lg">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-10)] text-[var(--accent)]">
          <CalendarPlus className="h-4 w-4" />
        </div>
        <div>
          <SectionLabel>Параметри планування</SectionLabel>
          <h2 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">Запланувати обстеження</h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[var(--text-muted)]">
            Оберіть рік та правило відліку. Система сформує планові обстеження і покаже список на сторінці для подальшого погодження.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_260px_minmax(260px,1fr)]">
        <Select label="Рік" value={year} onChange={(event) => onYearChange(event.target.value)} options={YEARS} />
        <Select label="Вид обстежень" value="PLANNED" disabled options={INSPECTION_TYPE_OPTIONS} />
        <Select
          label="Відраховувати дату від"
          value={basis}
          onChange={(event) => onBasisChange(event.target.value as DateBasis)}
          options={DATE_BASIS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        />
      </div>

      <div className="mt-5 flex justify-end border-t border-[var(--border-subtle)] pt-4">
        <Button type="button" variant="primary" size="md" iconLeft={<CalendarPlus />} onClick={onCreatePlan}>
          Сформувати план
        </Button>
      </div>
    </Card>
  );
}

function EmptyPlanScreen({ onCreate }: { onCreate: () => void }) {
  return (
    <Card padding="lg">
      <EmptyState
        icon={<CalendarPlus />}
        title="План обстежень ще не створено"
        message="Натисніть «Запланувати обстеження», оберіть рік і правило відліку, після чого система сформує список планових перевірок."
        action={
          <Button type="button" variant="primary" size="md" iconLeft={<CalendarPlus />} onClick={onCreate}>
            Запланувати обстеження
          </Button>
        }
      />
    </Card>
  );
}

function ApprovalSelectionPanel({
  selectedCount,
  approvableCount,
  allSelected,
  proposedSelectedCount,
  onToggleAll,
  onRejectSelectedChanges,
}: {
  selectedCount: number;
  approvableCount: number;
  allSelected: boolean;
  proposedSelectedCount: number;
  onToggleAll: () => void;
  onRejectSelectedChanges: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] px-4 py-3">
      <div>
        <p className="text-[12px] font-semibold text-[var(--text-primary)]">
          Обрано {selectedCount} з {approvableCount}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
          Можна змінити місяць, вилучити позицію з причиною або підтвердити весь список чи лише обране.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="md" onClick={onToggleAll} disabled={!approvableCount}>
          {allSelected ? 'Зняти вибір' : 'Вибрати всі'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          iconLeft={<X />}
          onClick={onRejectSelectedChanges}
          disabled={!proposedSelectedCount}
        >
          Скасувати зміни в обраному
        </Button>
      </div>
    </div>
  );
}

function PublishedPlanCard({
  record,
  expanded,
  onToggle,
  favoriteIds,
  onOpenInspection,
  onToggleFavorite,
}: {
  record: PublishedPlanRecord;
  expanded: boolean;
  onToggle: () => void;
  favoriteIds: Set<string>;
  onOpenInspection: (inspection: PlannedInspection) => void;
  onToggleFavorite?: (id: string) => void;
}) {
  const shelterCount = new Set(record.inspections.map((inspection) => inspection.shelterId)).size;

  return (
    <Card padding="lg" className="overflow-hidden">
      <button type="button" onClick={onToggle} className="block w-full text-left">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <SectionLabel>Опублікований план</SectionLabel>
            <h2 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">{record.title}</h2>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              Натисніть на картку, щоб {expanded ? 'згорнути' : 'переглянути'} повний список перевірок.
            </p>
          </div>
          <Badge severity={record.current ? 'ok' : 'neutral'} dot>
            {record.current ? 'Опубліковано' : 'Неактуальна'}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <InfoRow label="Рік" value={record.year} />
          <InfoRow label="Сформував" value={`${record.createdBy}, ${formatDateTime(record.createdAt)}`} multiline />
          <InfoRow label="Погодив" value={`${record.approvedBy}, ${formatDateTime(record.approvedAt)}`} multiline />
          <InfoRow label="Опублікував" value={`${record.publishedBy}, ${formatDateTime(record.publishedAt)}`} multiline />
          <InfoRow label="Перевірок" value={String(record.inspections.length)} />
          <InfoRow label="Об'єктів" value={String(shelterCount)} />
        </div>
      </button>

      {expanded ? (
        <div className="mt-5 border-t border-[var(--border)] pt-5">
          <div className="mb-4">
            <SectionLabel>Список перевірок у плані</SectionLabel>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Показано: <strong className="text-[var(--text-primary)]">{record.inspections.length}</strong>
            </p>
          </div>
          <ListView
            inspections={record.inspections}
            favoriteIds={favoriteIds}
            onOpenInspection={onOpenInspection}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      ) : null}
    </Card>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PlanningResultInfo({
  inspections,
  year,
  basis,
}: {
  inspections: PlannedInspection[];
  year: string;
  basis: DateBasis;
}) {
  const regionCount = useMemo(() => new Set(inspections.map((inspection) => inspection.region)).size, [inspections]);
  const firstMonth = inspections[0]?.dateMonth;
  const lastMonth = inspections[inspections.length - 1]?.dateMonth;

  return (
    <Card padding="lg">
      <SectionLabel className="mb-3">Загальна інформація</SectionLabel>
      <div className="space-y-2.5">
        <InfoRow label="Заплановано" value={`${inspections.length} обстежень`} />
        <InfoRow label="Рік" value={year} />
        <InfoRow label="Вид обстежень" value="Планове" />
        <InfoRow label="Регіони" value={String(regionCount)} />
        <InfoRow label="Період" value={firstMonth && lastMonth ? `${formatMonthYear(firstMonth)} - ${formatMonthYear(lastMonth)}` : 'Не сформовано'} />
        <InfoRow label="Відлік" value={getBasisOption(basis).label} multiline />
      </div>
    </Card>
  );
}

function InfoRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--hover)] px-3 py-2.5">
      <div className={multiline ? 'space-y-1' : 'flex items-start justify-between gap-4'}>
        <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
        <span className="text-right text-[13px] font-semibold leading-5 text-[var(--text-primary)]">{value}</span>
      </div>
    </div>
  );
}

function InspectionDetailsDialog({
  inspection,
  editableComment,
  onClose,
  onCommentChange,
}: {
  inspection: PlannedInspection | null;
  editableComment?: boolean;
  onClose: () => void;
  onCommentChange?: (id: string, comment: string) => void;
}) {
  if (!inspection) return null;

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
      <button type="button" aria-label="Закрити деталі" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspection-detail-title"
        className="relative z-[6001] w-full max-w-2xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_40px_140px_rgba(0,0,0,0.72)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <SectionLabel>Обстеження</SectionLabel>
            <h3 id="inspection-detail-title" className="mt-1 truncate text-[18px] font-semibold text-[var(--text-primary)]">
              Укриття {inspection.shelterNumber}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <Badge severity="neutral" dot={false}>{typeLabel(inspection.type)}</Badge>
            <Badge severity={inspectionStatusSeverity(inspection.inspectionStatus)} dot>
              {inspectionStatusLabel(inspection.inspectionStatus)}
            </Badge>
            <Badge severity={approvalStageSeverity(inspection.approvalStage)} dot>
              {approvalStageLabel(inspection.approvalStage)}
            </Badge>
            <Badge severity="neutral" dot={false}>{inspection.shelterType}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <DetailTile label="Дата запланованої перевірки" value={formatMonthYear(inspection.dateMonth)} />
            <DetailTile label="Строк від попереднього" value={`${monthsSince(inspection.referenceDate, inspection.dateMonth)} міс.`} />
          </div>

          <DetailTile label="Адреса укриття" value={inspection.shelterAddress} />
          <DetailTile label={inspection.referenceLabel} value={formatDate(inspection.referenceDate)} />
          <DetailTile label="Відраховувати дату від" value={inspection.basisLabel} />

          {editableComment && onCommentChange ? (
            <Textarea
              label="Коментар до планування"
              value={inspection.comment ?? ''}
              onChange={(event) => onCommentChange(inspection.id, event.target.value)}
              placeholder="Додайте коментар до об'єкта у списку перевірок"
              rows={3}
            />
          ) : inspection.comment ? (
            <DetailTile label="Коментар" value={inspection.comment} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--hover)] p-3">
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-1 text-[13px] leading-5 text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

export function InspectionsClient() {
  const [selectedRegion, setSelectedRegion] = useState('');
  const [planningToolsOpen, setPlanningToolsOpen] = useState<'filters' | 'sort' | null>(null);
  const [workflowStage, setWorkflowStage] = useState<PlanWorkflowStage>('empty');
  const [mainSearch, setMainSearch] = useState('');
  const [mainInspectionStatus, setMainInspectionStatus] = useState('');
  const [mainApprovalStage, setMainApprovalStage] = useState('');
  const [mainShelterType, setMainShelterType] = useState('');
  const [mainMonth, setMainMonth] = useState('');
  const [mainSortKey, setMainSortKey] = useState<SortKey>('dateMonth');
  const [mainSortDirection, setMainSortDirection] = useState<'asc' | 'desc'>('asc');

  const [planningYear, setPlanningYear] = useState(String(CURRENT_YEAR));
  const [planningBasis, setPlanningBasis] = useState<DateBasis>('LAST_PLANNED_START');
  const [draftPlan, setDraftPlan] = useState<PlannedInspection[]>([]);

  const [selectedInspectionIds, setSelectedInspectionIds] = useState<Set<string>>(new Set());
  const [submittedPlan, setSubmittedPlan] = useState<PlannedInspection[]>([]);
  const [publishedRecords, setPublishedRecords] = useState<PublishedPlanRecord[]>([]);
  const [expandedPublishedPlanIds, setExpandedPublishedPlanIds] = useState<Set<string>>(new Set());
  const [createdAt, setCreatedAt] = useState('');
  const [approvedAt, setApprovedAt] = useState('');
  const [favoriteInspectionIds, setFavoriteInspectionIds] = useState<Set<string>>(new Set());

  const [openedInspection, setOpenedInspection] = useState<PlannedInspection | null>(null);
  const [detailsEditable, setDetailsEditable] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('inspection_plan_favorites');
      if (stored) setFavoriteInspectionIds(new Set(JSON.parse(stored) as string[]));
    } catch {}
  }, []);

  const currentPublishedRecord = publishedRecords.find((record) => record.current) ?? publishedRecords[0] ?? null;
  const overviewPlan = workflowStage === 'published' && currentPublishedRecord ? currentPublishedRecord.inspections : submittedPlan.length ? submittedPlan : draftPlan;
  const hasProcessPlan = overviewPlan.length > 0;
  const scopedSubmittedPlan = useMemo(
    () => (selectedRegion ? submittedPlan.filter((inspection) => inspection.region === selectedRegion) : submittedPlan),
    [submittedPlan, selectedRegion]
  );
  const approvableIds = useMemo(
    () =>
      scopedSubmittedPlan
        .filter((inspection) => !inspection.cancelled && inspection.approvalStage !== 'APPROVED' && inspection.approvalStage !== 'PUBLISHED')
        .map((inspection) => inspection.id),
    [scopedSubmittedPlan]
  );
  const selectedApprovableIds = approvableIds.filter((id) => selectedInspectionIds.has(id));
  const proposedSelectedIds = scopedSubmittedPlan
    .filter((inspection) => selectedInspectionIds.has(inspection.id) && inspection.approvalStage === 'REMARKS')
    .map((inspection) => inspection.id);
  const allApprovableSelected = approvableIds.length > 0 && approvableIds.every((id) => selectedInspectionIds.has(id));
  const hasRegionalPendingApproval = scopedSubmittedPlan.some(
    (inspection) => !inspection.cancelled && inspection.approvalStage !== 'APPROVED' && inspection.approvalStage !== 'PUBLISHED'
  );
  const approvedSubmittedPlan = scopedSubmittedPlan.filter((inspection) => inspection.approvalStage === 'APPROVED' && !inspection.cancelled);

  const filteredOverviewPlan = useMemo(() => {
    return selectedRegion ? overviewPlan.filter((inspection) => inspection.region === selectedRegion) : overviewPlan;
  }, [overviewPlan, selectedRegion]);

  const mainVisiblePlan = useMemo(
    () =>
      applyPlanFilters({
        inspections: filteredOverviewPlan,
        search: mainSearch,
        inspectionStatus: mainInspectionStatus,
        approvalStage: mainApprovalStage,
        shelterType: mainShelterType,
        month: mainMonth,
        sortKey: mainSortKey,
        sortDirection: mainSortDirection,
      }),
    [
      filteredOverviewPlan,
      mainApprovalStage,
      mainInspectionStatus,
      mainMonth,
      mainSearch,
      mainShelterType,
      mainSortDirection,
      mainSortKey,
    ]
  );

  const mainFilterCount =
    Number(Boolean(mainSearch.trim())) +
    Number(Boolean(mainInspectionStatus)) +
    Number(Boolean(mainApprovalStage)) +
    Number(Boolean(mainShelterType)) +
    Number(Boolean(mainMonth));

  function createDraftPlan(year: string, basis: DateBasis) {
    const nextPlan = generateInspectionPlan(Number(year), basis);
    setDraftPlan(nextPlan);
    setSubmittedPlan([]);
    setSelectedInspectionIds(new Set());
    setExpandedPublishedPlanIds(new Set());
    setWorkflowStage('draft');
    setCreatedAt(new Date().toISOString());
  }

  function openPlanning() {
    setPlanningToolsOpen(null);
    setDraftPlan([]);
    setSubmittedPlan([]);
    setSelectedInspectionIds(new Set());
    setMainSearch('');
    setMainInspectionStatus('');
    setMainApprovalStage('');
    setMainShelterType('');
    setMainMonth('');
    setWorkflowStage('parameters');
  }

  function cancelDraftStep() {
    setPlanningToolsOpen(null);
    setDraftPlan([]);
    setSubmittedPlan([]);
    setSelectedInspectionIds(new Set());
    setMainSearch('');
    setMainInspectionStatus('');
    setMainApprovalStage('');
    setMainShelterType('');
    setMainMonth('');
    setCreatedAt('');
    setWorkflowStage('parameters');
  }

  function handlePlanningYearChange(year: string) {
    setPlanningYear(year);
  }

  function handlePlanningBasisChange(basis: DateBasis) {
    setPlanningBasis(basis);
  }

  function handleDraftCommentChange(id: string, comment: string) {
    setDraftPlan((current) =>
      current.map((inspection) =>
        inspection.id === id
          ? { ...inspection, comment, approvalStage: comment.trim() ? 'REMARKS' : 'SUBMITTED' }
          : inspection
      )
    );
    setOpenedInspection((current) =>
      current?.id === id ? { ...current, comment, approvalStage: comment.trim() ? 'REMARKS' : 'SUBMITTED' } : current
    );
  }

  function submitForApproval() {
    const planForApproval = draftPlan.map((inspection) => ({
      ...inspection,
      approvalStage: (inspection.comment?.trim() ? 'REMARKS' : 'SUBMITTED') as ApprovalStage,
    }));
    setSubmittedPlan(planForApproval);
    setSelectedInspectionIds(new Set());
    setWorkflowStage('approval');

    window.dispatchEvent(
      new CustomEvent('inspection-plan-submitted', {
        detail: {
          title: 'Новий список перевірок на погодження',
          message: `Сформовано ${planForApproval.length} планових обстежень за ${planningYear} рік. Потрібне погодження.`,
          count: planForApproval.length,
        },
      })
    );
  }

  function toggleApprovalInspection(id: string) {
    setSelectedInspectionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllApprovableInspections() {
    setSelectedInspectionIds((current) => {
      if (allApprovableSelected) return new Set();
      return new Set([...current, ...approvableIds]);
    });
  }

  function rejectSelectedChanges() {
    for (const id of proposedSelectedIds) rejectInspectionChanges(id);
    setSelectedInspectionIds((current) => {
      const next = new Set(current);
      for (const id of proposedSelectedIds) next.delete(id);
      return next;
    });
  }

  function handleApprovalDateMonthChange(id: string, dateMonth: string) {
    setSubmittedPlan((current) =>
      current.map((inspection) =>
        inspection.id === id
          ? {
              ...inspection,
              dateMonth,
              originalDateMonth: inspection.originalDateMonth ?? inspection.dateMonth,
              approvalStage: 'REMARKS',
              cancelled: false,
              comment: inspection.comment || 'Запропоновано змінити місяць обстеження.',
            }
          : inspection
      )
    );
  }

  function cancelInspectionPlan(id: string, reason: string) {
    setSubmittedPlan((current) =>
      current.map((inspection) =>
        inspection.id === id
          ? {
              ...inspection,
              approvalStage: 'REMARKS',
              cancelled: true,
              comment: `Причина вилучення: ${reason}`,
            }
          : inspection
      )
    );
  }

  function rejectInspectionChanges(id: string) {
    setSubmittedPlan((current) =>
      current.map((inspection) =>
        inspection.id === id
          ? {
              ...inspection,
              dateMonth: inspection.originalDateMonth ?? inspection.dateMonth,
              originalDateMonth: undefined,
              approvalStage: 'REJECTED',
              cancelled: false,
              comment: 'Пропоновані зміни відхилено.',
            }
          : inspection
      )
    );
  }

  function approveSubmittedPlan(ids: string[]) {
    const selected = new Set(ids);
    if (!selected.size) return;
    const approved = submittedPlan.map((inspection) =>
      selected.has(inspection.id)
        ? { ...inspection, approvalStage: 'APPROVED' as const, cancelled: false, originalDateMonth: undefined }
        : inspection
    );
    setSubmittedPlan(approved);
    setDraftPlan(approved);
    setSelectedInspectionIds(new Set());
    setApprovedAt(new Date().toISOString());
    setWorkflowStage('approved');
  }

  function publishPlan() {
    const publishingIds = new Set(approvedSubmittedPlan.map((inspection) => inspection.id));
    const published = submittedPlan
      .filter((inspection) => publishingIds.has(inspection.id))
      .map((inspection) => ({ ...inspection, approvalStage: 'PUBLISHED' as const, originalDateMonth: undefined }));
    if (!published.length) return;

    const publishedAt = new Date().toISOString();
    const record: PublishedPlanRecord = {
      id: `published-${publishedAt}-${publishedRecords.length + 1}`,
      title: `План обстежень ${planningYear}`,
      year: planningYear,
      basis: planningBasis,
      current: true,
      createdBy: 'Регіональний користувач',
      createdAt: createdAt || publishedAt,
      approvedBy: 'Уповноважений погоджувач',
      approvedAt: approvedAt || publishedAt,
      publishedBy: 'Регіональний користувач',
      publishedAt,
      inspections: published,
    };
    setPublishedRecords((current) => [record, ...current.map((item) => ({ ...item, current: false }))]);
    setDraftPlan((current) =>
      selectedRegion
        ? current.map((inspection) =>
            publishingIds.has(inspection.id)
              ? { ...inspection, approvalStage: 'PUBLISHED' as const, originalDateMonth: undefined }
              : inspection
          )
        : published
    );
    setSubmittedPlan(published);
    setWorkflowStage('published');
    setExpandedPublishedPlanIds(new Set([record.id]));
  }

  function openDetails(inspection: PlannedInspection, editableComment = false) {
    setDetailsEditable(editableComment);
    setOpenedInspection(inspection);
  }

  function toggleFavoriteInspection(id: string) {
    setFavoriteInspectionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      try {
        window.localStorage.setItem('inspection_plan_favorites', JSON.stringify([...next]));
      } catch {}

      return next;
    });
  }

  return (
    <AppShell>
      <InspectionHeader
        active="planning"
        actions={
          <>
            <div className="min-w-[210px]">
              <Select
                aria-label="Фільтр області"
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value)}
                options={REGIONS}
                className="h-9"
              />
            </div>
            <Button
              type="button"
              variant={planningToolsOpen === 'filters' ? 'secondary' : 'outline'}
              size="md"
              iconLeft={<Filter />}
              disabled={!hasProcessPlan}
              onClick={() => setPlanningToolsOpen((current) => (current === 'filters' ? null : 'filters'))}
            >
              {mainFilterCount ? `Фільтр (${mainFilterCount})` : 'Фільтр'}
            </Button>
            <Button
              type="button"
              variant={planningToolsOpen === 'sort' ? 'secondary' : 'outline'}
              size="md"
              iconLeft={<ArrowUpDown />}
              disabled={!hasProcessPlan}
              onClick={() => setPlanningToolsOpen((current) => (current === 'sort' ? null : 'sort'))}
            >
              Сортування
            </Button>

            {workflowStage === 'empty' ? (
              <Button type="button" variant="primary" size="md" iconLeft={<CalendarPlus />} onClick={openPlanning}>
                Запланувати обстеження
              </Button>
            ) : null}

            {workflowStage === 'parameters' ? (
              <Button
                type="button"
                variant="outline"
                size="md"
                iconLeft={<X />}
                onClick={() => setWorkflowStage(draftPlan.length ? 'draft' : publishedRecords.length ? 'published' : 'empty')}
              >
                Скасувати
              </Button>
            ) : null}

            {workflowStage === 'draft' ? (
              <>
                <Button type="button" variant="outline" size="md" iconLeft={<X />} onClick={cancelDraftStep}>
                  Скасувати крок
                </Button>
                <Button type="button" variant="primary" size="md" iconLeft={<Send />} onClick={submitForApproval} disabled={!draftPlan.length}>
                  Відправити на погодження
                </Button>
              </>
            ) : null}

            {workflowStage === 'approval' ? (
              <DropdownButton
                label="Підтвердити"
                variant="primary"
                size="md"
                iconLeft={<ClipboardCheck />}
                disabled={!approvableIds.length || !hasRegionalPendingApproval}
                actions={[
                  {
                    label: 'Підтвердити всі',
                    icon: <ClipboardCheck />,
                    onClick: () => approveSubmittedPlan(approvableIds),
                    disabled: !approvableIds.length,
                  },
                  {
                    label: `Підтвердити обрані${selectedApprovableIds.length ? ` (${selectedApprovableIds.length})` : ''}`,
                    icon: <Check />,
                    onClick: () => approveSubmittedPlan(selectedApprovableIds),
                    disabled: !selectedApprovableIds.length,
                  },
                ]}
              />
            ) : null}

            {workflowStage === 'approved' && approvedSubmittedPlan.length ? (
              <Button type="button" variant="primary" size="md" iconLeft={<Send />} onClick={publishPlan}>
                Опублікувати план
              </Button>
            ) : null}

            {workflowStage === 'published' && publishedRecords.length ? (
              <Button type="button" variant="primary" size="md" iconLeft={<CalendarPlus />} onClick={openPlanning}>
                Створити новий план
              </Button>
            ) : null}
          </>
        }
      />

      {planningToolsOpen === 'filters' ? (
        <div className="fixed left-0 right-0 top-[104px] z-40 px-6 md:left-[224px]">
          <div className="mx-auto max-w-7xl rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
            <PlanFilterPanel
              key="filter-panel"
              inspections={filteredOverviewPlan}
              initialSearch={mainSearch}
              initialInspectionStatus={mainInspectionStatus}
              initialApprovalStage={mainApprovalStage}
              initialShelterType={mainShelterType}
              initialMonth={mainMonth}
              onApply={(filters) => {
                setMainSearch(filters.search);
                setMainInspectionStatus(filters.inspectionStatus);
                setMainApprovalStage(filters.approvalStage);
                setMainShelterType(filters.shelterType);
                setMainMonth(filters.month);
                setPlanningToolsOpen(null);
              }}
              onClear={() => {
                setMainSearch('');
                setMainInspectionStatus('');
                setMainApprovalStage('');
                setMainShelterType('');
                setMainMonth('');
                setPlanningToolsOpen(null);
              }}
            />
          </div>
        </div>
      ) : planningToolsOpen === 'sort' ? (
        <div className="fixed right-6 top-[104px] z-40">
          <div className="w-[420px] rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
            <PlanSortPanel
              sortKey={mainSortKey}
              sortDirection={mainSortDirection}
              onSortKeyChange={setMainSortKey}
              onSortDirectionToggle={() => setMainSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
            />
            <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
              <Button type="button" variant="outline" size="md" onClick={() => setPlanningToolsOpen(null)}>
                Закрити
              </Button>
              <Button type="button" variant="primary" size="md" onClick={() => setPlanningToolsOpen(null)}>
                Застосувати
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-6 pb-28 [scrollbar-gutter:stable]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          {workflowStage === 'empty' ? (
            <EmptyPlanScreen onCreate={openPlanning} />
          ) : null}

          {workflowStage === 'parameters' ? (
            <PlanningParametersForm
              year={planningYear}
              basis={planningBasis}
              onYearChange={handlePlanningYearChange}
              onBasisChange={handlePlanningBasisChange}
              onCreatePlan={() => createDraftPlan(planningYear, planningBasis)}
            />
          ) : null}

          {workflowStage === 'draft' ? (
            <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <div className="space-y-4">
                <PlanningResultInfo inspections={filteredOverviewPlan} year={planningYear} basis={planningBasis} />
                <MonthlyDistribution inspections={filteredOverviewPlan} onMonthSelect={setMainMonth} />
              </div>
              <PlanWorkspace
                title="План обстежень"
                workflowStage={workflowStage}
                inspections={mainVisiblePlan}
                totalCount={filteredOverviewPlan.length}
                favoriteIds={favoriteInspectionIds}
                onOpenInspection={(inspection) => openDetails(inspection, true)}
                onToggleFavorite={toggleFavoriteInspection}
              />
            </div>
          ) : null}

          {workflowStage === 'approval' ? (
            <>
              <ApprovalStageOverview inspections={filteredOverviewPlan} />
              <ApprovalSelectionPanel
                selectedCount={selectedApprovableIds.length}
                approvableCount={approvableIds.length}
                allSelected={allApprovableSelected}
                proposedSelectedCount={proposedSelectedIds.length}
                onToggleAll={toggleAllApprovableInspections}
                onRejectSelectedChanges={rejectSelectedChanges}
              />
              <PlanWorkspace
                title="План обстежень за регіоном"
                workflowStage={workflowStage}
                inspections={mainVisiblePlan}
                totalCount={filteredOverviewPlan.length}
                editable
                selectable
                selectedIds={selectedInspectionIds}
                favoriteIds={favoriteInspectionIds}
                onOpenInspection={(inspection) => openDetails(inspection)}
                onToggleFavorite={toggleFavoriteInspection}
                onToggleInspection={toggleApprovalInspection}
                onCancelInspection={cancelInspectionPlan}
                onRejectChanges={rejectInspectionChanges}
                onDateMonthChange={handleApprovalDateMonthChange}
              />
            </>
          ) : null}

          {workflowStage === 'approved' ? (
            <>
              <ApprovalStageOverview inspections={filteredOverviewPlan} />
              <PlanWorkspace
                title="Погоджений план обстежень"
                workflowStage={workflowStage}
                inspections={mainVisiblePlan}
                totalCount={filteredOverviewPlan.length}
                favoriteIds={favoriteInspectionIds}
                onOpenInspection={(inspection) => openDetails(inspection)}
                onToggleFavorite={toggleFavoriteInspection}
              />
            </>
          ) : null}

          {workflowStage === 'published' && publishedRecords.length ? (
            <div className="space-y-4">
              {publishedRecords.map((record) => (
                <PublishedPlanCard
                  key={record.id}
                  record={record}
                  expanded={expandedPublishedPlanIds.has(record.id)}
                  onToggle={() =>
                    setExpandedPublishedPlanIds((current) => {
                      const next = new Set(current);
                      if (next.has(record.id)) next.delete(record.id);
                      else next.add(record.id);
                      return next;
                    })
                  }
                  favoriteIds={favoriteInspectionIds}
                  onOpenInspection={(inspection) => openDetails(inspection)}
                  onToggleFavorite={toggleFavoriteInspection}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {hasProcessPlan ? (
        <InspectionSummaryDock
          inspections={mainVisiblePlan}
          contextLabel={regionLabel(selectedRegion)}
          onMonthSelect={setMainMonth}
        />
      ) : null}

      <InspectionDetailsDialog
        inspection={openedInspection}
        editableComment={detailsEditable}
        onClose={() => {
          setOpenedInspection(null);
          setDetailsEditable(false);
        }}
        onCommentChange={handleDraftCommentChange}
      />
    </AppShell>
  );
}
