'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box, Check, ChevronDown, Download, Flame, Globe2, Layers, Map as MapIcon, Minus, Plus, RotateCcw, Search, Shield, SlidersHorizontal, Users, X } from 'lucide-react';
import { AppShell } from '@/app/components/AppShell';
import { Button, Card, PageHeader, SectionLabel } from '@repo/ui';
import type { Map as LeafletMap } from 'leaflet';
import type { DemoMode, DemoProposalPoint, ShelterPoint } from './CoverageLeafletMap';
import type { TerrainFocusPoint } from './Terrain3DMap';

const CoverageLeafletMap = dynamic(() => import('./CoverageLeafletMap'), { ssr: false });
const Terrain3DMap = dynamic(() => import('./Terrain3DMap'), { ssr: false });

type LayerKey = 'population' | 'coverage' | 'combined';
type MapViewMode = '2d' | '3d';



const MOCK_LAYER_POINTS = [
  { name: 'Київ', latitude: 50.4501, longitude: 30.5234, population: 1.0, coverage: 0.78, deficit: 0.22 },
  { name: 'Бровари', latitude: 50.5115, longitude: 30.7902, population: 0.78, coverage: 0.48, deficit: 0.52 },
  { name: 'Бориспіль', latitude: 50.3482, longitude: 30.9551, population: 0.65, coverage: 0.6, deficit: 0.4 },
  { name: 'Ірпінь', latitude: 50.5194, longitude: 30.2397, population: 0.7, coverage: 0.52, deficit: 0.48 },
  { name: 'Біла Церква', latitude: 49.7954, longitude: 30.1177, population: 0.58, coverage: 0.4, deficit: 0.6 },
  { name: 'Фастів', latitude: 50.0754, longitude: 29.9208, population: 0.46, coverage: 0.34, deficit: 0.66 },
  { name: 'Обухів', latitude: 50.1038, longitude: 30.6238, population: 0.42, coverage: 0.5, deficit: 0.5 },
  { name: 'Вишгород', latitude: 50.5834, longitude: 30.4894, population: 0.44, coverage: 0.39, deficit: 0.61 },
] as const;

// ─── Deficit peak detection ───────────────────────────────────────────────────
// Mirrors the same Gaussian math used in CoverageLeafletMap so recommendations
// land exactly where the heatmap shows the highest unmet need.

const OBLAST_GRID = { latMin: 49.45, latMax: 50.95, lonMin: 29.15, lonMax: 31.15 };

function deficitAt(
  lat: number,
  lon: number,
  points: readonly { latitude: number; longitude: number; population: number }[],
  shelters: readonly ShelterPoint[],
): number {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const twoSigPop = 2 * 0.15 * 0.15;
  const twoSigCov = 2 * 0.08 * 0.08;

  let pop = 0;
  for (const p of points) {
    const dlat = lat - p.latitude;
    const dlon = (lon - p.longitude) * cosLat;
    pop += Math.exp(-(dlat * dlat + dlon * dlon) / twoSigPop) * p.population;
  }
  pop = Math.min(1, pop);

  let cov = 0;
  for (const s of shelters) {
    if (s.status === 'INACTIVE') continue;
    const dlat = lat - s.latitude;
    const dlon = (lon - s.longitude) * cosLat;
    const w = (s.capacity / 500) * (s.status === 'MAINTENANCE' ? 0.4 : 1.0);
    cov += Math.exp(-(dlat * dlat + dlon * dlon) / twoSigCov) * w;
  }
  cov = Math.min(1, cov);

  return Math.max(0, pop - cov);
}

function computeDeficitPeaks(
  points: readonly { latitude: number; longitude: number; population: number }[],
  shelters: readonly ShelterPoint[],
  count = 5,
): Array<{ latitude: number; longitude: number; deficit: number }> {
  const STEP = 0.04;
  const { latMin, latMax, lonMin, lonMax } = OBLAST_GRID;

  const lats: number[] = [];
  const lons: number[] = [];
  for (let lat = latMin + STEP; lat < latMax; lat += STEP) lats.push(+lat.toFixed(6));
  for (let lon = lonMin + STEP; lon < lonMax; lon += STEP) lons.push(+lon.toFixed(6));

  const grid = lats.map(lat => lons.map(lon => deficitAt(lat, lon, points, shelters)));

  // local maxima with 8-neighbour NMS
  const peaks: { latitude: number; longitude: number; deficit: number }[] = [];
  for (let i = 1; i < lats.length - 1; i++) {
    for (let j = 1; j < lons.length - 1; j++) {
      const val = grid[i][j];
      if (val < 0.12) continue;
      let isMax = true;
      outer: for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue;
          if (grid[i + di][j + dj] >= val) { isMax = false; break outer; }
        }
      }
      if (isMax) peaks.push({ latitude: lats[i], longitude: lons[j], deficit: val });
    }
  }

  peaks.sort((a, b) => b.deficit - a.deficit);

  // keep only peaks that are ≥0.2° apart from already-selected ones
  const selected: typeof peaks = [];
  for (const p of peaks) {
    if (selected.every(s =>
      Math.abs(s.latitude - p.latitude) > 0.2 ||
      Math.abs(s.longitude - p.longitude) > 0.2,
    )) selected.push(p);
    if (selected.length >= count) break;
  }
  return selected;
}

