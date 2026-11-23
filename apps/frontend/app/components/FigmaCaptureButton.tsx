'use client';

import { useState } from 'react';
import { Check, ClipboardCopy, Loader2, TriangleAlert } from 'lucide-react';

type CaptureState = 'idle' | 'copying' | 'done' | 'error';

type FigmaColor = {
  r: number;
  g: number;
  b: number;
};

type FigmaFill = {
  type: 'SOLID';
  color: FigmaColor;
  opacity: number;
};

type ComponentHint = {
  key: string;
  props?: Record<string, string>;
};

type FigmaLayer = {
  type: 'FRAME' | 'RECTANGLE' | 'TEXT' | 'IMAGE' | 'SVG';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fills: FigmaFill[];
  strokes: FigmaFill[];
  strokeWeight: number;
  cornerRadius: number;
  opacity: number;
  overflow?: boolean;
  characters?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textColor?: FigmaColor;
  imageData?: string;
  svg?: string;
  component?: ComponentHint;
  children?: FigmaLayer[];
};

type FigmaExport = {
  version: 1;
  title: string;
  viewport: {
    width: number;
    height: number;
  };
  root: FigmaLayer;
};

const MAX_LAYERS = 3500;
const MAX_TEXT_CHARS = 800;
const MAX_IMAGE_SIDE = 1200;
const MAX_ROOT_HEIGHT = 24000;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK']);
const MIGRA_PROP_ATTRS: [string, string][] = [
  ['title', 'title'],
  ['subtitle', 'subtitle'],
  ['eyebrow', 'eyebrow'],
  ['value', 'value'],
  ['delta', 'delta'],
  ['label', 'label'],
  ['text', 'text'],
  ['placeholder', 'placeholder'],
  ['badge', 'badge'],
  ['user', 'user'],
  ['role', 'role'],
  ['primary-action', 'primaryAction'],
  ['secondary-action', 'secondaryAction'],
  ['icon', 'icon'],
  ['state', 'state'],
];
const ICON_SLUG_TO_COMPONENT: Record<string, string> = {
  activity: 'Activity',
  'circle-alert': 'AlertCircle',
  'triangle-alert': 'TriangleAlert',
  'arrow-left': 'ArrowLeft',
  'chart-no-axes-column': 'BarChart2',
  'chart-column': 'BarChart3',
  bell: 'Bell',
  bookmark: 'Bookmark',
  box: 'Box',
  'building-2': 'Building2',
  'calendar-days': 'CalendarDays',
  check: 'Check',
  'circle-check-big': 'CheckCircle',
  'chevron-down': 'ChevronDown',
  'chevron-right': 'ChevronRight',
  'chevrons-up-down': 'ChevronsUpDown',
  'chevron-up': 'ChevronUp',
  'clipboard-check': 'ClipboardCheck',
  'clipboard-copy': 'ClipboardCopy',
  'clipboard-list': 'ClipboardList',
  copy: 'Copy',
  database: 'Database',
  download: 'Download',
  pen: 'Edit2',
  'external-link': 'ExternalLink',
  'file-chart-column-increasing': 'FileBarChart',
  'file-text': 'FileText',
  'file-x': 'FileX',
  funnel: 'Filter',
  flame: 'Flame',
  earth: 'Globe2',
  'hand-heart': 'HandHeart',
  'circle-question-mark': 'HelpCircle',
  house: 'Home',
  info: 'Info',
  'layout-dashboard': 'LayoutDashboard',
  list: 'List',
  'loader-circle': 'Loader2',
  'locate-fixed': 'LocateFixed',
  'log-out': 'LogOut',
  map: 'Map',
  'map-pinned': 'MapPinned',
  minus: 'Minus',
  moon: 'Moon',
  plus: 'Plus',
  'refresh-cw': 'RefreshCw',
  'rotate-ccw': 'RotateCcw',
  search: 'Search',
  settings: 'Settings',
  shield: 'Shield',
  'shield-check': 'ShieldCheck',
  sparkles: 'Sparkles',
  sun: 'Sun',
  'trending-down': 'TrendingDown',
  'trending-up': 'TrendingUp',
  users: 'Users',
  'users-round': 'UsersRound',
  x: 'X',
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function px(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function colorToFill(value: string): FigmaFill | null {
  if (!value || value === 'transparent') return null;

  let match = value.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].trim().split(/[\s,\/]+/).filter(Boolean);
    const r = Number.parseFloat(parts[0] ?? '');
    const g = Number.parseFloat(parts[1] ?? '');
    const b = Number.parseFloat(parts[2] ?? '');
    const a = parts[3] == null ? 1 : Number.parseFloat(parts[3]);
    if (![r, g, b, a].every(Number.isFinite) || a <= 0) return null;
    return {
      type: 'SOLID',
      color: { r: r / 255, g: g / 255, b: b / 255 },
      opacity: Math.min(a, 1),
    };
  }

  match = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/i);
  if (!match) return null;

  const opacity = match[4] == null ? 1 : Number.parseFloat(match[4]);
  if (!Number.isFinite(opacity) || opacity <= 0) return null;

  return {
    type: 'SOLID',
    color: {
      r: Math.min(Number.parseFloat(match[1]), 1),
      g: Math.min(Number.parseFloat(match[2]), 1),
      b: Math.min(Number.parseFloat(match[3]), 1),
    },
    opacity: Math.min(opacity, 1),
  };
}

