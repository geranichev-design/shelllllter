'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { DemoProposalPoint, LayerKey, ShelterPoint } from './CoverageLeafletMap';

export type TerrainFocusPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  category: 'shelter' | 'proposal';
  status: string;
  capacity?: number;
  priority?: DemoProposalPoint['priority'];
};

type Terrain3DMapProps = {
  focusPoint: TerrainFocusPoint;
  shelters: readonly ShelterPoint[];
  proposals: readonly DemoProposalPoint[];
  layer: LayerKey;
  showAllLayers: boolean;
};

type Road = {
  x: number;
  z: number;
  length: number;
  width: number;
  angle: number;
};

const TILE_WIDTH = 96;
const TILE_DEPTH = 72;
const HALF_WIDTH = TILE_WIDTH / 2;
const HALF_DEPTH = TILE_DEPTH / 2;

const layerTint: Record<LayerKey | 'all', number> = {
  population: 0x8cc8e8,
  coverage: 0x9bdb8a,
  combined: 0xf1b46b,
  all: 0xb8a6e8,
};

const buildingHeightExpression = [
  'case',
  ['>', ['to-number', ['get', 'render_height'], 0], 0],
  ['to-number', ['get', 'render_height'], 0],
  ['>', ['to-number', ['get', 'height'], 0], 0],
  ['to-number', ['get', 'height'], 0],
  ['>', ['to-number', ['get', 'building:levels'], 0], 0],
  ['*', ['to-number', ['get', 'building:levels'], 0], 3],
  10,
] as any;

export default function Terrain3DMap({
  focusPoint,
  shelters,
  proposals,
  layer,
  showAllLayers,
}: Terrain3DMapProps) {
  const [realMapFailed, setRealMapFailed] = useState(false);
  const handleRealMapError = useCallback(() => setRealMapFailed(true), []);
  const seedLabel = useMemo(
    () => `${focusPoint.latitude.toFixed(5)}:${focusPoint.longitude.toFixed(5)}:${focusPoint.id}`,
    [focusPoint.id, focusPoint.latitude, focusPoint.longitude],
  );

  if (!realMapFailed) {
    return (
      <RealMapLibre3DMap
        focusPoint={focusPoint}
        shelters={shelters}
        proposals={proposals}
        onMapError={handleRealMapError}
      />
    );
  }

  return (
    <ProceduralTerrain3DMap
      focusPoint={focusPoint}
      shelters={shelters}
      proposals={proposals}
      layer={layer}
      showAllLayers={showAllLayers}
      seedLabel={seedLabel}
    />
  );
}