const NAMED_CITIES = [
  { name: 'Бровари',     latitude: 50.5115, longitude: 30.7902 },
  { name: 'Бориспіль',   latitude: 50.3482, longitude: 30.9551 },
  { name: 'Ірпінь',      latitude: 50.5194, longitude: 30.2397 },
  { name: 'Біла Церква', latitude: 49.7954, longitude: 30.1177 },
  { name: 'Фастів',      latitude: 50.0754, longitude: 29.9208 },
  { name: 'Обухів',      latitude: 50.1038, longitude: 30.6238 },
  { name: 'Вишгород',    latitude: 50.5834, longitude: 30.4894 },
  { name: 'Київ',        latitude: 50.4501, longitude: 30.5234 },
];

function nearestCityName(lat: number, lon: number): string {
  return NAMED_CITIES.reduce((best, c) =>
    (c.latitude - lat) ** 2 + (c.longitude - lon) ** 2 <
    (best.latitude - lat) ** 2 + (best.longitude - lon) ** 2 ? c : best,
  ).name;
}

function peakToDemoPoint(
  peak: { latitude: number; longitude: number; deficit: number },
  index: number,
): DemoProposalPoint {
  const city = nearestCityName(peak.latitude, peak.longitude);
  const pct = Math.round(peak.deficit * 100);
  const proposalType: DemoProposalPoint['proposalType'] =
    peak.deficit > 0.6 ? 'STATIC' : peak.deficit > 0.35 ? 'MODULAR' : 'MOBILE';
  const priority: DemoProposalPoint['priority'] =
    peak.deficit > 0.55 ? 'high' : peak.deficit > 0.3 ? 'medium' : 'low';
  const capacity = Math.max(80, Math.round((peak.deficit * 500) / 50) * 50);
  return {
    id: `auto-deficit-${index}`,
    latitude: peak.latitude,
    longitude: peak.longitude,
    title: `${city} — зона дефіциту #${index + 1}`,
    proposalType,
    capacity,
    priority,
    reason: `Дефіцит покриття — ${pct}%. Щільність населення висока, але наявні укриття не охоплюють потребу в радіусі 9 км.`,
    status: 'Рекомендовано алгоритмом аналізу дефіциту',
    source: 'automatic',
  };
}

const MOCK_SHELTERS: ShelterPoint[] = [
  { id: 's1',  latitude: 50.4501, longitude: 30.5234, name: 'Укриття «Хрещатик»',        address: 'вул. Хрещатик, 22, Київ',          capacity: 600, type: 'METRO',    status: 'ACTIVE'      },
  { id: 's2',  latitude: 50.4621, longitude: 30.5158, name: 'Підвал ЖК «Поділ»',          address: 'вул. Сагайдачного, 14, Київ',      capacity: 120, type: 'BASEMENT', status: 'ACTIVE'      },
  { id: 's3',  latitude: 50.4383, longitude: 30.5147, name: 'Укриття «Либідська»',         address: 'пл. Либідська, 1, Київ',           capacity: 480, type: 'METRO',    status: 'ACTIVE'      },
  { id: 's4',  latitude: 50.4748, longitude: 30.4894, name: 'Підвал школи №134',           address: 'вул. Львівська, 23, Київ',         capacity:  90, type: 'BASEMENT', status: 'MAINTENANCE' },
  { id: 's5',  latitude: 50.4556, longitude: 30.4631, name: 'Сховище ДСНС №7',             address: 'просп. Перемоги, 67, Київ',        capacity: 310, type: 'SHELTER',  status: 'ACTIVE'      },
  { id: 's6',  latitude: 50.5115, longitude: 30.7902, name: 'Укриття Бровари Центр',       address: 'вул. Незалежності, 1, Бровари',    capacity: 200, type: 'BASEMENT', status: 'ACTIVE'      },
  { id: 's7',  latitude: 50.3482, longitude: 30.9551, name: 'Підвал міської ради',         address: 'вул. Київська, 3, Бориспіль',     capacity: 140, type: 'BASEMENT', status: 'ACTIVE'      },
  { id: 's8',  latitude: 50.5194, longitude: 30.2397, name: 'Укриття Ірпінь-1',            address: 'вул. Шевченка, 10, Ірпінь',       capacity: 180, type: 'SHELTER',  status: 'ACTIVE'      },
  { id: 's9',  latitude: 49.7954, longitude: 30.1177, name: 'Сховище Біла Церква',         address: 'вул. Олександрійська, 5, Б. Церква', capacity: 260, type: 'SHELTER', status: 'ACTIVE'   },
  { id: 's10', latitude: 50.0754, longitude: 29.9208, name: 'Підвал вокзалу Фастів',       address: 'вул. Залізнична, 2, Фастів',      capacity:  80, type: 'BASEMENT', status: 'INACTIVE'    },
  { id: 's11', latitude: 50.1038, longitude: 30.6238, name: 'Укриття Обухів-Центр',        address: 'вул. Київська, 28, Обухів',       capacity: 150, type: 'BASEMENT', status: 'ACTIVE'      },
  { id: 's12', latitude: 50.5834, longitude: 30.4894, name: 'Сховище Вишгород',            address: 'вул. Шкільна, 4, Вишгород',       capacity: 100, type: 'SHELTER',  status: 'MAINTENANCE' },
  { id: 's13', latitude: 50.4420, longitude: 30.5560, name: 'Укриття «Арсенальна»',        address: 'вул. Арсенальна, 1, Київ',         capacity: 520, type: 'METRO',    status: 'ACTIVE'      },
  { id: 's14', latitude: 50.4680, longitude: 30.5680, name: 'Підвал лікарні №12',          address: 'вул. Братиславська, 3, Київ',      capacity: 160, type: 'BASEMENT', status: 'ACTIVE'      },
  { id: 's15', latitude: 50.4290, longitude: 30.4970, name: 'Укриття «Деміївська»',        address: 'просп. Голосіївський, 17, Київ',   capacity: 390, type: 'METRO',    status: 'ACTIVE'      },
];