function fillToHex(fill: FigmaFill | null) {
  if (!fill) return '';
  const part = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');
  return `#${part(fill.color.r)}${part(fill.color.g)}${part(fill.color.b)}`;
}

function normalizedText(el: Element) {
  return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS);
}

function uniqueTextParts(parts: string[]) {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const value = part.replace(/\s+/g, ' ').trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function tableCellParts(cell: Element) {
  const semanticNodes = Array.from(cell.querySelectorAll('p, span, a, button'))
    .map(normalizedText)
    .filter(Boolean);
  const parts = semanticNodes.length ? semanticNodes : [normalizedText(cell)].filter(Boolean);
  return uniqueTextParts(parts).slice(0, 5);
}

function tableText(el: Element) {
  const parts = tableCellParts(el);
  return (parts.length ? parts.join(' | ') : normalizedText(el)).slice(0, 160);
}

function optionalTableText(el: Element | undefined) {
  return el ? tableText(el) : '';
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isShelterTable(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  return (
    normalized.some((header) => header.includes('назва') && header.includes('статус')) &&
    normalized.includes('доступ') &&
    normalized.includes('місткість') &&
    normalized.includes('адреса')
  );
}

function favoriteState(cell: Element | undefined) {
  if (!cell) return '';
  const button = cell.querySelector('button');
  const label = button?.getAttribute('aria-label') || button?.getAttribute('title') || '';
  if (/прибрати|обран/i.test(label)) return 'active';
  const svg = cell.querySelector('svg');
  const fill = svg?.getAttribute('fill') || '';
  return fill && fill !== 'none' ? 'active' : '';
}

function shelterNameCellParts(cell: Element | undefined) {
  if (!cell) return { name: '', type: '', status: '' };
  const title = cell.querySelector('p') ? normalizedText(cell.querySelector('p') as Element) : '';
  const badges = uniqueTextParts(Array.from(cell.querySelectorAll('span')).map(normalizedText).filter(Boolean))
    .filter((part) => part !== title);
  const fallback = tableCellParts(cell).filter((part) => part !== title);
  return {
    name: title || tableCellParts(cell)[0] || '',
    type: badges[0] || fallback[0] || '',
    status: badges[1] || fallback[1] || '',
  };
}

function shelterTableRow(row: HTMLTableRowElement) {
  const cells = Array.from(row.cells);
  const hasBookmarkColumn = cells.length >= 7 && !tableText(cells[0]);
  const offset = hasBookmarkColumn ? 1 : 0;
  const nameParts = shelterNameCellParts(cells[offset]);
  return [
    favoriteState(cells[0]),
    nameParts.name,
    nameParts.type,
    nameParts.status,
    optionalTableText(cells[offset + 1] || cells[1]),
    optionalTableText(cells[offset + 2] || cells[2]),
    optionalTableText(cells[offset + 3] || cells[3]),
    optionalTableText(cells[offset + 4] || cells[4]),
    optionalTableText(cells[offset + 5] || cells[5]),
  ].map((value) => value.slice(0, 180));
}

function tableComponentHint(table: HTMLTableElement): ComponentHint {
  const headerSource =
    table.tHead?.rows[0] ||
    Array.from(table.rows).find((row) => Array.from(row.cells).some((cell) => cell.tagName.toLowerCase() === 'th'));
  const headers = headerSource ? Array.from(headerSource.cells).map(tableText).slice(0, 7) : [];
  const bodyRows = Array.from(table.tBodies).flatMap((body) => Array.from(body.rows));
  const fallbackRows = Array.from(table.rows).filter((row) => row !== headerSource);
  const sourceRows = (bodyRows.length ? bodyRows : fallbackRows).slice(0, 12);

  if (isShelterTable(headers)) {
    return {
      key: 'Data/Table/Shelters',
      props: {
        tableKind: 'shelters',
        headers: JSON.stringify(['', 'Назва / Статус', 'Доступ', 'Місткість', 'Адреса', 'Джерело', 'Створено']),
        rows: JSON.stringify(sourceRows.map(shelterTableRow)),
      },
    };
  }

  const rows = sourceRows.map((row) => Array.from(row.cells).map(tableText).slice(0, 7));

  return {
    key: 'Data/Table',
    props: {
      headers: JSON.stringify(headers),
      rows: JSON.stringify(rows),
    },
  };
}

function fieldLabel(el: Element) {
  const id = el.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) return normalizedText(label);
  }
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) return normalizedText(parentLabel).replace(normalizedText(el), '').trim();
  return el.getAttribute('aria-label') || el.getAttribute('name') || 'Label';
}

