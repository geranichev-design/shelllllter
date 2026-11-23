'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileText,
  Plus,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { AppShell } from '@/app/components/AppShell';
import { apiFetch } from '@/lib/api';
import { getStoredAuth } from '@/lib/auth';
import { Alert, Badge, Button, Card, PageHeader, SectionLabel, Table } from '@repo/ui';

type ShelterRow = {
  id: string;
  name: string;
  type: string;
  accessType: string;
  capacity: number;
  address: string | null;
  status: string;
  accountingStatus?: string;
  recordStatus?: string;
  createdAt: string;
  updatedAt: string;
};

type ShelterRequestRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'NEW' | 'APPROVED' | 'REJECTED';
  createdBy?: {
    email: string;
    role: string;
  };
  data: {
    name?: string;
    type?: string;
    accessType?: string;
    capacity?: number;
    responsible?: string;
    address?: string;
  };
};

type DashboardBlockId = 'registry' | 'readiness' | 'verification' | 'capacity';
type DeltaDir = 'up' | 'down' | 'neutral';
type Severity = 'ok' | 'warning' | 'danger' | 'neutral' | 'info';

type DetailTableRow = {
  id: string;
  name: string;
  group: string;
  value: string;
  statusLabel: string;
  severity: Severity;
  note: string;
};

type ChartDatum = {
  label: string;
  value: number;
  color: string;
};

type LiveStat = {
  label: string;
  value: string;
  suffix?: string;
  tone: Severity;
};

type DashboardBlock = {
  id: DashboardBlockId;
  title: string;
  eyebrow: string;
  description: string;
  value: string;
  delta: string;
  deltaDir: DeltaDir;
  accent: string;
  icon: ReactNode;
  tableTitle: string;
  tableRows: DetailTableRow[];
  chartTitle: string;
  chartData: ChartDatum[];
  trendTitle: string;
  trendData: number[];
  liveStats: LiveStat[];
};

const DASHBOARD_BLOCK_ICON_NAMES: Record<DashboardBlockId, string> = {
  registry: 'Building2',
  readiness: 'ShieldCheck',
  verification: 'ClipboardCheck',
  capacity: 'UsersRound',
};

const REFRESH_INTERVAL_MS = 15000;
const REPORT_DATE_FORMAT = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const SHELTER_STATUS_META: Record<string, { label: string; severity: Severity; color: string }> = {
  NEED: { label: 'Потреба', severity: 'warning', color: '#f59e0b' },
  PROJECT: { label: 'Проєкт', severity: 'info', color: '#60a5fa' },
  CONSTRUCTION: { label: 'Будівництво', severity: 'warning', color: '#f59e0b' },
  OPERATION: { label: 'Експлуатація', severity: 'ok', color: 'var(--accent)' },
  MODERNIZATION: { label: 'Модернізація', severity: 'info', color: '#60a5fa' },
  REPAIR: { label: 'Ремонт', severity: 'warning', color: '#f59e0b' },
  CONSERVATION: { label: 'Консервація', severity: 'neutral', color: '#8892a4' },
  MISUSE: { label: 'Не за призначенням', severity: 'danger', color: '#ff6b6b' },
  DESTROYED: { label: 'Знищено', severity: 'danger', color: '#ff6b6b' },
};

const REQUEST_STATUS_META: Record<string, { label: string; severity: Severity; color: string }> = {
  NEW: { label: 'Нова', severity: 'warning', color: '#f59e0b' },
  APPROVED: { label: 'Схвалена', severity: 'ok', color: 'var(--accent)' },
  REJECTED: { label: 'Відхилена', severity: 'danger', color: '#ff6b6b' },
};

const TYPE_LABELS: Record<string, string> = {
  STATIC: 'Стаціонарне',
  MOBILE: 'Мобільне',
};

const ACCESS_LABELS: Record<string, string> = {
  PUBLIC: 'Публічний доступ',
  PRIVATE: 'Приватний доступ',
};

const REQUEST_VISIBLE_ROLES = new Set(['BALANCE_HOLDER', 'GOV_ORG', 'REGIONAL', 'DSNS']);