function focusIdForShelter(id: string) {
  return `shelter:${id}`;
}

function focusIdForProposal(id: string) {
  return `proposal:${id}`;
}

function shelterStatusText(status: ShelterPoint['status']) {
  return {
    ACTIVE: 'Активне',
    INACTIVE: 'Неактивне',
    MAINTENANCE: 'На обслуговуванні',
  }[status];
}

function shelterToTerrainPoint(shelter: ShelterPoint): TerrainFocusPoint {
  return {
    id: focusIdForShelter(shelter.id),
    label: shelter.name,
    latitude: shelter.latitude,
    longitude: shelter.longitude,
    category: 'shelter',
    status: shelterStatusText(shelter.status),
    capacity: shelter.capacity,
  };
}

function proposalToTerrainPoint(point: DemoProposalPoint): TerrainFocusPoint {
  return {
    id: focusIdForProposal(point.id),
    label: point.title,
    latitude: point.latitude,
    longitude: point.longitude,
    category: 'proposal',
    status: point.status,
    capacity: point.capacity,
    priority: point.priority,
  };
}

const DEFAULT_TERRAIN_POINT = shelterToTerrainPoint(MOCK_SHELTERS[0]);

type ManualDraftForm = {
  title: string;
  proposalType: DemoProposalPoint['proposalType'];
  capacity: string;
  priority: DemoProposalPoint['priority'];
  reason: string;
  status: string;
};

const MANUAL_POINT_PRESETS: ManualDraftForm = {
  title: 'Нове запропоноване укриття',
  proposalType: 'MODULAR',
  capacity: '160',
  priority: 'medium',
  reason: 'Додайте коротке обґрунтування для цієї точки.',
  status: 'Чернетка до збереження',
};

type DemoDraft = DemoProposalPoint;