function buttonSize(rect: DOMRect) {
  if (rect.height <= 30) return 'sm';
  if (rect.height >= 36) return 'lg';
  return 'md';
}

function buttonVariant(style: CSSStyleDeclaration) {
  const fill = colorToFill(style.backgroundColor);
  const hex = fillToHex(fill);
  const opacity = fill?.opacity ?? 0;
  if (hex === '#00e5a0') return 'primary';
  if (hex === '#ff6b6b' || hex === '#dc2626') return 'danger';
  if (opacity < 0.02) return px(style.borderTopWidth) > 0 ? 'outline' : 'ghost';
  return 'secondary';
}

function severityFromStyle(style: CSSStyleDeclaration) {
  const textHex = fillToHex(colorToFill(style.color));
  const bgHex = fillToHex(colorToFill(style.backgroundColor));
  const value = `${textHex} ${bgHex}`;
  if (value.includes('#00e5a0') || value.includes('#00a876')) return 'ok';
  if (value.includes('#f59e0b') || value.includes('#b45309')) return 'warning';
  if (value.includes('#ff6b6b') || value.includes('#dc2626')) return 'danger';
  if (value.includes('#60a5fa') || value.includes('#2563eb')) return 'info';
  return 'neutral';
}

function iconNameForSvg(svg: SVGSVGElement) {
  for (const className of Array.from(svg.classList)) {
    if (!className.startsWith('lucide-')) continue;
    const slug = className.replace(/^lucide-/, '');
    const name = ICON_SLUG_TO_COMPONENT[slug];
    if (name) return name;
  }
  return '';
}

function layerBase(type: FigmaLayer['type'], name: string, rect: DOMRect, style: CSSStyleDeclaration): FigmaLayer {
  const opacity = px(style.opacity);

  return {
    type,
    name,
    x: round(rect.left + window.scrollX),
    y: round(rect.top + window.scrollY),
    width: round(rect.width),
    height: round(rect.height),
    fills: [],
    strokes: [],
    strokeWeight: 0,
    cornerRadius: 0,
    opacity: Number.isFinite(opacity) ? opacity : 1,
  };
}

