'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Pane, Popup, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import { useTheme } from '@/app/providers/ThemeProvider';
import { SectionLabel } from '@repo/ui';

export type LayerKey = 'population' | 'coverage' | 'combined';

export interface DataPoint {
  latitude: number;
  longitude: number;
  population: number;
  coverage: number;
  deficit: number;
}

export type DemoMode = 'auto' | 'manual';

export interface ShelterPoint {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  capacity: number;
  type: 'BASEMENT' | 'SHELTER' | 'METRO' | 'OTHER';
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
}

export interface DemoProposalPoint {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  proposalType: 'STATIC' | 'MOBILE' | 'MODULAR';
  capacity: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  status: string;
  source: 'automatic' | 'manual';
}

const OBLAST_BOUNDS: LatLngBoundsExpression = [[49.45, 29.15], [50.95, 31.15]];
const OBLAST = { latMin: 49.45, latMax: 50.95, lonMin: 29.15, lonMax: 31.15 };

type ColorKey = LayerKey | 'all';

const COLOR_STOPS: Record<ColorKey, [number, number, number][]> = {
  // population: dark charcoal → steel → navy → royal blue → sky → light sky
  population: [
    [0x25, 0x25, 0x25],
    [0x3d, 0x4a, 0x5c],
    [0x1e, 0x3a, 0x5f],
    [0x25, 0x63, 0xeb],
    [0x38, 0xbd, 0xf8],
    [0x7d, 0xd3, 0xfc],
  ],
  // coverage: dark charcoal → dark green-gray → forest → medium green → bright green → light green
  coverage: [
    [0x25, 0x25, 0x25],
    [0x2d, 0x3d, 0x35],
    [0x14, 0x53, 0x2d],
    [0x16, 0xa3, 0x4a],
    [0x22, 0xc5, 0x5e],
    [0x86, 0xef, 0xac],
  ],
  // combined/deficit: dark charcoal → gray → olive → amber → crimson → coral
  combined: [
    [0x25, 0x25, 0x25],
    [0x78, 0x78, 0x78],
    [0x7a, 0x55, 0x00],
    [0xe8, 0xa0, 0x00],
    [0x8b, 0x35, 0x35],
    [0xe0, 0x60, 0x60],
  ],
  // all layers: dark charcoal → purple-gray → deep purple → violet → light violet → pale
  all: [
    [0x25, 0x25, 0x25],
    [0x3d, 0x35, 0x47],
    [0x4c, 0x1d, 0x95],
    [0x7c, 0x3a, 0xed],
    [0xa7, 0x8b, 0xfa],
    [0xc4, 0xb5, 0xfd],
  ],
};