export default function CoverageMapPage() {
  const router = useRouter();
  const [selectedLayer, setSelectedLayer] = useState<LayerKey>('combined');
  const [showAllLayers, setShowAllLayers] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('2d');
  const [focusPointId, setFocusPointId] = useState(DEFAULT_TERRAIN_POINT.id);
  const [selectedShelter, setSelectedShelter] = useState<ShelterPoint | null>(null);
  const [activeShelterInList, setActiveShelterInList] = useState<string | null>(null);
  const [leafletZoom, setLeafletZoom] = useState<number | null>(null);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoMode, setDemoMode] = useState<DemoMode>('auto');
  const [manualPoints, setManualPoints] = useState<DemoDraft[]>([]);
  const [manualDraft, setManualDraft] = useState<DemoDraft | null>(null);
  const [draftForm, setDraftForm] = useState<ManualDraftForm>({
    title: MANUAL_POINT_PRESETS.title,
    proposalType: MANUAL_POINT_PRESETS.proposalType,
    capacity: MANUAL_POINT_PRESETS.capacity,
    priority: MANUAL_POINT_PRESETS.priority,
    reason: MANUAL_POINT_PRESETS.reason,
    status: MANUAL_POINT_PRESETS.status,
  });
  const [shelterSearch, setShelterSearch] = useState('');
  const [shelterStatusFilter, setShelterStatusFilter] = useState<ShelterPoint['status'] | 'ALL'>('ALL');
  const [shelterSort, setShelterSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [shelterFilterOpen, setShelterFilterOpen] = useState(false);
  const [filterDropdownPos, setFilterDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [layerDropdownPos, setLayerDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const layerDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);

  const handleMapReady = useCallback((map: LeafletMap) => {
    leafletMapRef.current = map;
    setLeafletZoom(map.getZoom());
    map.on('zoomend', () => setLeafletZoom(map.getZoom()));
  }, []);

  const summary = useMemo(
    () => ({
      totalShelters: 284,
      verifiedShelters: 196,
      coverageRate: 72,
      shortageRate: 28,
    }),
    []
  );

  const filteredShelters = useMemo(() => {
    const q = shelterSearch.trim().toLowerCase();
    const list = MOCK_SHELTERS.filter((s) => {
      const matchesStatus = shelterStatusFilter === 'ALL' || s.status === shelterStatusFilter;
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
    if (shelterSort === 'asc') return [...list].sort((a, b) => a.capacity - b.capacity);
    if (shelterSort === 'desc') return [...list].sort((a, b) => b.capacity - a.capacity);
    return list;
  }, [shelterSearch, shelterStatusFilter, shelterSort]);

  const autoDemoPoints = useMemo(
    () => computeDeficitPeaks(MOCK_LAYER_POINTS, MOCK_SHELTERS).map(peakToDemoPoint),
    [],
  );

  const visibleDemoPoints = useMemo(
    () => (demoEnabled ? (demoMode === 'auto' ? autoDemoPoints : [...manualPoints, ...(manualDraft ? [manualDraft] : [])]) : []),
    [demoEnabled, demoMode, autoDemoPoints, manualPoints, manualDraft]
  );

  const terrainFocusPoints = useMemo<TerrainFocusPoint[]>(
    () => [
      ...MOCK_SHELTERS.map(shelterToTerrainPoint),
      ...visibleDemoPoints.map(proposalToTerrainPoint),
    ],
    [visibleDemoPoints],
  );

  const activeTerrainPoint = useMemo(
    () => terrainFocusPoints.find((point) => point.id === focusPointId) ?? terrainFocusPoints[0] ?? DEFAULT_TERRAIN_POINT,
    [focusPointId, terrainFocusPoints],
  );

  const demoCount = visibleDemoPoints.length;

  const handleShelterClick = useCallback((shelter: ShelterPoint) => {
    setFocusPointId(focusIdForShelter(shelter.id));
    setSelectedShelter(shelter);
    setActiveShelterInList(shelter.id);
  }, []);

  const handleDemoPointClick = useCallback((point: DemoProposalPoint) => {
    setFocusPointId(focusIdForProposal(point.id));
  }, []);

  const handleDemoMapClick = useCallback(
    (latitude: number, longitude: number) => {
      if (!demoEnabled || demoMode !== 'manual') return;

      const nextDraft: DemoDraft = {
        id: `manual-${Date.now()}`,
        latitude,
        longitude,
        title: draftForm.title.trim() || MANUAL_POINT_PRESETS.title,
        proposalType: draftForm.proposalType,
        capacity: Number.isFinite(Number(draftForm.capacity)) ? Number(draftForm.capacity) : Number(MANUAL_POINT_PRESETS.capacity),
        priority: draftForm.priority,
        reason: draftForm.reason.trim() || MANUAL_POINT_PRESETS.reason,
        status: draftForm.status.trim() || MANUAL_POINT_PRESETS.status,
        source: 'manual',
      };

      setManualDraft(nextDraft);
      setFocusPointId(focusIdForProposal(nextDraft.id));
    },
    [demoEnabled, demoMode, draftForm]
  );

  const saveManualPoint = useCallback(() => {
    if (!manualDraft) return;

    const savedPoint: DemoDraft = {
      ...manualDraft,
      title: draftForm.title.trim() || manualDraft.title,
      proposalType: draftForm.proposalType,
      capacity: Number.isFinite(Number(draftForm.capacity)) ? Number(draftForm.capacity) : manualDraft.capacity,
      priority: draftForm.priority,
      reason: draftForm.reason.trim() || manualDraft.reason,
      status: draftForm.status.trim() || manualDraft.status,
    };

    setManualPoints((current) => [...current, savedPoint]);
    setManualDraft(null);
    setDraftForm({
      title: MANUAL_POINT_PRESETS.title,
      proposalType: MANUAL_POINT_PRESETS.proposalType,
      capacity: MANUAL_POINT_PRESETS.capacity,
      priority: MANUAL_POINT_PRESETS.priority,
      reason: MANUAL_POINT_PRESETS.reason,
      status: MANUAL_POINT_PRESETS.status,
    });
  }, [draftForm, manualDraft]);

  const cancelManualPoint = useCallback(() => {
    setManualDraft(null);
    setDraftForm({
      title: MANUAL_POINT_PRESETS.title,
      proposalType: MANUAL_POINT_PRESETS.proposalType,
      capacity: MANUAL_POINT_PRESETS.capacity,
      priority: MANUAL_POINT_PRESETS.priority,
      reason: MANUAL_POINT_PRESETS.reason,
      status: MANUAL_POINT_PRESETS.status,
    });
  }, []);

  const stopDemoMode = useCallback(() => {
    setDemoEnabled(false);
    setDemoMode('auto');
    setManualPoints([]);
    setManualDraft(null);
    setDraftForm({
      title: MANUAL_POINT_PRESETS.title,
      proposalType: MANUAL_POINT_PRESETS.proposalType,
      capacity: MANUAL_POINT_PRESETS.capacity,
      priority: MANUAL_POINT_PRESETS.priority,
      reason: MANUAL_POINT_PRESETS.reason,
      status: MANUAL_POINT_PRESETS.status,
    });
  }, []);

  const startDemoMode = useCallback(() => {
    setDemoEnabled(true);
  }, []);

  const openRequestFromProposal = useCallback((point: DemoDraft) => {
    const params = new URLSearchParams({
      source: point.source,
      title: point.title,
      proposalType: point.proposalType,
      capacity: String(point.capacity),
      priority: point.priority,
      reason: point.reason,
      status: point.status,
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      settlement: point.title.split(' — ')[0] || '',
      region: 'Київська',
    });

    router.push(`/shelter-requests/new?${params.toString()}`);
  }, [router]);

  useEffect(() => {
    if (!demoEnabled || demoMode !== 'manual') {
      setManualDraft(null);
    }
  }, [demoEnabled, demoMode]);

  useEffect(() => {
    if (!terrainFocusPoints.some((point) => point.id === focusPointId)) {
      setFocusPointId(terrainFocusPoints[0]?.id ?? DEFAULT_TERRAIN_POINT.id);
    }
  }, [focusPointId, terrainFocusPoints]);

  useEffect(() => {
    if (!manualDraft) return;
    leafletMapRef.current?.closePopup();
  }, [manualDraft]);

  const demoInstructions =
    demoEnabled && demoMode === 'auto'
      ? 'Натисніть на маркер, щоб побачити коротку характеристику запропонованого укриття.'
      : demoEnabled && demoMode === 'manual'
        ? 'Натисніть на карту, щоб поставити нову точку і відкрити форму характеристики.'
        : 'Увімкніть демо режим, щоб планувати розміщення укриттів прямо на мапі.';


  return (
    <AppShell>
      <PageHeader
        title="Карта покриття"
        subtitle="Аналітика / Мапа Київської області"
        actions={
          <>
            {mapViewMode === '2d' && (
              <>
                <div className="relative">
                  <button
                    ref={layerDropdownButtonRef}
                    type="button"
                    onClick={() => {
                      const rect = layerDropdownButtonRef.current?.getBoundingClientRect();
                      if (rect) setLayerDropdownPos({ top: rect.bottom + 4, left: rect.left });
                      setLayerDropdownOpen((v) => !v);
                    }}
                    className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)]"
                  >
                    {showAllLayers
                      ? <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                      : selectedLayer === 'population'
                        ? <Users className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                        : selectedLayer === 'coverage'
                          ? <Shield className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                          : <Flame className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    }
                    <span>
                      {showAllLayers ? 'Всі шари' : selectedLayer === 'population' ? 'Населення' : selectedLayer === 'coverage' ? 'Покриття' : 'Дефіцит'}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  </button>

                  {layerDropdownOpen && layerDropdownPos && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setLayerDropdownOpen(false)} />
                      <div
                        className="fixed z-[9999] min-w-[160px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.24)]"
                        style={{ top: layerDropdownPos.top, left: layerDropdownPos.left }}
                      >
                        {([
                          { value: 'population' as const, label: 'Населення',  icon: <Users className="h-3.5 w-3.5" /> },
                          { value: 'coverage'   as const, label: 'Покриття',   icon: <Shield className="h-3.5 w-3.5" /> },
                          { value: 'combined'   as const, label: 'Дефіцит',    icon: <Flame className="h-3.5 w-3.5" /> },
                          { value: 'all'        as const, label: 'Всі шари',   icon: <Layers className="h-3.5 w-3.5" /> },
                        ]).map(({ value, label, icon }) => {
                          const isActive = value === 'all' ? showAllLayers : !showAllLayers && selectedLayer === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                if (value === 'all') {
                                  setShowAllLayers(true);
                                } else {
                                  setShowAllLayers(false);
                                  setSelectedLayer(value);
                                }
                                setLayerDropdownOpen(false);
                              }}
                              className={[
                                'flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-[var(--hover)]',
                                isActive ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                              ].join(' ')}
                            >
                              <span className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>{icon}</span>
                              {label}
                              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                            </button>
                          );
                        })}
                      </div>
                    </>,
                    document.body
                  )}
                </div>
                <div className="h-5 w-px bg-[var(--border)]" />
              </>
            )}
            <div className="flex rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] p-1">
              <ViewModeButton
                active={mapViewMode === '2d'}
                icon={<MapIcon className="h-3.5 w-3.5" />}
                label="2D"
                onClick={() => setMapViewMode('2d')}
              />
              <ViewModeButton
                active={mapViewMode === '3d'}
                icon={<Box className="h-3.5 w-3.5" />}
                label="3D"
                onClick={() => setMapViewMode('3d')}
              />
            </div>
            <div className="h-5 w-px bg-[var(--border)]" />
            <Button variant="outline" size="md" iconLeft={<Globe2 />}>
              Київська область
            </Button>
            <Button variant="outline" size="md" iconLeft={<Download />}>
              Експорт
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <Card padding="none" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_270px]">
            <div className="relative h-full border-r border-[var(--border)]" style={{ overflow: 'clip' }}>
              {mapViewMode === '2d' ? (
                <>
                  <CoverageLeafletMap
                    layer={selectedLayer}
                    showAllLayers={showAllLayers}
                    points={MOCK_LAYER_POINTS}
                    shelters={MOCK_SHELTERS}
                    onShelterClick={handleShelterClick}
                    demoEnabled={demoEnabled}
                    demoMode={demoMode}
                    demoPoints={visibleDemoPoints}
                    onDemoMapClick={handleDemoMapClick}
                    onDemoPointClick={handleDemoPointClick}
                    onCreateRequest={openRequestFromProposal}
                    onReady={handleMapReady}
                  />

                  {demoEnabled && (
                    <div className="pointer-events-none absolute left-4 top-4 z-[400] max-w-[300px] rounded-[12px] border border-[var(--border-strong)] bg-[var(--bg-overlay)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                      {demoInstructions}
                    </div>
                  )}

                  <div className="absolute right-4 top-4 z-[400] flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-overlay)] px-2 py-2">
                    <ControlButton icon={<Minus className="h-3.5 w-3.5" />} onClick={() => leafletMapRef.current?.zoomOut()} />
                    <span className="min-w-12 text-center text-[11px] font-semibold text-[var(--text-primary)]">
                      {leafletZoom !== null ? `z${leafletZoom}` : '—'}
                    </span>
                    <ControlButton icon={<Plus className="h-3.5 w-3.5" />} onClick={() => leafletMapRef.current?.zoomIn()} />
                    <ControlButton
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      onClick={() => leafletMapRef.current?.fitBounds([
                        [49.45, 29.15],
                        [50.95, 31.15],
                      ])}
                    />
                  </div>
                </>
              ) : (
                <Terrain3DMap
                  focusPoint={activeTerrainPoint}
                  shelters={MOCK_SHELTERS}
                  proposals={visibleDemoPoints}
                  layer={selectedLayer}
                  showAllLayers={showAllLayers}
                />
              )}
            </div>

            <div className="flex h-full min-h-0 flex-col border-l border-[var(--border)]">
              {/* Search + filter + sort */}
              <div className="shrink-0 border-b border-[var(--border)] p-3">
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Пошук укриттів..."
                      value={shelterSearch}
                      onChange={(e) => setShelterSearch(e.target.value)}
                      className="w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] py-2 pl-8 pr-3 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent-60)] focus:ring-2 focus:ring-[var(--accent-12)]"
                    />
                  </div>
                  <button
                    ref={filterButtonRef}
                    type="button"
                    onClick={() => {
                      const rect = filterButtonRef.current?.getBoundingClientRect();
                      if (rect) setFilterDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                      setShelterFilterOpen((v) => !v);
                    }}
                    className={[
                      'inline-flex h-[34px] w-[34px] items-center justify-center rounded-[var(--radius-lg)] border transition-colors',
                      shelterStatusFilter !== 'ALL'
                        ? 'border-[var(--accent-35)] bg-[var(--accent-10)] text-[var(--accent)]'
                        : 'border-[var(--border-strong)] bg-[var(--bg-surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                    ].join(' ')}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </button>

                  {shelterFilterOpen && filterDropdownPos && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setShelterFilterOpen(false)} />
                      <div
                        className="fixed z-[9999] min-w-[152px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.24)]"
                        style={{ top: filterDropdownPos.top, right: filterDropdownPos.right }}
                      >
                        {([
                          { value: 'ALL',         label: 'Всі статуси' },
                          { value: 'ACTIVE',      label: 'Активні' },
                          { value: 'MAINTENANCE', label: 'На сервісі' },
                          { value: 'INACTIVE',    label: 'Неактивні' },
                        ] as const).map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => { setShelterStatusFilter(value); setShelterFilterOpen(false); }}
                            className={[
                              'flex w-full items-center gap-2 px-3 py-2 text-[12px] transition-colors hover:bg-[var(--hover)]',
                              shelterStatusFilter === value
                                ? 'font-semibold text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)]',
                            ].join(' ')}
                          >
                            {shelterStatusFilter === value && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                            )}
                            <span className={shelterStatusFilter === value ? '' : 'ml-3.5'}>{label}</span>
                          </button>
                        ))}
                      </div>
                    </>,
                    document.body
                  )}
                  <button
                    type="button"
                    title={shelterSort === 'desc' ? 'Спадання' : shelterSort === 'asc' ? 'Зростання' : 'Без сортування'}
                    onClick={() => setShelterSort((v) => v === 'default' ? 'desc' : v === 'desc' ? 'asc' : 'default')}
                    className={[
                      'inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[var(--radius-lg)] border transition-colors',
                      shelterSort !== 'default'
                        ? 'border-[var(--accent-35)] bg-[var(--accent-10)] text-[var(--accent)]'
                        : 'border-[var(--border-strong)] bg-[var(--bg-surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                    ].join(' ')}
                  >
                    {shelterSort === 'asc' ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M4 9l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : shelterSort === 'desc' ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12V2M4 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M4 7h6M6 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Shelter list */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredShelters.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[12px] text-[var(--text-muted)]">Нічого не знайдено</p>
                ) : (
                  filteredShelters.map((shelter) => (
                    <button
                      key={shelter.id}
                      type="button"
                      onClick={() => handleShelterClick(shelter)}
                      className={[
                        'flex w-full items-start gap-3 border-b border-[var(--border-subtle)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)]',
                        activeShelterInList === shelter.id ? 'bg-[var(--accent-10)] hover:bg-[var(--accent-10)]' : '',
                      ].join(' ')}
                    >
                      <span className={[
                        'mt-1 h-2 w-2 shrink-0 rounded-full',
                        shelter.status === 'ACTIVE' ? 'bg-[var(--accent)] shadow-[0_0_6px_var(--accent-60)]' :
                        shelter.status === 'MAINTENANCE' ? 'bg-[#ffb454]' : 'bg-[var(--text-ghost)]',
                      ].join(' ')} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">{shelter.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{SHELTER_TYPE_LABEL[shelter.type]}</p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--accent)]">{shelter.capacity}</span>
                    </button>
                  ))
                )}
              </div>

            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--border)] px-5 py-3">
            <StatItem label="Укриттів" value={summary.totalShelters} tone="blue" />
            <div className="h-4 w-px bg-[var(--border)]" />
            <StatItem label="Верифікованих" value={summary.verifiedShelters} tone="green" />
            <div className="h-4 w-px bg-[var(--border)]" />
            <StatItem label="Покриття" value={`${summary.coverageRate}%`} tone="green" />
            <div className="h-4 w-px bg-[var(--border)]" />
            <StatItem label="Дефіцит" value={`${summary.shortageRate}%`} tone="red" />
            <div className="h-4 w-px bg-[var(--border)]" />
            <StatItem label="Активні" value={MOCK_SHELTERS.filter(s => s.status === 'ACTIVE').length} tone="green" />
            <div className="h-4 w-px bg-[var(--border)]" />
            <StatItem label="На сервісі" value={MOCK_SHELTERS.filter(s => s.status === 'MAINTENANCE').length} tone="yellow" />
            <div className="h-4 w-px bg-[var(--border)]" />
            <StatItem label="Неактивні" value={MOCK_SHELTERS.filter(s => s.status === 'INACTIVE').length} tone="red" />
          </div>
        </Card>
      </div>

      {selectedShelter && (
        <ShelterModal
          shelter={selectedShelter}
          onClose={() => setSelectedShelter(null)}
          onFlyTo={(shelter) => {
            setMapViewMode('2d');
            setSelectedShelter(null);
            setTimeout(() => leafletMapRef.current?.setView([shelter.latitude, shelter.longitude], 15), 50);
          }}
          onShow3D={(shelter) => {
            setFocusPointId(focusIdForShelter(shelter.id));
            setMapViewMode('3d');
            setSelectedShelter(null);
          }}
        />
      )}

      {manualDraft ? (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Закрити форму"
            className="absolute inset-0 cursor-default"
            onClick={cancelManualPoint}
          />
          <div className="relative z-[5001] w-full max-w-[680px] isolate rounded-[24px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 shadow-[0_40px_140px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionLabel>Ручний демо-режим</SectionLabel>
                <h3 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">
                  Налаштування нової точки укриття
                </h3>
                <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
                  Точка вже показана на карті. Збереження залишить її видимою до виходу з демо режиму.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelManualPoint}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-4">
                <Field label="Назва">
                  <input
                    value={draftForm.title}
                    onChange={(event) => setDraftForm((current) => ({ ...current, title: event.target.value }))}
                    className={fieldClassName}
                    placeholder="Наприклад, Шевченківський район"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Тип укриття">
                    <select
                      value={draftForm.proposalType}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          proposalType: event.target.value as DemoProposalPoint['proposalType'],
                        }))
                      }
                      className={fieldClassName}
                    >
                      <option value="STATIC">Стаціонарне</option>
                      <option value="MOBILE">Мобільне</option>
                      <option value="MODULAR">Модульне</option>
                    </select>
                  </Field>

                  <Field label="Пріоритет">
                    <select
                      value={draftForm.priority}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          priority: event.target.value as DemoProposalPoint['priority'],
                        }))
                      }
                      className={fieldClassName}
                    >
                      <option value="high">Високий</option>
                      <option value="medium">Середній</option>
                      <option value="low">Низький</option>
                    </select>
                  </Field>
                </div>

                <Field label="Місткість">
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={draftForm.capacity}
                    onChange={(event) => setDraftForm((current) => ({ ...current, capacity: event.target.value }))}
                    className={fieldClassName}
                  />
                </Field>

                <Field label="Обґрунтування">
                  <textarea
                    value={draftForm.reason}
                    onChange={(event) => setDraftForm((current) => ({ ...current, reason: event.target.value }))}
                    className={`${fieldClassName} min-h-[120px] resize-y`}
                    placeholder="Чому саме тут варто розмістити укриття?"
                  />
                </Field>
              </div>

              <div className="space-y-4">
                <Card padding="md" className="border border-[var(--border)] bg-white/[0.02]">
                  <SectionLabel>Координати</SectionLabel>
                  <div className="mt-3 space-y-3 text-[12px] text-[var(--text-secondary)]">
                    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2.5">
                      <span>Широта</span>
                      <span className="font-mono text-[var(--text-primary)]">{manualDraft.latitude.toFixed(5)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2.5">
                      <span>Довгота</span>
                      <span className="font-mono text-[var(--text-primary)]">{manualDraft.longitude.toFixed(5)}</span>
                    </div>
                    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2.5">
                      <p className="text-[11px] leading-5 text-[var(--text-secondary)]">
                        {demoMode === 'manual'
                          ? 'Точку можна зберегти, щоб вона залишилась до виходу з демо режиму.'
                          : 'Зберегти можна тільки в ручному режимі.'}
                      </p>
                    </div>
                  </div>
                </Card>

                <Field label="Статус">
                  <input
                    value={draftForm.status}
                    onChange={(event) => setDraftForm((current) => ({ ...current, status: event.target.value }))}
                    className={fieldClassName}
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button variant="primary" size="md" iconLeft={<Check />} onClick={saveManualPoint}>
                    Зберегти точку
                  </Button>
                  <Button variant="outline" size="md" onClick={cancelManualPoint}>
                    Скасувати
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}


function ViewModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-[calc(var(--radius-lg)-2px)] px-3 py-1.5 text-[11px] font-semibold transition-colors',
        active
          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
      ].join(' ')}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}

function ControlButton({
  icon,
  onClick,
}: {
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)]"
    >
      {icon}
    </button>
  );
}



const fieldClassName =
  'mt-2 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-60)] focus:ring-2 focus:ring-[var(--accent-12)]';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-[var(--text-primary)]">{label}</span>
      {children}
    </label>
  );
}


function StatItem({ label, value, tone }: { label: string; value: number | string; tone: 'blue' | 'green' | 'red' | 'yellow' }) {
  const toneStyles = {
    blue: 'text-[var(--color-info)]',
    green: 'text-[var(--accent)]',
    red: 'text-[var(--color-danger)]',
    yellow: 'text-[#ffb454]',
  }[tone];
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${toneStyles}`}>{value}</span>
    </div>
  );
}

const SHELTER_TYPE_LABEL: Record<ShelterPoint['type'], string> = {
  BASEMENT: 'Підвал / паркінг',
  SHELTER:  'Спеціальне сховище',
  METRO:    'Станція метро',
  OTHER:    'Інше',
};

const SHELTER_STATUS_LABEL: Record<ShelterPoint['status'], string> = {
  ACTIVE:      'Активне',
  INACTIVE:    'Неактивне',
  MAINTENANCE: 'На обслуговуванні',
};

const SHELTER_STATUS_COLOR: Record<ShelterPoint['status'], string> = {
  ACTIVE:      'text-[var(--accent)]',
  INACTIVE:    'text-[var(--text-secondary)]',
  MAINTENANCE: 'text-[#ffb454]',
};

function ShelterModal({
  shelter,
  onClose,
  onFlyTo,
  onShow3D,
}: {
  shelter: ShelterPoint;
  onClose: () => void;
  onFlyTo: (shelter: ShelterPoint) => void;
  onShow3D: (shelter: ShelterPoint) => void;
}) {
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Закрити"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-[5001] w-full max-w-[480px] rounded-[24px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-[0_40px_140px_rgba(0,0,0,0.72)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={[
              'mt-0.5 h-3 w-3 shrink-0 rounded-full',
              shelter.status === 'ACTIVE' ? 'bg-[var(--accent)] shadow-[0_0_8px_var(--accent-60)]' :
              shelter.status === 'MAINTENANCE' ? 'bg-[#ffb454]' : 'bg-[var(--text-ghost)]',
            ].join(' ')} />
            <div>
              <SectionLabel>Наявне укриття</SectionLabel>
              <h3 className="mt-0.5 text-[18px] font-semibold text-[var(--text-primary)]">{shelter.name}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-[13px] text-[var(--text-secondary)]">{shelter.address}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <InfoCell label="Місткість" value={`${shelter.capacity} осіб`} />
          <InfoCell label="Тип" value={SHELTER_TYPE_LABEL[shelter.type]} />
          <div className="rounded-[12px] border border-[var(--border)] bg-white/[0.02] px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">Статус</p>
            <p className={`mt-1 text-[13px] font-semibold ${SHELTER_STATUS_COLOR[shelter.status]}`}>
              {SHELTER_STATUS_LABEL[shelter.status]}
            </p>
          </div>
          <InfoCell label="Координати" value={`${shelter.latitude.toFixed(4)}, ${shelter.longitude.toFixed(4)}`} mono />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button variant="primary" size="md" onClick={onClose}>
            Відкрити
          </Button>
          <Button variant="outline" size="md" onClick={onClose}>
            Закрити
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <ModalIconButton
              title="Показати на мапі"
              onClick={() => onFlyTo(shelter)}
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.375 4.5 8.5 4.5 8.5S12.5 9.375 12.5 6c0-2.485-2.015-4.5-4.5-4.5Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" fill="currentColor"/>
                </svg>
              }
            />
            <ModalIconButton
              title="Відкрити 3D перегляд"
              onClick={() => onShow3D(shelter)}
              icon={<Box className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalIconButton({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--hover-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-strong)] hover:text-[var(--text-primary)]"
    >
      {icon}
    </button>
  );
}

function InfoCell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-white/[0.02] px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1 text-[13px] font-semibold text-[var(--text-primary)] ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</p>
    </div>
  );
}