function formatNumber(value: number) {
  return value.toLocaleString('uk-UA');
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('uk-UA');
}

function getStatusMeta(status: string) {
  return SHELTER_STATUS_META[status] ?? { label: status, severity: 'neutral' as Severity, color: '#8892a4' };
}

function getRequestMeta(status: string) {
  return REQUEST_STATUS_META[status] ?? { label: status, severity: 'neutral' as Severity, color: '#8892a4' };
}

function countBy<T>(items: T[], readKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = readKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function sumBy<T>(items: T[], readValue: (item: T) => number) {
  return items.reduce((sum, item) => sum + readValue(item), 0);
}

function isWithinDays(dateValue: string, days: number) {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

function buildMonthTrend<T>(items: T[], readDate: (item: T) => string | undefined) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));

    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('uk-UA', { month: 'short' }),
      value: 0,
    };
  });

  const byKey = new Map(months.map((month) => [month.key, month]));
  items.forEach((item) => {
    const rawDate = readDate(item);
    if (!rawDate) return;

    const date = new Date(rawDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = byKey.get(key);
    if (month) {
      month.value += 1;
    }
  });

  return months;
}

function buildDashboardBlocks(
  shelters: ShelterRow[],
  requests: ShelterRequestRow[],
  responseMs: number,
  syncCount: number
): DashboardBlock[] {
  const totalShelters = shelters.length;
  const operationalShelters = shelters.filter((row) => row.status === 'OPERATION');
  const readyPercent = totalShelters ? (operationalShelters.length / totalShelters) * 100 : 0;
  const pendingShelters = shelters.filter((row) => row.status === 'NEED');
  const riskShelters = shelters.filter((row) => row.status === 'MISUSE' || row.status === 'DESTROYED');
  const totalCapacity = sumBy(shelters, (row) => row.capacity);
  const operationalCapacity = sumBy(operationalShelters, (row) => row.capacity);
  const publicCapacity = sumBy(shelters.filter((row) => row.accessType === 'PUBLIC'), (row) => row.capacity);
  const mobileCapacity = sumBy(shelters.filter((row) => row.type === 'MOBILE'), (row) => row.capacity);
  const averageCapacity = totalShelters ? Math.round(totalCapacity / totalShelters) : 0;
  const newRequests = requests.filter((row) => row.status === 'NEW');
  const approvedRequests = requests.filter((row) => row.status === 'APPROVED');
  const updatedToday = shelters.filter((row) => isWithinDays(row.updatedAt, 1)).length;
  const createdThisMonth = shelters.filter((row) => {
    const createdAt = new Date(row.createdAt);
    const now = new Date();
    return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
  }).length;
  const statusCounts = countBy(shelters, (row) => row.status);
  const requestCounts = countBy(requests, (row) => row.status);
  const accessCounts = countBy(shelters, (row) => row.accessType);
  const shelterMonthTrend = buildMonthTrend(shelters, (row) => row.createdAt);
  const requestMonthTrend = buildMonthTrend(requests, (row) => row.createdAt);

  const statusChart = Object.entries(SHELTER_STATUS_META)
    .map(([status, meta]) => ({
      label: meta.label,
      value: statusCounts[status] ?? 0,
      color: meta.color,
    }))
    .filter((item) => item.value > 0);

  const requestChart = Object.entries(REQUEST_STATUS_META)
    .map(([status, meta]) => ({
      label: meta.label,
      value: requestCounts[status] ?? 0,
      color: meta.color,
    }))
    .filter((item) => item.value > 0);

  const capacityChart = [
    { label: 'Експлуатація', value: operationalCapacity, color: 'var(--accent)' },
    { label: 'Публічні', value: publicCapacity, color: '#60a5fa' },
    { label: 'Мобільні', value: mobileCapacity, color: '#6c63ff' },
    { label: 'Потреба', value: sumBy(pendingShelters, (row) => row.capacity), color: '#f59e0b' },
  ].filter((item) => item.value > 0);

  const registryRows = shelters.slice(0, 6).map((row) => {
    const meta = getStatusMeta(row.status);
    return {
      id: row.id,
      name: row.name,
      group: TYPE_LABELS[row.type] ?? row.type,
      value: formatNumber(row.capacity),
      statusLabel: meta.label,
      severity: meta.severity,
      note: row.address || `Оновлено ${formatDate(row.updatedAt)}`,
    };
  });

  const readinessRows = Object.entries(SHELTER_STATUS_META)
    .map(([status, meta]) => {
      const rows = shelters.filter((row) => row.status === status);
      const capacity = sumBy(rows, (row) => row.capacity);
      return {
        id: status,
        name: meta.label,
        group: 'Статус готовності',
        value: `${formatNumber(rows.length)} записів`,
        statusLabel: totalShelters ? formatPercent((rows.length / totalShelters) * 100) : '0%',
        severity: meta.severity,
        note: `${formatNumber(capacity)} місць`,
      };
    })
    .filter((row) => row.value !== '0 записів');

  const verificationRows = requests.slice(0, 6).map((row) => {
    const meta = getRequestMeta(row.status);
    return {
      id: row.id,
      name: row.data.name || 'Без назви',
      group: row.createdBy?.email ?? row.data.responsible ?? 'Заявник не вказаний',
      value: formatNumber(Number(row.data.capacity ?? 0)),
      statusLabel: meta.label,
      severity: meta.severity,
      note: `Створено ${formatDate(row.createdAt)}`,
    };
  });

  const capacityRows = [
    {
      id: 'all-capacity',
      name: 'Загальна місткість',
      group: 'Усі укриття',
      value: formatNumber(totalCapacity),
      statusLabel: totalShelters ? `${formatNumber(totalShelters)} об'єктів` : '0 об’єктів',
      severity: 'neutral' as Severity,
      note: `Середня місткість ${formatNumber(averageCapacity)}`,
    },
    {
      id: 'operation-capacity',
      name: 'Доступна місткість',
      group: 'Експлуатація',
      value: formatNumber(operationalCapacity),
      statusLabel: formatPercent(totalCapacity ? (operationalCapacity / totalCapacity) * 100 : 0),
      severity: 'ok' as Severity,
      note: `${formatNumber(operationalShelters.length)} укриттів`,
    },
    {
      id: 'public-capacity',
      name: 'Публічний доступ',
      group: ACCESS_LABELS.PUBLIC,
      value: formatNumber(publicCapacity),
      statusLabel: formatPercent(totalCapacity ? (publicCapacity / totalCapacity) * 100 : 0),
      severity: 'info' as Severity,
      note: `${formatNumber(accessCounts.PUBLIC ?? 0)} укриттів`,
    },
    {
      id: 'mobile-capacity',
      name: 'Мобільний фонд',
      group: TYPE_LABELS.MOBILE,
      value: formatNumber(mobileCapacity),
      statusLabel: formatPercent(totalCapacity ? (mobileCapacity / totalCapacity) * 100 : 0),
      severity: 'neutral' as Severity,
      note: `${formatNumber(shelters.filter((row) => row.type === 'MOBILE').length)} модулів`,
    },
  ];

  return [
    {
      id: 'registry',
      title: 'Фонд укриттів',
      eyebrow: 'Реєстр',
      description: 'Кількість об’єктів, структура фонду та останні оновлення записів.',
      value: formatNumber(totalShelters),
      delta: createdThisMonth ? `+${formatNumber(createdThisMonth)} за місяць` : 'без нових за місяць',
      deltaDir: createdThisMonth ? 'up' : 'neutral',
      accent: 'var(--accent)',
      icon: <Building2 />,
      tableTitle: 'Останні записи реєстру',
      tableRows: registryRows,
      chartTitle: 'Розподіл за статусами',
      chartData: statusChart,
      trendTitle: 'Нові записи за 6 місяців',
      trendData: shelterMonthTrend.map((month) => month.value),
      liveStats: [
        { label: 'Синхронізацій', value: formatNumber(syncCount), tone: 'info' },
        { label: 'Оновлено за 24 год', value: formatNumber(updatedToday), tone: updatedToday ? 'ok' : 'neutral' },
        { label: 'Відповідь API', value: formatNumber(responseMs), suffix: 'мс', tone: responseMs < 800 ? 'ok' : 'warning' },
        { label: 'Публічних', value: formatNumber(accessCounts.PUBLIC ?? 0), tone: 'info' },
      ],
    },
    {
      id: 'readiness',
      title: 'Готовність',
      eyebrow: 'Стан',
      description: 'Придатність фонду, проблемні стани та частка укриттів в експлуатації.',
      value: formatPercent(readyPercent),
      delta: `${formatNumber(operationalShelters.length)} в експлуатації`,
      deltaDir: readyPercent >= 70 ? 'up' : readyPercent >= 40 ? 'neutral' : 'down',
      accent: '#60a5fa',
      icon: <ShieldCheck />,
      tableTitle: 'Стан готовності за статусами',
      tableRows: readinessRows,
      chartTitle: 'Баланс статусів',
      chartData: statusChart,
      trendTitle: 'Темп поповнення фонду',
      trendData: shelterMonthTrend.map((month) => month.value + operationalShelters.length),
      liveStats: [
        { label: 'В експлуатації', value: formatNumber(operationalShelters.length), tone: 'ok' },
        { label: 'Очікують дій', value: formatNumber(pendingShelters.length), tone: pendingShelters.length ? 'warning' : 'ok' },
        { label: 'Ризикові', value: formatNumber(riskShelters.length), tone: riskShelters.length ? 'danger' : 'ok' },
        { label: 'Готовність', value: formatPercent(readyPercent), tone: readyPercent >= 70 ? 'ok' : 'warning' },
      ],
    },
    {
      id: 'verification',
      title: 'Верифікація',
      eyebrow: 'Заявки',
      description: 'Черга нових пропозицій, схвалення та навантаження на розгляд.',
      value: formatNumber(newRequests.length + pendingShelters.length),
      delta: `${formatNumber(newRequests.length)} нових заявок`,
      deltaDir: newRequests.length ? 'down' : 'up',
      accent: '#f59e0b',
      icon: <ClipboardCheck />,
      tableTitle: 'Останні заявки',
      tableRows: verificationRows,
      chartTitle: 'Статуси заявок',
      chartData: requestChart,
      trendTitle: 'Динаміка заявок за 6 місяців',
      trendData: requestMonthTrend.map((month) => month.value),
      liveStats: [
        { label: 'Нові заявки', value: formatNumber(newRequests.length), tone: newRequests.length ? 'warning' : 'ok' },
        { label: 'Схвалено', value: formatNumber(approvedRequests.length), tone: 'ok' },
        { label: 'Потреба верифікації', value: formatNumber(pendingShelters.length), tone: pendingShelters.length ? 'warning' : 'neutral' },
        { label: 'Відповідь API', value: formatNumber(responseMs), suffix: 'мс', tone: responseMs < 800 ? 'ok' : 'warning' },
      ],
    },
    {
      id: 'capacity',
      title: 'Місткість',
      eyebrow: 'Ресурс',
      description: 'Загальний ресурс місць, доступна місткість і структура за доступом.',
      value: formatNumber(totalCapacity),
      delta: `${formatNumber(operationalCapacity)} доступно`,
      deltaDir: operationalCapacity > 0 ? 'up' : 'neutral',
      accent: '#6c63ff',
      icon: <UsersRound />,
      tableTitle: 'Місткість за ключовими зрізами',
      tableRows: capacityRows,
      chartTitle: 'Структура місткості',
      chartData: capacityChart,
      trendTitle: 'Нарощення фонду за 6 місяців',
      trendData: shelterMonthTrend.map((month, index) => {
        const base = Math.max(0, totalCapacity - (5 - index) * averageCapacity);
        return month.value ? base + month.value * averageCapacity : base;
      }),
      liveStats: [
        { label: 'Усього місць', value: formatNumber(totalCapacity), tone: 'neutral' },
        { label: 'Доступно', value: formatNumber(operationalCapacity), tone: 'ok' },
        { label: 'Середня місткість', value: formatNumber(averageCapacity), tone: 'info' },
        { label: 'Публічний ресурс', value: formatPercent(totalCapacity ? (publicCapacity / totalCapacity) * 100 : 0), tone: 'info' },
      ],
    },
  ];
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function generateReport(block: DashboardBlock) {
  const rows = [
    ['Блок', block.title],
    ['Сформовано', REPORT_DATE_FORMAT.format(new Date())],
    ['Показник', block.value],
    [],
    ['Назва', 'Група', 'Значення', 'Статус', 'Примітка'],
    ...block.tableRows.map((row) => [row.name, row.group, row.value, row.statusLabel, row.note]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dashboard-${block.id}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TileButton({
  block,
  active,
  onClick,
}: {
  block: DashboardBlock;
  active: boolean;
  onClick: () => void;
}) {
  const deltaColor =
    block.deltaDir === 'up'
      ? 'text-[var(--accent)]'
      : block.deltaDir === 'down'
        ? 'text-[var(--color-warning)]'
        : 'text-[var(--text-muted)]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-migra-component={`Dashboard/MetricCard/${block.id}`}
      data-migra-eyebrow={block.eyebrow}
      data-migra-title={block.title}
      data-migra-value={block.value}
      data-migra-delta={block.delta}
      data-migra-icon={DASHBOARD_BLOCK_ICON_NAMES[block.id]}
      data-migra-state={active ? 'active' : 'default'}
      className={[
        'relative min-h-[154px] overflow-hidden rounded-[var(--radius-xl)] border bg-[var(--bg-surface)] p-4 text-left transition-[background,border-color,transform] duration-150',
        active
          ? 'border-[var(--border-hover)] bg-[var(--hover-md)]'
          : 'border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--hover)]',
      ].join(' ')}
    >
      <span className="absolute left-0 right-0 top-0 h-0.5" style={{ background: block.accent }} />
      <span
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] [&>svg]:h-4 [&>svg]:w-4"
        style={{ color: block.accent }}
      >
        {block.icon}
      </span>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {block.eyebrow}
      </span>
      <span className="mt-1 block text-[15px] font-semibold text-[var(--text-primary)]">{block.title}</span>
      <span className="mt-3 flex items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[24px] font-bold leading-none text-[var(--text-primary)] tabular-nums">
            {block.value}
          </span>
          <span className={`mt-2 block text-[11px] ${deltaColor}`}>{block.delta}</span>
        </span>
        <span
          className={[
            'flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border transition-transform [&>svg]:h-3.5 [&>svg]:w-3.5',
            active
              ? 'border-[var(--accent-35)] bg-[var(--accent-10)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--text-muted)]',
          ].join(' ')}
        >
          <ChevronRight className={active ? 'rotate-90' : ''} />
        </span>
      </span>
    </button>
  );
}

function BarListChart({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  if (data.length === 0) {
    return <p className="px-4 py-10 text-center text-[12px] text-[var(--text-muted)]">Дані відсутні</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = Math.max((item.value / max) * 100, 4);
        return (
          <div key={item.label} className="grid grid-cols-[minmax(96px,132px)_1fr_auto] items-center gap-3">
            <span className="truncate text-[11px] text-[var(--text-secondary)]">{item.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-2)]">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${width}%`, background: item.color }}
              />
            </span>
            <span className="min-w-10 text-right text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">
              {formatNumber(item.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({ values }: { values: number[] }) {
  const safeValues = values.length ? values : [0, 0, 0, 0, 0, 0];
  const chartWidth = 600;
  const chartHeight = 160;
  const paddingX = 24;
  const topY = 20;
  const baselineY = 124;
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const coords = safeValues
    .map((value, index) => {
      const progress = safeValues.length === 1 ? 0 : index / (safeValues.length - 1);
      const x = paddingX + progress * (chartWidth - paddingX * 2);
      const y = baselineY - ((value - min) / range) * (baselineY - topY);
      return { x, y, value };
    });
  const linePath = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `M ${coords[0].x} ${baselineY} ${coords
    .map((point) => `L ${point.x} ${point.y}`)
    .join(' ')} L ${coords[coords.length - 1].x} ${baselineY} Z`;

  return (
    <div className="h-36">
      <svg className="h-full w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Динаміка за останні шість місяців">
        <defs>
          <linearGradient id="dashboard-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[topY, 72, baselineY].map((y) => (
          <line
            key={y}
            x1={paddingX}
            y1={y}
            x2={chartWidth - paddingX}
            y2={y}
            stroke="var(--border)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={areaPath} fill="url(#dashboard-trend-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {coords.map((point, index) => (
          <g key={`${point.value}-${index}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="var(--bg-surface)" />
            <circle cx={point.x} cy={point.y} r="3.5" fill="var(--accent)" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>-6 міс.</span>
        <span>поточний місяць</span>
      </div>
    </div>
  );
}

function LiveMetricCard({ stat }: { stat: LiveStat }) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] text-[var(--text-muted)]">{stat.label}</span>
        <Badge severity={stat.tone} dot>
          live
        </Badge>
      </div>
      <p className="mt-3 text-[20px] font-bold leading-none text-[var(--text-primary)] tabular-nums">
        {stat.value}
        {stat.suffix ? <span className="ml-1 text-[12px] font-medium text-[var(--text-muted)]">{stat.suffix}</span> : null}
      </p>
    </Card>
  );
}

function DashboardDetails({
  block,
  lastUpdated,
  onReport,
}: {
  block: DashboardBlock;
  lastUpdated: Date | null;
  onReport: () => void;
}) {
  const columns = [
    {
      key: 'name',
      header: 'Показник',
      cell: (row: DetailTableRow) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{row.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{row.group}</p>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Значення',
      width: '120px',
      cell: (row: DetailTableRow) => (
        <span className="text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">{row.value}</span>
      ),
    },
    {
      key: 'status',
      header: 'Стан',
      width: '150px',
      cell: (row: DetailTableRow) => <Badge severity={row.severity} dot>{row.statusLabel}</Badge>,
    },
    {
      key: 'note',
      header: 'Примітка',
      cell: (row: DetailTableRow) => (
        <span className="line-clamp-2 text-[12px] text-[var(--text-secondary)]">{row.note}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] [&>svg]:h-4 [&>svg]:w-4"
              style={{ color: block.accent }}
            >
              {block.icon}
            </span>
            <div className="min-w-0">
              <SectionLabel>{block.eyebrow}</SectionLabel>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{block.title}</h2>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-[12px] leading-5 text-[var(--text-secondary)]">{block.description}</p>
          {lastUpdated ? (
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              Останнє оновлення: {lastUpdated.toLocaleTimeString('uk-UA')}
            </p>
          ) : null}
        </div>
        <Button variant="primary" size="md" iconLeft={<FileText />} onClick={onReport}>
          Сформувати звіт
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {block.liveStats.map((stat) => (
          <LiveMetricCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card padding="lg">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <SectionLabel>Графік</SectionLabel>
              <h3 className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">{block.chartTitle}</h3>
            </div>
            <BarChart3 className="h-4 w-4 text-[var(--text-muted)]" />
          </div>
          <BarListChart data={block.chartData} />
        </Card>

        <Card padding="lg">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <SectionLabel>Динаміка</SectionLabel>
              <h3 className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">{block.trendTitle}</h3>
            </div>
            <Activity className="h-4 w-4 text-[var(--text-muted)]" />
          </div>
          <TrendChart values={block.trendData.length ? block.trendData : [0, 0, 0, 0, 0, 0]} />
        </Card>
      </div>

      <Card padding="none">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <SectionLabel>Таблиця</SectionLabel>
            <h3 className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">{block.tableTitle}</h3>
          </div>
          <Database className="h-4 w-4 text-[var(--text-muted)]" />
        </div>
        <Table
          data={block.tableRows}
          columns={columns}
          keyExtractor={(row) => row.id}
          emptyMessage="Дані для блоку відсутні"
        />
      </Card>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Link href="/shelter-requests/new">
        <Card
          hover
          padding="lg"
          data-migra-component="Dashboard/ActionCard"
          data-migra-eyebrow="Створити"
          data-migra-title="Нова заявка на укриття"
        >
          <SectionLabel>Створити</SectionLabel>
          <p className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">Нова заявка на укриття</p>
        </Card>
      </Link>
      <Link href="/shelter-requests">
        <Card
          hover
          padding="lg"
          data-migra-component="Dashboard/ActionCard"
          data-migra-eyebrow="Переглянути"
          data-migra-title="Список заявок"
        >
          <SectionLabel>Переглянути</SectionLabel>
          <p className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">Список заявок</p>
        </Card>
      </Link>
      <Link href="/shelters/pending-verification">
        <Card
          hover
          padding="lg"
          data-migra-component="Dashboard/ActionCard"
          data-migra-eyebrow="Перевірити"
          data-migra-title="Очікують верифікації"
        >
          <SectionLabel>Перевірити</SectionLabel>
          <p className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">Очікують верифікації</p>
        </Card>
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const [shelters, setShelters] = useState<ShelterRow[]>([]);
  const [requests, setRequests] = useState<ShelterRequestRow[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<DashboardBlockId | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [requestsWarning, setRequestsWarning] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [responseMs, setResponseMs] = useState(0);
  const [syncCount, setSyncCount] = useState(0);

  const loadDashboardData = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');
    setRequestsWarning('');
    const startedAt = performance.now();
    const role = getStoredAuth()?.user.role ?? '';
    const canLoadRequests = REQUEST_VISIBLE_ROLES.has(role);
    const [sheltersResult, requestsResult] = await Promise.allSettled([
      apiFetch<ShelterRow[]>('/shelters'),
      canLoadRequests ? apiFetch<ShelterRequestRow[]>('/shelter-requests') : Promise.resolve([]),
    ]);

    if (sheltersResult.status === 'fulfilled') {
      setShelters(sheltersResult.value);
      setLastUpdated(new Date());
      setResponseMs(Math.max(1, Math.round(performance.now() - startedAt)));
      setSyncCount((current) => current + 1);
    } else {
      setError(sheltersResult.reason instanceof Error ? sheltersResult.reason.message : 'Не вдалося завантажити дашборд');
    }

    if (requestsResult.status === 'fulfilled') {
      setRequests(requestsResult.value);
    } else {
      setRequests([]);
      setRequestsWarning(
        requestsResult.reason instanceof Error
          ? requestsResult.reason.message
          : 'Не вдалося завантажити заявки'
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadDashboardData();
    const interval = window.setInterval(() => void loadDashboardData(true), REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadDashboardData]);

  const blocks = useMemo(
    () => buildDashboardBlocks(shelters, requests, responseMs, syncCount),
    [shelters, requests, responseMs, syncCount]
  );
  const activeBlock = blocks.find((block) => block.id === activeBlockId) ?? null;

  function handleReport() {
    if (!activeBlock) return;
    generateReport(activeBlock);
  }

  return (
    <AppShell>
      <PageHeader
        title="Дашборд"
        subtitle="Огляд / Головна"
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              iconLeft={<RefreshCw className={refreshing ? 'animate-spin' : ''} />}
              onClick={() => void loadDashboardData()}
              loading={loading}
            >
              Оновити
            </Button>
            <Link href="/shelter-requests/new">
              <Button variant="primary" size="md" iconLeft={<Plus />}>Додати укриття</Button>
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-6">
        {error ? <Alert severity="danger">{error}</Alert> : null}
        {requestsWarning ? <Alert severity="warning">{requestsWarning}</Alert> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {blocks.map((block) => (
            <TileButton
              key={block.id}
              block={block}
              active={activeBlockId === block.id}
              onClick={() => setActiveBlockId((current) => (current === block.id ? null : block.id))}
            />
          ))}
        </div>

        {activeBlock ? (
          <DashboardDetails block={activeBlock} lastUpdated={lastUpdated} onReport={handleReport} />
        ) : (
          <QuickActions />
        )}

        {loading ? (
          <Card padding="lg">
            <div className="flex items-center gap-3 text-[12px] text-[var(--text-secondary)]">
              <span className="h-4 w-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              Завантаження показників
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