function RealMapLibre3DMap({
  focusPoint,
  shelters,
  proposals,
  onMapError,
}: {
  focusPoint: TerrainFocusPoint;
  shelters: readonly ShelterPoint[];
  proposals: readonly DemoProposalPoint[];
  onMapError: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: [focusPoint.longitude, focusPoint.latitude],
        zoom: 16.9,
        pitch: 64,
        bearing: -18,
        canvasContextAttributes: { antialias: true },
        attributionControl: false,
      });
    } catch {
      onMapError();
      return;
    }

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      const layers = map.getStyle().layers ?? [];
      const labelLayer = layers.find((entry) => entry.type === 'symbol' && Boolean(entry.layout?.['text-field']));

      if (!map.getSource('openfreemap')) {
        map.addSource('openfreemap', {
          url: 'https://tiles.openfreemap.org/planet',
          type: 'vector',
        });
      }

      if (!map.getLayer('3d-buildings')) {
        map.addLayer(
          {
            id: '3d-buildings',
            source: 'openfreemap',
            'source-layer': 'building',
            filter: ['!=', ['get', 'hide_3d'], true],
            type: 'fill-extrusion',
            minzoom: 15,
            paint: {
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                buildingHeightExpression,
                0,
                '#d8d9d6',
                120,
                '#b7c3d9',
                280,
                '#8fa8d8',
              ],
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15,
                0,
                16,
                buildingHeightExpression,
              ],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.92,
            },
          },
          labelLayer?.id,
        );
      }
    });

    return () => {
      clearMapMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [focusPoint.latitude, focusPoint.longitude, onMapError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      center: [focusPoint.longitude, focusPoint.latitude],
      zoom: 16.9,
      pitch: 64,
      bearing: focusPoint.category === 'proposal' ? -32 : -18,
      duration: 900,
      essential: true,
    });
  }, [focusPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    clearMapMarkers();

    const focusMarker = new maplibregl.Marker({
      element: createMapMarkerElement(focusPoint.category === 'proposal' ? 'proposal-focus' : 'shelter-focus'),
      anchor: 'bottom',
    })
      .setLngLat([focusPoint.longitude, focusPoint.latitude])
      .setPopup(
        new maplibregl.Popup({ closeButton: false, offset: 20 }).setHTML(
          `<div class="terrain-map-popup">
            <strong>${escapeHtml(focusPoint.label)}</strong>
            <span>${escapeHtml(focusPoint.status)}</span>
            <code>${focusPoint.latitude.toFixed(5)}, ${focusPoint.longitude.toFixed(5)}</code>
          </div>`,
        ),
      )
      .addTo(map);

    markersRef.current.push(focusMarker);

    shelters.forEach((shelter) => {
      if (`shelter:${shelter.id}` === focusPoint.id) return;
      if (!isCloseToFocus(shelter.latitude, shelter.longitude, focusPoint)) return;

      const marker = new maplibregl.Marker({
        element: createMapMarkerElement(shelter.status === 'ACTIVE' ? 'shelter' : 'shelter-muted'),
        anchor: 'center',
      })
        .setLngLat([shelter.longitude, shelter.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });

    proposals.forEach((proposal) => {
      if (`proposal:${proposal.id}` === focusPoint.id) return;
      if (!isCloseToFocus(proposal.latitude, proposal.longitude, focusPoint)) return;

      const marker = new maplibregl.Marker({
        element: createMapMarkerElement(proposal.priority === 'high' ? 'proposal-high' : 'proposal'),
        anchor: 'center',
      })
        .setLngLat([proposal.longitude, proposal.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [focusPoint, proposals, shelters]);

  function clearMapMarkers() {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-[18px] bg-[#eff1ef]">
      <div ref={mapContainerRef} aria-label="Реальна 3D мапа MapLibre" className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 max-w-[360px] rounded-[14px] border border-black/10 bg-white/90 px-3 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.16)] backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {focusPoint.category === 'proposal' ? 'Запропонована точка' : 'Укриття'}
        </p>
        <p className="mt-1 truncate text-[14px] font-semibold text-slate-950">{focusPoint.label}</p>
        <p className="mt-1 font-mono text-[11px] text-slate-600">
          {focusPoint.latitude.toFixed(5)}, {focusPoint.longitude.toFixed(5)}
        </p>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur">
        MapLibre real 3D
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-black/10 bg-white/88 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
          OSM buildings
        </span>
        <span className="rounded-full border border-black/10 bg-white/88 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
          OpenFreeMap
        </span>
      </div>

      <style jsx global>{`
        .maplibregl-ctrl-group {
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
        }

        .terrain-map-marker {
          width: 13px;
          height: 13px;
          border: 2px solid #fff;
          border-radius: 9999px;
          background: #17af81;
          box-shadow: 0 0 0 4px rgba(23, 175, 129, 0.2), 0 8px 20px rgba(15, 23, 42, 0.25);
        }

        .terrain-map-marker.shelter-muted {
          background: #ffb454;
          box-shadow: 0 0 0 4px rgba(255, 180, 84, 0.2), 0 8px 20px rgba(15, 23, 42, 0.25);
        }

        .terrain-map-marker.proposal,
        .terrain-map-marker.proposal-high {
          background: #ff8a4c;
          box-shadow: 0 0 0 4px rgba(255, 138, 76, 0.22), 0 8px 20px rgba(15, 23, 42, 0.25);
        }

        .terrain-map-marker.proposal-high {
          background: #ff5d42;
          box-shadow: 0 0 0 5px rgba(255, 93, 66, 0.24), 0 8px 20px rgba(15, 23, 42, 0.3);
        }

        .terrain-map-marker.shelter-focus,
        .terrain-map-marker.proposal-focus {
          width: 28px;
          height: 28px;
          border: 3px solid #fff;
          background: #ff5d42;
          box-shadow: 0 0 0 7px rgba(255, 93, 66, 0.25), 0 12px 34px rgba(15, 23, 42, 0.34);
        }

        .terrain-map-marker.shelter-focus::after,
        .terrain-map-marker.proposal-focus::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: #fff;
          transform: translate(-50%, -50%);
        }

        .terrain-map-marker.proposal-focus {
          background: #ff8a4c;
        }

        .terrain-map-popup {
          display: grid;
          gap: 4px;
          min-width: 180px;
          color: #0f172a;
          font-family: inherit;
        }

        .terrain-map-popup strong {
          font-size: 13px;
          line-height: 1.25;
        }

        .terrain-map-popup span {
          color: #475569;
          font-size: 11px;
        }

        .terrain-map-popup code {
          color: #64748b;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}

function ProceduralTerrain3DMap({
  focusPoint,
  shelters,
  proposals,
  layer,
  showAllLayers,
  seedLabel,
}: Terrain3DMapProps & { seedLabel: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f5f4);
    scene.fog = new THREE.Fog(0xf4f5f4, 96, 160);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-55, 55, 36, -36, 0.1, 500);
    camera.position.set(72, 68, 72);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.22;
    controls.minZoom = 0.68;
    controls.maxZoom = 1.75;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.target.set(0, 2, 0);

    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xb8c1bb, 2.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(48, 82, 32);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -80;
    keyLight.shadow.camera.right = 80;
    keyLight.shadow.camera.top = 80;
    keyLight.shadow.camera.bottom = -80;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc8f3ff, 0.8);
    fillLight.position.set(-42, 48, -54);
    scene.add(fillLight);

    const world = buildTerrainWorld({
      focusPoint,
      shelters,
      proposals,
      layer,
      showAllLayers,
      seed: hashString(seedLabel),
    });
    scene.add(world);

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      const safeWidth = Math.max(width, 1);
      const safeHeight = Math.max(height, 1);
      renderer.setSize(safeWidth, safeHeight, false);

      const aspect = safeWidth / safeHeight;
      const viewHeight = 70;
      camera.left = (-viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      scene.remove(world);
      disposeObject(world);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [focusPoint, layer, proposals, seedLabel, shelters, showAllLayers]);

  const focusKind = focusPoint.category === 'proposal' ? 'Запропонована точка' : 'Укриття';
  const tintColor = showAllLayers ? '#8f7df2' : {
    population: '#5aa9d6',
    coverage: '#59b86f',
    combined: '#d88b4b',
  }[layer];

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-[18px] bg-[#f4f5f4]">
      <div ref={mountRef} aria-label="3D мапа місцевості" className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 max-w-[360px] rounded-[14px] border border-black/10 bg-white/88 px-3 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.16)] backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {focusKind}
        </p>
        <p className="mt-1 truncate text-[14px] font-semibold text-slate-950">{focusPoint.label}</p>
        <p className="mt-1 font-mono text-[11px] text-slate-600">
          {focusPoint.latitude.toFixed(5)}, {focusPoint.longitude.toFixed(5)}
        </p>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-black/10 bg-white/88 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur">
        3D fallback
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-black/10 bg-white/86 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
          Будівлі
        </span>
        <span className="rounded-full border border-black/10 bg-white/86 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
          Дороги
        </span>
        <span className="rounded-full border border-black/10 bg-white/86 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
          Зелені зони
        </span>
        <span
          className="rounded-full border border-black/10 bg-white/86 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm"
          style={{ boxShadow: `inset 0 -2px 0 ${tintColor}` }}
        >
          {showAllLayers ? 'Всі шари' : layerLabel(layer)}
        </span>
      </div>
    </div>
  );
}

function createMapMarkerElement(kind: string) {
  const element = document.createElement('div');
  element.className = `terrain-map-marker ${kind}`;
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function isCloseToFocus(latitude: number, longitude: number, focusPoint: TerrainFocusPoint) {
  const latKm = Math.abs(latitude - focusPoint.latitude) * 111;
  const lonKm = Math.abs(longitude - focusPoint.longitude) * 111 * Math.cos((focusPoint.latitude * Math.PI) / 180);
  return Math.hypot(latKm, lonKm) <= 4;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildTerrainWorld({
  focusPoint,
  shelters,
  proposals,
  layer,
  showAllLayers,
  seed,
}: {
  focusPoint: TerrainFocusPoint;
  shelters: readonly ShelterPoint[];
  proposals: readonly DemoProposalPoint[];
  layer: LayerKey;
  showAllLayers: boolean;
  seed: number;
}) {
  const rng = createRng(seed);
  const world = new THREE.Group();
  world.rotation.y = -0.12 + (rng() - 0.5) * 0.08;

  const materials = {
    slabTop: new THREE.MeshStandardMaterial({ color: 0xe8e5de, roughness: 0.92, metalness: 0 }),
    slabSide: new THREE.MeshStandardMaterial({ color: 0x8c9690, roughness: 0.86, metalness: 0 }),
    terrain: new THREE.MeshStandardMaterial({
      color: showAllLayers ? layerTint.all : layerTint[layer],
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      flatShading: true,
    }),
    road: new THREE.MeshStandardMaterial({ color: 0xb8bab6, roughness: 0.82, metalness: 0 }),
    roadLine: new THREE.MeshStandardMaterial({ color: 0xf8f7f0, roughness: 0.8, metalness: 0 }),
    building: new THREE.MeshStandardMaterial({ color: 0xf5f6f4, roughness: 0.78, metalness: 0 }),
    buildingAlt: new THREE.MeshStandardMaterial({ color: 0xe1e6e4, roughness: 0.82, metalness: 0 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xd4dad7, roughness: 0.86, metalness: 0 }),
    grass: new THREE.MeshStandardMaterial({ color: 0xaed98a, roughness: 0.92, metalness: 0 }),
    grassDark: new THREE.MeshStandardMaterial({ color: 0x83bf61, roughness: 0.92, metalness: 0 }),
    treeTrunk: new THREE.MeshStandardMaterial({ color: 0x80531e, roughness: 0.9, metalness: 0 }),
    treeLeaf: new THREE.MeshStandardMaterial({ color: 0x44c83f, roughness: 0.9, metalness: 0, flatShading: true }),
    treeLeafLight: new THREE.MeshStandardMaterial({ color: 0x72d96a, roughness: 0.9, metalness: 0, flatShading: true }),
    target: new THREE.MeshStandardMaterial({ color: 0xff5d42, roughness: 0.48, metalness: 0.05 }),
    targetGlow: new THREE.MeshStandardMaterial({
      color: 0xffb454,
      roughness: 0.35,
      metalness: 0,
      transparent: true,
      opacity: 0.68,
      emissive: 0xff6b3d,
      emissiveIntensity: 0.35,
    }),
    shelterPoint: new THREE.MeshStandardMaterial({ color: 0x17af81, roughness: 0.55, metalness: 0.04 }),
    proposalPoint: new THREE.MeshStandardMaterial({ color: 0xff8a4c, roughness: 0.55, metalness: 0.04 }),
  };

  const slab = new THREE.Mesh(new THREE.BoxGeometry(TILE_WIDTH, 4, TILE_DEPTH), [
    materials.slabSide,
    materials.slabSide,
    materials.slabTop,
    materials.slabSide,
    materials.slabSide,
    materials.slabSide,
  ]);
  slab.position.y = -2.25;
  slab.receiveShadow = true;
  world.add(slab);

  const terrainGeometry = new THREE.PlaneGeometry(TILE_WIDTH - 1, TILE_DEPTH - 1, 30, 22);
  const pos = terrainGeometry.attributes.position as THREE.BufferAttribute;
  const waveA = rng() * Math.PI * 2;
  const waveB = rng() * Math.PI * 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const borderFade = Math.min(
      1,
      Math.max(0, (HALF_WIDTH - Math.abs(x)) / 18),
      Math.max(0, (HALF_DEPTH - Math.abs(y)) / 14),
    );
    const height =
      (Math.sin(x * 0.11 + waveA) * 0.62 +
        Math.cos(y * 0.13 + waveB) * 0.45 +
        Math.sin((x + y) * 0.07 + waveA * 0.4) * 0.32) *
      borderFade;
    pos.setZ(i, height);
  }
  terrainGeometry.computeVertexNormals();

  const terrain = new THREE.Mesh(terrainGeometry, materials.terrain);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = 0.03;
  terrain.receiveShadow = true;
  world.add(terrain);

  const roadAngle = (rng() - 0.5) * 0.26;
  const roads: Road[] = [
    { x: 0, z: -1 + (rng() - 0.5) * 4, length: 116, width: 6.4, angle: roadAngle },
    { x: -20 + (rng() - 0.5) * 5, z: -2, length: 82, width: 4.6, angle: Math.PI / 2 + roadAngle * 0.34 },
    { x: 22, z: 17 + (rng() - 0.5) * 3, length: 74, width: 4.1, angle: -0.58 + roadAngle * 0.5 },
    { x: 4, z: -22 + (rng() - 0.5) * 2, length: 78, width: 3.8, angle: 0.48 + roadAngle * 0.4 },
  ];

  roads.forEach((road, index) => {
    addRoad(world, materials.road, road);
    if (index < 3) addRoadDashes(world, materials.roadLine, road);
  });

  addParks(world, materials, roads, rng);
  addBuildings(world, materials, roads, rng);
  addTrees(world, materials, roads, rng);
  addNearbyPoints(world, materials, focusPoint, shelters, proposals);
  addTargetMarker(world, materials, focusPoint);

  return world;
}

function addRoad(group: THREE.Group, material: THREE.Material, road: Road) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(road.length, 0.1, road.width), material);
  mesh.position.set(road.x, 0.16, road.z);
  mesh.rotation.y = road.angle;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function addRoadDashes(group: THREE.Group, material: THREE.Material, road: Road) {
  const dashCount = Math.floor(road.length / 9);
  for (let i = -dashCount; i <= dashCount; i += 2) {
    const along = i * 4.5;
    if (Math.abs(along) > road.length / 2 - 5) continue;
    const x = road.x + Math.cos(road.angle) * along;
    const z = road.z + Math.sin(road.angle) * along;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.05, 0.28), material);
    dash.position.set(x, 0.24, z);
    dash.rotation.y = road.angle;
    group.add(dash);
  }
}

function addParks(group: THREE.Group, materials: Record<string, THREE.Material>, roads: Road[], rng: () => number) {
  const patches = [
    { x: -34, z: 23, sx: 17, sz: 11, angle: -0.12 },
    { x: 31, z: -21, sx: 19, sz: 9, angle: 0.18 },
    { x: 4, z: 25, sx: 13, sz: 7, angle: 0.3 },
    { x: -4, z: -28, sx: 16, sz: 7, angle: -0.18 },
  ];

  patches.forEach((patch, index) => {
    if (roads.some((road) => isNearRoad(patch.x, patch.z, road, 2))) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(patch.sx + rng() * 4, 0.08, patch.sz + rng() * 3),
      index % 2 === 0 ? materials.grass : materials.grassDark,
    );
    mesh.position.set(patch.x, 0.2, patch.z);
    mesh.rotation.y = patch.angle;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
}

function addBuildings(group: THREE.Group, materials: Record<string, THREE.Material>, roads: Road[], rng: () => number) {
  const taken: Array<{ x: number; z: number; r: number }> = [{ x: 0, z: 0, r: 9 }];
  let placed = 0;

  for (let x = -39; x <= 40; x += 7.7) {
    for (let z = -28; z <= 29; z += 7.2) {
      if (placed > 42) return;
      if (rng() < 0.26) continue;

      const bx = x + (rng() - 0.5) * 3.2;
      const bz = z + (rng() - 0.5) * 3.2;
      if (Math.abs(bx) > 44 || Math.abs(bz) > 32) continue;
      if (roads.some((road) => isNearRoad(bx, bz, road, 4.2))) continue;
      if (taken.some((spot) => Math.hypot(spot.x - bx, spot.z - bz) < spot.r)) continue;

      const footprintX = 3.2 + rng() * 7.2;
      const footprintZ = 3.2 + rng() * 6.2;
      const downtownBoost = Math.max(0, 1 - Math.hypot(bx * 0.8, bz) / 38);
      const height = 2.3 + rng() * 6.5 + downtownBoost * (rng() * 13);
      const material = rng() > 0.34 ? materials.building : materials.buildingAlt;
      const building = new THREE.Mesh(new THREE.BoxGeometry(footprintX, height, footprintZ), material);
      building.position.set(bx, height / 2 + 0.18, bz);
      building.rotation.y = (rng() - 0.5) * 0.24;
      building.castShadow = true;
      building.receiveShadow = true;
      group.add(building);
      addEdges(group, building, 0x9fa8a3, 0.56);

      if (rng() > 0.58) {
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(footprintX * 0.82, 0.26, footprintZ * 0.82),
          materials.roof,
        );
        roof.position.set(bx, height + 0.36, bz);
        roof.rotation.y = building.rotation.y;
        roof.castShadow = true;
        group.add(roof);
      }

      taken.push({ x: bx, z: bz, r: Math.max(footprintX, footprintZ) * 0.82 + 3 });
      placed += 1;
    }
  }
}

function addTrees(group: THREE.Group, materials: Record<string, THREE.Material>, roads: Road[], rng: () => number) {
  const treeGeometry = new THREE.ConeGeometry(1.05, 2.4, 6);
  const crownGeometry = new THREE.ConeGeometry(1.35, 2.8, 6);
  const trunkGeometry = new THREE.CylinderGeometry(0.18, 0.24, 1.35, 5);

  for (let i = 0; i < 125; i++) {
    const edgeBias = rng();
    const x = edgeBias < 0.46 ? (rng() < 0.5 ? -42 + rng() * 8 : 34 + rng() * 10) : -42 + rng() * 84;
    const z = edgeBias > 0.54 ? (rng() < 0.5 ? -31 + rng() * 7 : 23 + rng() * 9) : -30 + rng() * 60;

    if (Math.hypot(x, z) < 8) continue;
    if (roads.some((road) => isNearRoad(x, z, road, 2.2))) continue;

    const scale = 0.72 + rng() * 0.58;
    const tree = new THREE.Group();
    tree.position.set(x, 0.2, z);
    tree.rotation.y = rng() * Math.PI;

    const trunk = new THREE.Mesh(trunkGeometry, materials.treeTrunk);
    trunk.position.y = 0.68 * scale;
    trunk.scale.setScalar(scale);
    trunk.castShadow = true;
    tree.add(trunk);

    const lower = new THREE.Mesh(crownGeometry, rng() > 0.55 ? materials.treeLeafLight : materials.treeLeaf);
    lower.position.y = 2.0 * scale;
    lower.scale.setScalar(scale);
    lower.castShadow = true;
    tree.add(lower);

    const upper = new THREE.Mesh(treeGeometry, materials.treeLeaf);
    upper.position.y = 3.05 * scale;
    upper.scale.setScalar(scale * 0.86);
    upper.castShadow = true;
    tree.add(upper);

    group.add(tree);
  }
}

function addNearbyPoints(
  group: THREE.Group,
  materials: Record<string, THREE.Material>,
  focusPoint: TerrainFocusPoint,
  shelters: readonly ShelterPoint[],
  proposals: readonly DemoProposalPoint[],
) {
  shelters.forEach((shelter) => {
    const id = `shelter:${shelter.id}`;
    if (id === focusPoint.id) return;
    const local = projectPoint(shelter.latitude, shelter.longitude, focusPoint);
    if (!local) return;
    addPointMarker(group, materials.shelterPoint, local.x, local.z, 0.62);
  });

  proposals.forEach((proposal) => {
    const id = `proposal:${proposal.id}`;
    if (id === focusPoint.id) return;
    const local = projectPoint(proposal.latitude, proposal.longitude, focusPoint);
    if (!local) return;
    addPointMarker(group, materials.proposalPoint, local.x, local.z, proposal.priority === 'high' ? 0.78 : 0.58);
  });
}

function addPointMarker(group: THREE.Group, material: THREE.Material, x: number, z: number, scale: number) {
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * scale, 0.62 * scale, 0.18, 18), material);
  marker.position.set(x, 0.62, z);
  marker.castShadow = true;
  group.add(marker);
}

function addTargetMarker(
  group: THREE.Group,
  materials: Record<string, THREE.Material>,
  focusPoint: TerrainFocusPoint,
) {
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.18, 8, 48), materials.targetGlow);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.62;
  group.add(baseRing);

  const pulseRing = new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.12, 8, 48), materials.targetGlow);
  pulseRing.rotation.x = Math.PI / 2;
  pulseRing.position.y = 0.5;
  group.add(pulseRing);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 8.4, 14), materials.target);
  pole.position.y = 4.4;
  pole.castShadow = true;
  group.add(pole);

  const headGeometry =
    focusPoint.category === 'proposal'
      ? new THREE.OctahedronGeometry(1.55, 0)
      : new THREE.ConeGeometry(1.35, 2.7, 18);
  const head = new THREE.Mesh(headGeometry, focusPoint.category === 'proposal' ? materials.proposalPoint : materials.target);
  head.position.y = focusPoint.category === 'proposal' ? 8.95 : 9.15;
  if (focusPoint.category === 'shelter') head.rotation.x = Math.PI;
  head.castShadow = true;
  group.add(head);
}

function addEdges(group: THREE.Group, mesh: THREE.Mesh, color: number, opacity: number) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 20);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  line.position.copy(mesh.position);
  line.rotation.copy(mesh.rotation);
  line.scale.copy(mesh.scale);
  group.add(line);
}

function isNearRoad(x: number, z: number, road: Road, margin: number) {
  const dx = x - road.x;
  const dz = z - road.z;
  const along = Math.abs(Math.cos(road.angle) * dx + Math.sin(road.angle) * dz);
  const across = Math.abs(-Math.sin(road.angle) * dx + Math.cos(road.angle) * dz);
  return along < road.length / 2 + margin && across < road.width / 2 + margin;
}

function projectPoint(latitude: number, longitude: number, focusPoint: TerrainFocusPoint) {
  const latKm = (latitude - focusPoint.latitude) * 111;
  const lonKm =
    (longitude - focusPoint.longitude) *
    111 *
    Math.cos((focusPoint.latitude * Math.PI) / 180);
  const x = lonKm * 1.32;
  const z = -latKm * 1.32;

  if (Math.abs(x) > HALF_WIDTH + 8 || Math.abs(z) > HALF_DEPTH + 8) {
    return null;
  }

  return {
    x: clamp(x, -HALF_WIDTH + 5, HALF_WIDTH - 5),
    z: clamp(z, -HALF_DEPTH + 5, HALF_DEPTH - 5),
  };
}

function layerLabel(layer: LayerKey) {
  return {
    population: 'Населення',
    coverage: 'Покриття',
    combined: 'Дефіцит',
  }[layer];
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number) {
  let state = seed || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }
  material.dispose();
}