function explicitComponentHint(el: Element): ComponentHint | null {
  const key = el.getAttribute('data-migra-component')?.trim();
  if (!key) return null;

  const props: Record<string, string> = {};
  const rawProps = el.getAttribute('data-migra-props');
  if (rawProps) {
    try {
      const parsed = JSON.parse(rawProps) as Record<string, unknown>;
      for (const [name, value] of Object.entries(parsed)) {
        if (value !== null && value !== undefined) {
          props[name] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }
    } catch {
      props.text = rawProps;
    }
  }

  for (const [attr, prop] of MIGRA_PROP_ATTRS) {
    const value = el.getAttribute(`data-migra-${attr}`);
    if (value !== null && value !== '') props[prop] = value;
  }

  return {
    key,
    props: Object.keys(props).length > 0 ? props : undefined,
  };
}

function semanticLayerForElement(el: Element, rect: DOMRect, style: CSSStyleDeclaration): FigmaLayer | null {
  const explicit = explicitComponentHint(el);
  if (explicit) {
    const layer = layerBase('FRAME', explicit.key, rect, style);
    layer.component = explicit;
    return layer;
  }

  if (el instanceof HTMLTableElement) {
    const layer = layerBase('FRAME', 'Data/Table', rect, style);
    layer.component = tableComponentHint(el);
    return layer;
  }

  const isCompactButton =
    rect.height <= 48 &&
    rect.width <= 360 &&
    (el instanceof HTMLButtonElement ||
      (el instanceof HTMLAnchorElement && (el.getAttribute('role') === 'button' || String(el.className).includes('rounded'))));

  if (isCompactButton) {
    const layer = layerBase('FRAME', nameFor(el), rect, style);
    const variant = buttonVariant(style);
    const state = el instanceof HTMLButtonElement && el.disabled ? 'disabled' : 'default';
    const stateSuffix = state === 'default' ? '' : `/${state}`;
    layer.component = {
      key: `Button/${variant}/${buttonSize(rect)}${stateSuffix}`,
      props: { text: normalizedText(el) || el.getAttribute('aria-label') || 'Label', state },
    };
    return layer;
  }

  if (el instanceof HTMLInputElement) {
    const isSearch = el.type === 'search' || /пошук|search/i.test(el.placeholder || '');
    const state = el.disabled ? 'disabled' : 'default';
    const layer = layerBase('FRAME', nameFor(el), rect, style);
    layer.component = {
      key: isSearch ? `Form/Search/${state}` : `Form/Input/${state}`,
      props: {
        label: fieldLabel(el),
        value: el.value || el.placeholder || '',
        placeholder: el.placeholder || 'Search',
        state,
      },
    };
    return layer;
  }

  if (el instanceof HTMLSelectElement) {
    const state = el.disabled ? 'disabled' : 'default';
    const layer = layerBase('FRAME', nameFor(el), rect, style);
    layer.component = {
      key: `Form/Select/${state}`,
      props: { label: fieldLabel(el), value: el.selectedOptions[0]?.text || '', state },
    };
    return layer;
  }

  if (el instanceof HTMLTextAreaElement) {
    const state = el.disabled ? 'disabled' : 'default';
    const layer = layerBase('FRAME', nameFor(el), rect, style);
    layer.component = {
      key: `Form/Textarea/${state}`,
      props: { label: fieldLabel(el), value: el.value || el.placeholder || '', state },
    };
    return layer;
  }

  const text = normalizedText(el);
  const radius = Math.max(
    px(style.borderTopLeftRadius),
    px(style.borderTopRightRadius),
    px(style.borderBottomRightRadius),
    px(style.borderBottomLeftRadius),
  );
  const bg = colorToFill(style.backgroundColor);
  if (text && text.length <= 34 && rect.height <= 36 && rect.width <= 240 && radius >= 6 && bg && bg.opacity > 0.03 && el.children.length <= 2) {
    const layer = layerBase('FRAME', nameFor(el), rect, style);
    layer.component = { key: `Badge/${severityFromStyle(style)}`, props: { text } };
    return layer;
  }

  return null;
}

function isVisibleElement(el: Element, rect: DOMRect, style: CSSStyleDeclaration) {
  if (SKIP_TAGS.has(el.tagName)) return false;
  if (el.closest('[data-migra-thor-ignore="true"]')) return false;
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (px(style.opacity) === 0) return false;
  return rect.width >= 1 && rect.height >= 1;
}

function isStandaloneControlLabel(el: Element) {
  if (!(el instanceof HTMLLabelElement)) return false;
  if (el.querySelector('input, select, textarea')) return false;
  if (!el.htmlFor) return false;
  const target = document.getElementById(el.htmlFor);
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function nameFor(el: Element) {
  const id = el.id ? `#${el.id}` : '';
  const className =
    typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';

  return `${el.tagName.toLowerCase()}${id}${className}`;
}

function fontWeight(value: string) {
  if (value === 'bold') return 700;
  if (value === 'normal') return 400;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 400;
}

function pushLayer(layers: FigmaLayer[], layer: FigmaLayer) {
  if (layers.length >= MAX_LAYERS) return;
  if (layer.width < 1 || layer.height < 1) return;
  if (layer.y > MAX_ROOT_HEIGHT) return;
  layers.push(layer);
}

function addElementBox(layers: FigmaLayer[], el: Element, rect: DOMRect, style: CSSStyleDeclaration) {
  if (el === document.documentElement || el === document.body) return;

  const fill = colorToFill(style.backgroundColor);
  const borderFill = colorToFill(style.borderTopColor);
  const borderWidth = Math.max(
    px(style.borderTopWidth),
    px(style.borderRightWidth),
    px(style.borderBottomWidth),
    px(style.borderLeftWidth),
  );
  const radius = Math.max(
    px(style.borderTopLeftRadius),
    px(style.borderTopRightRadius),
    px(style.borderBottomRightRadius),
    px(style.borderBottomLeftRadius),
  );
  const hasStroke = !!borderFill && borderWidth > 0;

  if (!fill && !hasStroke && radius === 0) return;

  const layer = layerBase('RECTANGLE', nameFor(el), rect, style);
  layer.fills = fill ? [fill] : [];
  layer.strokes = hasStroke ? [borderFill] : [];
  layer.strokeWeight = hasStroke ? round(borderWidth) : 0;
  layer.cornerRadius = round(radius);
  pushLayer(layers, layer);
}

function addTextLayer(
  layers: FigmaLayer[],
  text: string,
  rect: DOMRect,
  style: CSSStyleDeclaration,
  name = 'Text',
) {
  const content = text.replace(/\s+/g, ' ').trim();
  if (!content || rect.width < 1 || rect.height < 1) return;

  const color = colorToFill(style.color);
  const layer = layerBase('TEXT', name, rect, style);
  const fontSize = px(style.fontSize) || 14;
  const lineHeight = px(style.lineHeight);
  const letterSpacing = px(style.letterSpacing);

  layer.characters = content.slice(0, MAX_TEXT_CHARS);
  layer.fontSize = fontSize;
  layer.fontWeight = fontWeight(style.fontWeight);
  layer.fontFamily = (style.fontFamily || 'Inter').split(',')[0]?.replace(/["']/g, '').trim() || 'Inter';
  layer.lineHeight = lineHeight || round(fontSize * 1.2);
  if (Number.isFinite(letterSpacing)) layer.letterSpacing = letterSpacing;
  layer.textColor = color ? color.color : { r: 0, g: 0, b: 0 };
  pushLayer(layers, layer);
}

function addTextNode(layers: FigmaLayer[], node: ChildNode, parentStyle: CSSStyleDeclaration) {
  const content = node.textContent || '';
  if (!content.trim()) return;

  const range = document.createRange();
  range.selectNodeContents(node);
  const rect = range.getBoundingClientRect();
  range.detach();
  addTextLayer(layers, content, rect, parentStyle);
}

async function imageToDataUrl(img: HTMLImageElement) {
  if (!img.complete || !img.naturalWidth || !img.naturalHeight) return '';

  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  try {
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

async function addImageLayer(
  layers: FigmaLayer[],
  img: HTMLImageElement,
  rect: DOMRect,
  style: CSSStyleDeclaration,
) {
  const dataUrl = await imageToDataUrl(img);
  const layer = layerBase(dataUrl ? 'IMAGE' : 'RECTANGLE', nameFor(img), rect, style);
  const fill = colorToFill(style.backgroundColor);
  layer.fills = fill ? [fill] : [{ type: 'SOLID', color: { r: 0.95, g: 0.96, b: 0.98 }, opacity: 1 }];
  layer.cornerRadius = Math.max(
    px(style.borderTopLeftRadius),
    px(style.borderTopRightRadius),
    px(style.borderBottomRightRadius),
    px(style.borderBottomLeftRadius),
  );
  if (dataUrl) layer.imageData = dataUrl;
  pushLayer(layers, layer);
  if (!dataUrl && img.alt) addTextLayer(layers, img.alt, rect, style, 'Image alt');
}

function addSvgLayer(layers: FigmaLayer[], svg: SVGSVGElement, rect: DOMRect, style: CSSStyleDeclaration) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(Math.max(1, Math.round(rect.width))));
  clone.setAttribute('height', String(Math.max(1, Math.round(rect.height))));

  const layer = layerBase('SVG', nameFor(svg), rect, style);
  layer.svg = new XMLSerializer().serializeToString(clone);
  const iconName = iconNameForSvg(svg);
  if (iconName) layer.component = { key: `Icon/${iconName}` };
  pushLayer(layers, layer);
}

function addFormValue(layers: FigmaLayer[], el: Element, rect: DOMRect, style: CSSStyleDeclaration) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    addTextLayer(layers, el.value || el.placeholder || '', rect, style, `${nameFor(el)} value`);
  } else if (el instanceof HTMLSelectElement) {
    addTextLayer(layers, el.selectedOptions[0]?.text || '', rect, style, `${nameFor(el)} value`);
  }
}

async function walkElement(layers: FigmaLayer[], el: Element): Promise<void> {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();

  if (!isVisibleElement(el, rect, style)) return;
  if (isStandaloneControlLabel(el)) return;

  const semantic = semanticLayerForElement(el, rect, style);
  if (semantic) {
    pushLayer(layers, semantic);
    return;
  }

  if (el instanceof SVGSVGElement) {
    addSvgLayer(layers, el, rect, style);
    return;
  }

  if (el instanceof HTMLImageElement) {
    await addImageLayer(layers, el, rect, style);
  } else {
    addElementBox(layers, el, rect, style);
  }

  addFormValue(layers, el, rect, style);

  for (const child of Array.from(el.childNodes)) {
    if (layers.length >= MAX_LAYERS) break;
    if (child.nodeType === Node.TEXT_NODE) {
      addTextNode(layers, child, style);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      await walkElement(layers, child as Element);
    }
  }
}

async function capturePage(): Promise<FigmaExport> {
  const layers: FigmaLayer[] = [];
  await walkElement(layers, document.body);

  const htmlStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const rootFill = colorToFill(bodyStyle.backgroundColor) || colorToFill(htmlStyle.backgroundColor);
  const rootWidth = Math.ceil(Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth));
  const rootHeight = Math.ceil(
    Math.min(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight), MAX_ROOT_HEIGHT),
  );

  return {
    version: 1,
    title: document.title || window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    root: {
      type: 'FRAME',
      name: document.title || window.location.hostname || 'Captured page',
      x: 0,
      y: 0,
      width: rootWidth,
      height: rootHeight,
      fills: rootFill ? [rootFill] : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
      strokes: [],
      strokeWeight: 0,
      cornerRadius: 0,
      opacity: 1,
      overflow: true,
      children: layers,
    },
  };
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    area.style.top = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('Clipboard copy failed');
  }
}