function needColor(t: number, key: ColorKey): string {
  const stops = COLOR_STOPS[key];
  const v = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const i = Math.min(Math.floor(v * n), n - 1);
  const f = v * n - i;
  const [ar, ag, ab] = stops[i];
  const [br, bg, bb] = stops[i + 1];
  return `rgb(${lerp(ar, br, f)},${lerp(ag, bg, f)},${lerp(ab, bb, f)})`;
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

type ActiveShelter = { latitude: number; longitude: number; capWeight: number };

function calcIntensity(
  lat: number,
  lon: number,
  points: readonly DataPoint[],
  activeShelters: ActiveShelter[],
  layer: LayerKey,
  showAll: boolean,
): number {
  const cosLat = Math.cos((lat * Math.PI) / 180);

  // Population density — wide Gaussian, σ=0.15° ≈ 16 km
  const twoSigPop = 2 * 0.15 * 0.15;
  let pop = 0;
  for (const p of points) {
    const dlat = lat - p.latitude;
    const dlon = (lon - p.longitude) * cosLat;
    pop += Math.exp(-(dlat * dlat + dlon * dlon) / twoSigPop) * p.population;
  }
  pop = Math.min(1, pop);

  if (layer === 'population' && !showAll) return pop;

  // Coverage — narrow Gaussian from actual shelter locations, σ=0.08° ≈ 9 km
  const twoSigCov = 2 * 0.08 * 0.08;
  let cov = 0;
  for (const s of activeShelters) {
    const dlat = lat - s.latitude;
    const dlon = (lon - s.longitude) * cosLat;
    cov += Math.exp(-(dlat * dlat + dlon * dlon) / twoSigCov) * s.capWeight;
  }
  cov = Math.min(1, cov);

  if (layer === 'coverage' && !showAll) return cov;

  // Deficit = unmet population demand (where people live but shelters don't reach)
  const deficit = Math.max(0, Math.min(1, pop - cov));

  if (showAll) return Math.min(1, (pop + deficit) / 2);
  return deficit;
}

function hexVertices(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((Math.PI / 180) * (-90 + 60 * k));
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(' ');
}

// ─── Hex grid layer rendered directly into the Leaflet container ──────────────

interface HexGridProps {
  points: readonly DataPoint[];
  shelters: readonly ShelterPoint[];
  layer: LayerKey;
  showAllLayers: boolean;
}

function HexGrid({ points, shelters, layer, showAllLayers }: HexGridProps) {
  const map = useMap();
  const rafRef = useRef<number>(0);
  const [cells, setCells] = useState<Array<{ id: string; positions: [number, number][]; fill: string; opacity: number }>>([]);

  useEffect(() => {
    const HEX_R = 26; // circumradius in pixels
    const SQRT3 = Math.sqrt(3);
    const COL_STEP = HEX_R * SQRT3;  // horizontal center-to-center
    const ROW_STEP = HEX_R * 1.5;   // vertical center-to-center

    function redraw() {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const mapSize = map.getSize();
        if (!mapSize.x || !mapSize.y) return;

        const parts: Array<{ id: string; positions: [number, number][]; fill: string; opacity: number }> = [];
        const { points: pts, shelters: shls, layer: lyr, showAllLayers: showAll } = { points, shelters, layer, showAllLayers };

        // Precompute active shelters once per redraw (skip inactive, weight maintenance at 40%)
        const activeShelters: ActiveShelter[] = shls
          .filter(s => s.status !== 'INACTIVE')
          .map(s => ({
            latitude: s.latitude,
            longitude: s.longitude,
            capWeight: (s.capacity / 500) * (s.status === 'MAINTENANCE' ? 0.4 : 1.0),
          }));

        const cols = Math.ceil(mapSize.x / COL_STEP) + 3;
        const rows = Math.ceil(mapSize.y / ROW_STEP) + 3;
        let index = 0;

        for (let row = -1; row < rows; row++) {
          const cy = row * ROW_STEP;
          const rowOffset = (row % 2 === 0 ? 0 : COL_STEP / 2);

          for (let col = -1; col < cols; col++) {
            const cx = col * COL_STEP + rowOffset;

            const latlng = map.containerPointToLatLng([cx, cy]);
            const { lat, lng } = latlng;

            // Clip to Kyiv Oblast bounding box
            if (
              lat < OBLAST.latMin ||
              lat > OBLAST.latMax ||
              lng < OBLAST.lonMin ||
              lng > OBLAST.lonMax
            ) continue;

            // Build vertices FIRST, then reject any hex that extends outside bounds.
            // This prevents partial hexagons at the oblast border.
            const verts: [number, number][] = [];
            let insideBounds = true;
            for (let k = 0; k < 6; k++) {
              const a = (Math.PI / 180) * (-90 + 60 * k);
              const vx = cx + (HEX_R - 1.2) * Math.cos(a);
              const vy = cy + (HEX_R - 1.2) * Math.sin(a);
              const v = map.containerPointToLatLng([vx, vy]);
              if (
                v.lat < OBLAST.latMin || v.lat > OBLAST.latMax ||
                v.lng < OBLAST.lonMin || v.lng > OBLAST.lonMax
              ) { insideBounds = false; break; }
              verts.push([v.lat, v.lng]);
            }
            if (!insideBounds) continue;

            const intensity = calcIntensity(lat, lng, pts, activeShelters, lyr, showAll);
            const colorKey: ColorKey = showAll ? 'all' : lyr;
            const fill = needColor(intensity, colorKey);
            const opacity = 0.15 + intensity * 0.78;
            parts.push({
              id: `hex-${index++}`,
              positions: verts,
              fill,
              opacity,
            });
          }
        }

        setCells(parts);
      });
    }

    map.on('move', redraw);
    map.on('zoomend', redraw);
    redraw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off('move', redraw);
      map.off('zoomend', redraw);
    };
  }, [map, points, shelters, layer, showAllLayers]);

  // Trigger redraw whenever layer/data/shelters change without recreating DOM
  useEffect(() => {
    if (!map) return;
    const mapSize = map.getSize();
    if (!mapSize.x) return;
    map.fire('move');
  }, [points, shelters, layer, showAllLayers, map]);

  return (
    <Pane name="hex-grid" style={{ zIndex: 350, pointerEvents: 'none' }}>
      {cells.map((cell) => (
        <Polygon
          key={cell.id}
          positions={cell.positions}
          pane="hex-grid"
          pathOptions={{
            fillColor: cell.fill,
            fillOpacity: cell.opacity,
            color: 'rgba(255,255,255,0.07)',
            weight: 0.6,
          }}
        />
      ))}
    </Pane>
  );
}

interface DemoOverlayProps {
  enabled: boolean;
  mode: DemoMode;
  points: readonly DemoProposalPoint[];
  onMapClick?: (latitude: number, longitude: number) => void;
  onPointClick?: (point: DemoProposalPoint) => void;
  onCreateRequest?: (point: DemoProposalPoint) => void;
}

function DemoOverlay({ enabled, mode, points, onMapClick, onPointClick, onCreateRequest }: DemoOverlayProps) {
  useMapEvents({
    click(event) {
      if (!enabled || mode !== 'manual' || !onMapClick) return;
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });

  if (!enabled || points.length === 0) {
    return null;
  }

  return (
    <Pane name="demo-markers" style={{ zIndex: 780 }}>
      {points.map((point) => {
        const palette =
          point.priority === 'high'
            ? { fill: '#ff6b6b', stroke: '#ffb454' }
            : point.priority === 'medium'
              ? { fill: '#ffb454', stroke: '#ffe08a' }
              : { fill: 'var(--accent)', stroke: '#7bf7c8' };

        const radius = point.source === 'automatic' ? 10 : 12;
        const opacity = point.source === 'automatic' ? 0.88 : 1;

        return (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={radius}
            pane="demo-markers"
            eventHandlers={{ click: () => onPointClick?.(point) }}
            pathOptions={{
              color: palette.stroke,
              fillColor: palette.fill,
              fillOpacity: opacity,
              weight: 2,
            }}
          >
            <Popup className="demo-proposal-popup" pane="demo-popups" closeButton>
              <div className="min-w-[240px] space-y-2 rounded-[18px] bg-[var(--bg-surface-2)] p-1 text-[var(--text-primary)]">
                <div>
                  <SectionLabel>{point.source === 'automatic' ? 'Автоматична пропозиція' : 'Ручне планування'}</SectionLabel>
                  <p className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">{point.title}</p>
                </div>
                <div className="space-y-1 rounded-[14px] border border-[var(--border-strong)] bg-[var(--hover)] px-3 py-3 text-[12px] text-[var(--text-secondary)]">
                  <p><span className="font-medium text-[var(--text-primary)]">Тип:</span> {proposalTypeLabel(point.proposalType)}</p>
                  <p><span className="font-medium text-[var(--text-primary)]">Місткість:</span> {point.capacity} осіб</p>
                  <p><span className="font-medium text-[var(--text-primary)]">Пріоритет:</span> {priorityLabel(point.priority)}</p>
                  <p><span className="font-medium text-[var(--text-primary)]">Статус:</span> {point.status}</p>
                </div>
                <p className="rounded-[14px] border border-[var(--border)] bg-[var(--hover-md)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                  {point.reason}
                </p>
                <p className="font-mono text-[11px] text-[var(--text-muted)]">
                  {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                </p>
                {onCreateRequest ? (
                  <button
                    type="button"
                    onClick={() => onCreateRequest(point)}
                    className="inline-flex w-full items-center justify-center rounded-[14px] bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-[#04110b] transition-colors hover:bg-[#7bf7c8]"
                  >
                    Сформувати заявку
                  </button>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </Pane>
  );
}

function proposalTypeLabel(type: DemoProposalPoint['proposalType']) {
  return {
    STATIC: 'Стаціонарне',
    MOBILE: 'Мобільне',
    MODULAR: 'Модульне',
  }[type];
}

function priorityLabel(priority: DemoProposalPoint['priority']) {
  return {
    high: 'високий',
    medium: 'середній',
    low: 'низький',
  }[priority];
}

// ─── Shelter markers ─────────────────────────────────────────────────────────

interface ShelterMarkersProps {
  shelters: readonly ShelterPoint[];
  onShelterClick: (shelter: ShelterPoint) => void;
}

function ShelterMarkers({ shelters, onShelterClick }: ShelterMarkersProps) {
  const accentColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00e5a0'
    : '#00e5a0';
  return (
    <Pane name="shelter-markers" style={{ zIndex: 500 }}>
      {shelters.map((shelter) => (
        <CircleMarker
          key={shelter.id}
          center={[shelter.latitude, shelter.longitude]}
          radius={6}
          pane="shelter-markers"
          pathOptions={{
            fillColor: shelter.status === 'ACTIVE' ? accentColor : shelter.status === 'MAINTENANCE' ? '#ffb454' : '#8892a4',
            fillOpacity: 0.92,
            color: shelter.status === 'ACTIVE' ? `${accentColor}73` : shelter.status === 'MAINTENANCE' ? 'rgba(255,180,84,0.45)' : 'rgba(136,146,164,0.35)',
            weight: 3,
          }}
          eventHandlers={{ click: () => onShelterClick(shelter) }}
        />
      ))}
    </Pane>
  );
}

// ─── Map ref bridge ───────────────────────────────────────────────────────────

function MapRefBridge({ onReady }: { onReady: (m: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function CoverageLeafletMap({
  layer,
  showAllLayers,
  points,
  shelters = [],
  onShelterClick,
  demoEnabled = false,
  demoMode = 'auto',
  demoPoints = [],
  onDemoMapClick,
  onDemoPointClick,
  onCreateRequest,
  onReady,
}: {
  layer: LayerKey;
  showAllLayers: boolean;
  points: readonly DataPoint[];
  shelters?: readonly ShelterPoint[];
  onShelterClick?: (shelter: ShelterPoint) => void;
  demoEnabled?: boolean;
  demoMode?: DemoMode;
  demoPoints?: readonly DemoProposalPoint[];
  onDemoMapClick?: (latitude: number, longitude: number) => void;
  onDemoPointClick?: (point: DemoProposalPoint) => void;
  onCreateRequest?: (point: DemoProposalPoint) => void;
  onReady?: (m: LeafletMap) => void;
}) {
  const { theme } = useTheme();
  const tileUrl = theme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const popupBg = theme === 'light' ? 'rgba(255,255,255,0.98)' : 'rgba(17,21,28,0.98)';
  const popupText = theme === 'light' ? '#0d1117' : '#f0f2f8';
  const popupBorder = theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const popupCloseFg = theme === 'light' ? '#374151' : '#f8fafc';
  const popupCloseHover = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)';

  return (
    <>
      <MapContainer
        bounds={OBLAST_BOUNDS}
        style={{ width: '100%', height: '100%', borderRadius: '18px', overflow: 'hidden' }}
        zoomControl={false}
        attributionControl={false}
      >
        {onReady && <MapRefBridge onReady={onReady} />}
        <Pane name="demo-popups" style={{ zIndex: 820 }} />
        <TileLayer
          key={tileUrl}
          url={tileUrl}
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        <HexGrid points={points} shelters={shelters} layer={layer} showAllLayers={showAllLayers} />
        {onShelterClick && shelters.length > 0 && (
          <ShelterMarkers shelters={shelters} onShelterClick={onShelterClick} />
        )}
        <DemoOverlay
          enabled={demoEnabled}
          mode={demoMode}
          points={demoPoints}
          onMapClick={onDemoMapClick}
          onPointClick={onDemoPointClick}
          onCreateRequest={onCreateRequest}
        />
      </MapContainer>
      <style jsx global>{`
        .demo-proposal-popup .leaflet-popup-content-wrapper {
          background: ${popupBg};
          color: ${popupText};
          border: 1px solid ${popupBorder};
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
          border-radius: 18px;
          padding: 0;
        }
        .demo-proposal-popup .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }
        .demo-proposal-popup .leaflet-popup-tip {
          background: ${popupBg};
          box-shadow: none;
        }
        .demo-proposal-popup .leaflet-popup-close-button {
          color: ${popupCloseFg};
          top: 10px;
          right: 10px;
          width: 24px;
          height: 24px;
          line-height: 24px;
          border-radius: 9999px;
        }
        .demo-proposal-popup .leaflet-popup-close-button:hover {
          background: ${popupCloseHover};
        }
      `}</style>
    </>
  );
}