export function FigmaCaptureButton() {
  const [state, setState] = useState<CaptureState>('idle');
  const [message, setMessage] = useState('');

  async function handleCapture() {
    if (state === 'copying') return;

    setState('copying');
    setMessage('');

    try {
      const data = await capturePage();
      await writeClipboard(JSON.stringify(data));
      setState('done');
      setMessage(`Скопійовано ${data.root.children?.length ?? 0} шарів`);
      window.setTimeout(() => {
        setState('idle');
        setMessage('');
      }, 4200);
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Не вдалося скопіювати');
    }
  }

  const Icon = state === 'copying' ? Loader2 : state === 'done' ? Check : state === 'error' ? TriangleAlert : ClipboardCopy;

  return (
    <div
      data-migra-thor-ignore="true"
      className="fixed bottom-5 right-5 z-[4900] flex items-end gap-3"
    >
      {message ? (
        <div
          role="status"
          aria-live="polite"
          className="max-w-[240px] rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-overlay)] px-3 py-2 text-[12px] leading-4 text-[var(--text-primary)] shadow-2xl shadow-black/35 backdrop-blur"
        >
          {message}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleCapture}
        disabled={state === 'copying'}
        aria-label="Скопіювати сторінку для Figma"
        title="Скопіювати сторінку для Figma"
        className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--accent-35)] bg-[var(--accent)] text-[#06110d] shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_60px_rgba(0,0,0,0.42)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-50)] disabled:cursor-wait disabled:opacity-75"
      >
        <Icon className={`h-5 w-5 ${state === 'copying' ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
