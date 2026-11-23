// ЄДРТЗВ Design System — Full Generator
// Scanned from 23 real project screens

// ── Tokens ────────────────────────────────────────────────────

interface ColorToken { hex: string; group: string; }

const COLORS: Record<string, ColorToken> = {
  // Brand
  "brand/blue":        { hex: "#2b7fff", group: "Brand" },
  "brand/blue-light":  { hex: "#eff6ff", group: "Brand" },
  "brand/blue-mid":    { hex: "#bedbff", group: "Brand" },
  "brand/blue-dark":   { hex: "#457dcf", group: "Brand" },
  // Text
  "text/primary":      { hex: "#0a0a0a", group: "Text" },
  "text/heading":      { hex: "#101828", group: "Text" },
  "text/secondary":    { hex: "#4a5565", group: "Text" },
  "text/muted":        { hex: "#6a7282", group: "Text" },
  "text/placeholder":  { hex: "#737373", group: "Text" },
  "text/disabled":     { hex: "#717182", group: "Text" },
  // Neutral
  "neutral/border":    { hex: "#e5e7eb", group: "Neutral" },
  "neutral/divider":   { hex: "#e5e5e5", group: "Neutral" },
  "neutral/subtle":    { hex: "#bcbcbc", group: "Neutral" },
  "neutral/bg":        { hex: "#ececf0", group: "Neutral" },
  "neutral/input":     { hex: "#f3f3f5", group: "Neutral" },
  "neutral/surface":   { hex: "#f5f5f5", group: "Neutral" },
  "neutral/page":      { hex: "#f9fafb", group: "Neutral" },
  "neutral/white-off": { hex: "#fafafa", group: "Neutral" },
  "neutral/white":     { hex: "#ffffff", group: "Neutral" },
  // Success
  "success/text":      { hex: "#00a63e", group: "Success" },
  "success/bg":        { hex: "#e6f9ef", group: "Success" },
  "success/green":     { hex: "#34c759", group: "Success" },
  // Danger
  "danger/red":        { hex: "#dc2626", group: "Danger" },
  "danger/red-deep":   { hex: "#fb2c36", group: "Danger" },
  "danger/red-brand":  { hex: "#d4183d", group: "Danger" },
  // Warning
  "warning/text":      { hex: "#d08700", group: "Warning" },
  "warning/bg":        { hex: "#fff3e0", group: "Warning" },
  // Info
  "info/bg":           { hex: "#e3f2fd", group: "Info" },
  // Purple
  "purple/text":       { hex: "#ad46ff", group: "Purple" },
  "purple/bg":         { hex: "#faf5ff", group: "Purple" },
  "purple/border":     { hex: "#e9d4ff", group: "Purple" },
};

const _RADII = [
  { name: "xs — 4px",  value: 4 },
  { name: "sm — 6px",  value: 6 },
  { name: "md — 8px",  value: 8 },
  { name: "lg — 10px", value: 10 },
  { name: "xl — 14px", value: 14 },
  { name: "pill",      value: 9999 },
];

const _SPACINGS = [2, 4, 6, 8, 10, 12, 16, 24, 25, 32];

// ── Font cache ────────────────────────────────────────────────

const loadedFonts = new Set<string>();

async function loadFont(family: string, style: string): Promise<void> {
  const key = `${family}:${style}`;
  if (loadedFonts.has(key)) return;
  try {
    await figma.loadFontAsync({ family, style });
    loadedFonts.add(key);
  } catch (_) {
    try { await figma.loadFontAsync({ family: "Inter", style: "Regular" }); } catch (__) {}
  }
}

async function preload(): Promise<void> {
  const fonts: [string, string][] = [
    ["Inter", "Regular"], ["Inter", "Medium"], ["Inter", "SemiBold"], ["Inter", "Bold"],
    ["Courier New", "Regular"],
  ];
  for (const [f, s] of fonts) {
    try { await figma.loadFontAsync({ family: f, style: s }); loadedFonts.add(`${f}:${s}`); }
    catch (_) {}
  }
}

// ── Helpers ───────────────────────────────────────────────────

function hexRGB(h: string): RGB {
  const c = h.replace("#", "");
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
  };
}

function fill(hex: string, opacity = 1): SolidPaint {
  return { type: "SOLID", color: hexRGB(hex), opacity };
}

function borderPaint(opacity = 0.1): SolidPaint {
  return { type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity };
}

function fr(name: string, w: number, h: number, fillHex = ""): FrameNode {
  const f = figma.createFrame();
  f.name = name;
  f.resize(w, h);
  f.fills = fillHex ? [fill(fillHex)] : [];
  f.clipsContent = false;
  return f;
}

function rc(w: number, h: number, fillHex: string, radius = 0): RectangleNode {
  const r = figma.createRectangle();
  r.resize(w, h);
  r.fills = [fill(fillHex)];
  r.cornerRadius = radius;
  return r;
}

function div(parent: FrameNode, x: number, y: number, w: number, color = "#e5e5e5"): void {
  const r = rc(w, 1, color);
  r.x = x; r.y = y;
  parent.appendChild(r);
}

async function t(
  content: string,
  size: number,
  style: string,
  colorHex: string,
  opts: { family?: string; ls?: number; lh?: number; align?: "LEFT" | "RIGHT" | "CENTER" } = {}
): Promise<TextNode> {
  const family = opts.family ? opts.family : "Inter";
  await loadFont(family, style);
  const node = figma.createText();
  try { node.fontName = { family, style }; } catch (_) { node.fontName = { family: "Inter", style: "Regular" }; }
  node.fontSize = size;
  node.characters = content;
  node.fills = [fill(colorHex)];
  if (opts.ls != null) node.letterSpacing = { value: opts.ls, unit: "PIXELS" };
  if (opts.lh != null) node.lineHeight    = { value: opts.lh, unit: "PIXELS" };
  if (opts.align)      node.textAlignHorizontal = opts.align;
  return node;
}

async function cap(parent: FrameNode | PageNode, label: string, x: number, y: number): Promise<void> {
  const node = await t(label, 10, "Regular", "#999999");
  node.x = x; node.y = y;
  parent.appendChild(node);
}

// ── Reusable component builders ───────────────────────────────

async function makeButton(label: string, bgHex: string, textHex: string, w = 160): Promise<FrameNode> {
  const btn = fr("Button", w, 40, bgHex);
  btn.cornerRadius = 8;
  const lbl = await t(label, 14, "Medium", textHex, { ls: -0.15, lh: 20 });
  lbl.x = Math.round((w - lbl.width) / 2);
  lbl.y = 10;
  btn.appendChild(lbl);
  return btn;
}

async function makeBadge(label: string, bgHex: string, textHex: string): Promise<FrameNode> {
  const badge = fr("Badge", 10, 28, bgHex); // will resize
  badge.cornerRadius = 8;
  badge.strokes = [borderPaint(0.1)];
  badge.strokeWeight = 1;
  const lbl = await t(label, 12, "Medium", textHex, { ls: -0.15, lh: 16 });
  lbl.x = 10; lbl.y = 6;
  badge.appendChild(lbl);
  badge.resize(lbl.width + 20, 28);
  return badge;
}

async function makeTag(label: string, bgHex: string, textHex: string): Promise<FrameNode> {
  const tag = fr("Tag", 10, 24, bgHex);
  tag.cornerRadius = 6;
  const lbl = await t(label, 12, "Medium", textHex, { ls: -0.15, lh: 16 });
  lbl.x = 8; lbl.y = 4;
  tag.appendChild(lbl);
  tag.resize(lbl.width + 16, 24);
  return tag;
}

async function makeInput(placeholder: string, w = 280, withLabel = ""): Promise<FrameNode> {
  const wrap = fr("Input", w, withLabel ? 60 : 44);
  wrap.fills = [];
  if (withLabel) {
    const lbl = await t(withLabel, 11, "Regular", "#4a5565", { ls: -0.15, lh: 16 });
    lbl.x = 0; lbl.y = 0;
    wrap.appendChild(lbl);
    const field = fr("Field", w, 40, "#f3f3f5");
    field.cornerRadius = 8;
    field.x = 0; field.y = 18;
    const ph = await t(placeholder, 14, "Regular", "#737373", { ls: -0.15, lh: 20 });
    ph.x = 12; ph.y = 10;
    field.appendChild(ph);
    wrap.appendChild(field);
  } else {
    const field = fr("Field", w, 44, "#f3f3f5");
    field.cornerRadius = 8;
    const ph = await t(placeholder, 14, "Regular", "#737373", { ls: -0.15, lh: 20 });
    ph.x = 12; ph.y = 12;
    field.appendChild(ph);
    wrap.appendChild(field);
  }
  return wrap;
}

async function makeStepIndicator(num: number, state: "active" | "done" | "inactive"): Promise<FrameNode> {
  const colors = { active: "#2b7fff", done: "#030213", inactive: "#ececf0" };
  const txtColors = { active: "#ffffff", done: "#ffffff", inactive: "#717182" };
  const step = fr(`Step/${num}`, 32, 32, colors[state]);
  step.cornerRadius = 10;
  const label = await t(String(num), 14, state === "inactive" ? "Medium" : "SemiBold", txtColors[state]);
  label.x = num >= 10 ? 7 : 11;
  label.y = 7;
  step.appendChild(label);
  return step;
}

async function makeTableRow(cells: string[], isHeader = false): Promise<FrameNode> {
  const colW = [40, 120, 100, 80, 80, 80, 100];
  const totalW = colW.reduce((a, b) => a + b, 0) + 24;
  const row = fr(isHeader ? "Table/Header" : "Table/Row", totalW, isHeader ? 40 : 52, isHeader ? "#f9fafb" : "#ffffff");
  if (!isHeader) {
    row.strokes = [{ type: "SOLID", color: hexRGB("#e5e7eb"), opacity: 1 }];
    row.strokeAlign = "INSIDE";
    row.strokeWeight = 1;
  }
  let x = 16;
  for (let i = 0; i < cells.length; i++) {
    const cell = await t(cells[i], isHeader ? 12 : 14,
      isHeader ? "Medium" : "Regular",
      isHeader ? "#737373" : "#0a0a0a",
      { ls: -0.15, lh: isHeader ? 16 : 20 }
    );
    cell.x = x;
    cell.y = isHeader ? 12 : 16;
    row.appendChild(cell);
    x += colW[i] || 100;
  }
  return row;
}

// ── Page 1: Colors ────────────────────────────────────────────

async function buildColors(page: PageNode): Promise<void> {
  page.name = "🎨 Кольори";

  const entries = Object.entries(COLORS);
  const SW = 72, SH = 52, GAP = 12, COLS = 7;
  const rows = Math.ceil(entries.length / COLS);
  const W = COLS * (SW + GAP) + GAP + 32;
  const H = rows * (SH + 44) + 80;

  const canvas = fr("Color Palette", W, H, "#ffffff");
  canvas.cornerRadius = 14;
  canvas.strokes = [borderPaint(0.08)]; canvas.strokeWeight = 1;
  canvas.x = 40; canvas.y = 40;
  page.appendChild(canvas);

  const heading = await t("Кольорова палітра", 20, "SemiBold", "#030213", { ls: -0.44, lh: 28 });
  heading.x = 24; heading.y = 20;
  canvas.appendChild(heading);

  const sub = await t(`${entries.length} токенів · 8 груп`, 12, "Regular", "#717182");
  sub.x = 24; sub.y = 52;
  canvas.appendChild(sub);

  for (let i = 0; i < entries.length; i++) {
    const [name, token] = entries[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const gx = 16 + GAP + col * (SW + GAP);
    const gy = 76 + row * (SH + 44);

    const g = fr(name, SW, SH + 36);
    g.x = gx; g.y = gy;
    canvas.appendChild(g);

    const s = rc(SW, SH, token.hex, 8);
    s.strokes = [borderPaint(0.08)]; s.strokeWeight = 1;
    g.appendChild(s);

    const nameNode = await t(name.split("/")[1], 9, "Medium", "#0a0a0a");
    nameNode.x = 0; nameNode.y = SH + 4;
    nameNode.resize(SW, 12);
    g.appendChild(nameNode);

    const hexNode = await t(token.hex, 8, "Regular", "#717182");
    hexNode.x = 0; hexNode.y = SH + 18;
    hexNode.resize(SW, 12);
    g.appendChild(hexNode);
  }
}

// ── Page 2: Typography ────────────────────────────────────────

async function buildTypography(page: PageNode): Promise<void> {
  page.name = "📝 Типографіка";

  const canvas = fr("Typography", 960, 1100, "#ffffff");
  canvas.cornerRadius = 14;
  canvas.strokes = [borderPaint(0.08)]; canvas.strokeWeight = 1;
  canvas.x = 40; canvas.y = 40;
  page.appendChild(canvas);

  const heading = await t("Типографіка", 20, "SemiBold", "#030213", { ls: -0.44, lh: 28 });
  heading.x = 32; heading.y = 28;
  canvas.appendChild(heading);

  const scale = [
    { label: "Display / SemiBold 24",  sample: "Єдиний державний реєстр транспортних засобів",  size: 24, style: "SemiBold", color: "#0a0a0a", ls: -0.44, lh: 32 },
    { label: "Heading 1 / SemiBold 20",sample: "Список транспортних засобів",                   size: 20, style: "SemiBold", color: "#101828", ls: -0.44, lh: 28 },
    { label: "Heading 2 / SemiBold 18",sample: "Постановка ТЗ на комісію",                      size: 18, style: "SemiBold", color: "#0a0a0a", ls: -0.44, lh: 27 },
    { label: "Heading 3 / Medium 16",  sample: "Загальна інформація про транспортний засіб",     size: 16, style: "Medium",   color: "#0a0a0a", ls: -0.31, lh: 24 },
    { label: "Body / Medium 14",       sample: "Toyota Camry · 2024 · Silver · $28 500",         size: 14, style: "Medium",   color: "#0a0a0a", ls: -0.15, lh: 20 },
    { label: "Body / Regular 14",      sample: "Марка: / Модель: / Рік: / Колір: / Пробіг:",    size: 14, style: "Regular",  color: "#4a5565", ls: -0.15, lh: 20 },
    { label: "Body / Regular 16",      sample: "Примітки до транспортного засобу",               size: 16, style: "Regular",  color: "#6a7282", ls: -0.31, lh: 24 },
    { label: "Caption / Regular 12",   sample: "Оновлено 01.04.2024 · №ТЗ-20240401-001",        size: 12, style: "Regular",  color: "#737373", ls: -0.15, lh: 16 },
    { label: "Mono / VIN 14",          sample: "1HGBH41JXMN109186",                              size: 14, style: "Regular",  color: "#0a0a0a", ls: 0,     lh: 20, family: "Courier New" },
  ];

  let y = 72;
  for (const item of scale) {
    const lbl = await t(item.label, 10, "Regular", "#999999");
    lbl.x = 32; lbl.y = y;
    canvas.appendChild(lbl);

    const opts: { family?: string; ls: number; lh: number } = { ls: item.ls, lh: item.lh };
    if ((item as { family?: string }).family) opts.family = (item as { family?: string }).family;

    const sample = await t(item.sample, item.size, item.style, item.color, opts);
    sample.x = 32; sample.y = y + 16;
    canvas.appendChild(sample);

    div(canvas, 32, y + item.lh + 28, 896);
    y += item.lh + 52;
  }
}

// ── Page 3: Basic Components ──────────────────────────────────

async function buildBasicComponents(page: PageNode): Promise<void> {
  page.name = "🧩 Базові компоненти";
  let y = 40;

  // ── Section helper ────────────────────────────────────────
  async function section(title: string): Promise<number> {
    const lbl = await t(title, 13, "SemiBold", "#030213", { ls: -0.15, lh: 18 });
    lbl.x = 40; lbl.y = y;
    page.appendChild(lbl);
    y += 28;
    return y;
  }

  // ── BUTTONS ───────────────────────────────────────────────
  await section("Кнопки");

  const btnDefs: [string, string, string, string][] = [
    ["Primary",   "Підтвердити",     "#2b7fff", "#ffffff"],
    ["Dark",      "Зберегти",        "#030213", "#ffffff"],
    ["Secondary", "Скасувати",       "#f3f3f5", "#0a0a0a"],
    ["Danger",    "Видалити",        "#dc2626", "#ffffff"],
    ["Ghost",     "Детальніше",      "#eff6ff", "#2b7fff"],
  ];

  let bx = 40;
  for (const [name, label, bg, fg] of btnDefs) {
    await cap(page, name, bx, y);
    const btn = await makeButton(label, bg, fg);
    btn.x = bx; btn.y = y + 16;
    page.appendChild(btn);
    bx += btn.width + 16;
  }
  y += 76;

  // Button sizes
  await cap(page, "Розміри кнопок", 40, y);
  y += 16;
  const sizes: [string, number, number][] = [["SM · h32", 32, 12], ["MD · h40", 40, 14], ["LG · h48", 48, 16]];
  let sx = 40;
  for (const [label, h, fs] of sizes) {
    const btn = fr(`Btn/${label}`, 120, h, "#2b7fff");
    btn.cornerRadius = 8; btn.x = sx; btn.y = y;
    page.appendChild(btn);
    const lbl = await t(label, fs, "Medium", "#ffffff");
    lbl.x = 12; lbl.y = Math.round((h - fs * 1.4) / 2);
    btn.appendChild(lbl);
    sx += 136;
  }
  y += 72;

  // ── BADGES ────────────────────────────────────────────────
  await section("Бейджі / Статуси");

  const badgeDefs: [string, string, string, string][] = [
    ["Нереалізовано",  "#e6f9ef", "#00a63e",  "Success"],
    ["Реалізовано",    "#fde8ec", "#d4183d",  "Danger"],
    ["В обробці",      "#fff3e0", "#d08700",  "Warning"],
    ["На перевірці",   "#eff6ff", "#2b7fff",  "Info"],
    ["Документ",       "#faf5ff", "#ad46ff",  "Purple"],
    ["Новий",          "#e3f2fd", "#457dcf",  "Blue"],
  ];

  let bdx = 40;
  for (const [label, bg, fg, name] of badgeDefs) {
    await cap(page, name, bdx, y);
    const badge = await makeBadge(label, bg, fg);
    badge.x = bdx; badge.y = y + 16;
    page.appendChild(badge);
    bdx += badge.width + 12;
  }
  y += 64;

  // ── TAGS / CHIPS ──────────────────────────────────────────
  await section("Теги / Чіпси");

  const tagDefs: [string, string, string][] = [
    ["Toyota",    "#eff6ff", "#2b7fff"],
    ["2024",      "#f3f3f5", "#0a0a0a"],
    ["Бензин",    "#e6f9ef", "#00a63e"],
    ["Фізична особа", "#faf5ff", "#ad46ff"],
  ];

  let tx = 40;
  for (const [label, bg, fg] of tagDefs) {
    const tag = await makeTag(label, bg, fg);
    tag.x = tx; tag.y = y;
    page.appendChild(tag);
    tx += tag.width + 8;
  }
  y += 48;

  // ── STEP INDICATORS ───────────────────────────────────────
  await section("Кроки (Step Indicator)");

  const stepLabels = ["Пошук авто", "Перевірка по базі", "Стан ТЗ", "Дані комітента"];
  let stx = 40;
  for (let i = 0; i < 4; i++) {
    const state = i === 0 ? "active" : i === 1 ? "done" : "inactive";
    const step = await makeStepIndicator(i + 1, state as "active" | "done" | "inactive");
    step.x = stx; step.y = y + 16;
    page.appendChild(step);
    await cap(page, stepLabels[i], stx, y);
    stx += 120;
  }
  y += 80;

  // ── INPUTS ────────────────────────────────────────────────
  await section("Поля вводу");

  await cap(page, "Default", 40, y);
  const inp1 = await makeInput("Введіть держ. номер...");
  inp1.x = 40; inp1.y = y + 16;
  page.appendChild(inp1);

  await cap(page, "З підписом", 360, y);
  const inp2 = await makeInput("Напр. Toyota Camry", 280, "Марка та модель");
  inp2.x = 360; inp2.y = y + 16;
  page.appendChild(inp2);

  await cap(page, "VIN (моноширинний)", 680, y);
  const vinWrap = fr("VIN Input", 240, 60);
  vinWrap.fills = [];
  vinWrap.x = 680; vinWrap.y = y + 16;
  page.appendChild(vinWrap);
  const vinLbl = await t("VIN-код", 11, "Regular", "#4a5565", { ls: -0.15, lh: 16 });
  vinLbl.x = 0; vinLbl.y = 0;
  vinWrap.appendChild(vinLbl);
  const vinField = fr("VIN/Field", 240, 40, "#f3f3f5");
  vinField.cornerRadius = 8; vinField.x = 0; vinField.y = 18;
  vinWrap.appendChild(vinField);
  const vinVal = await t("1HGBH41JXMN109186", 14, "Regular", "#0a0a0a", { family: "Courier New", lh: 20 });
  vinVal.x = 12; vinVal.y = 10; vinField.appendChild(vinVal);

  y += 96;

  // Dropdown / Select
  await cap(page, "Dropdown / Select", 40, y);
  const select = fr("Select", 280, 44, "#f3f3f5");
  select.cornerRadius = 8; select.x = 40; select.y = y + 16;
  page.appendChild(select);
  const selTxt = await t("Оберіть тип документу", 14, "Regular", "#737373", { ls: -0.15, lh: 20 });
  selTxt.x = 12; selTxt.y = 12; select.appendChild(selTxt);
  const arrow = rc(16, 16, "#737373", 2);
  arrow.x = 252; arrow.y = 14; select.appendChild(arrow);
  y += 80;

  // ── TABS ─────────────────────────────────────────────────
  await section("Вкладки (Tabs)");

  const tabContainer = fr("Tabs", 520, 44, "#ffffff");
  tabContainer.cornerRadius = 14;
  tabContainer.strokes = [borderPaint(0.1)]; tabContainer.strokeWeight = 1;
  tabContainer.x = 40; tabContainer.y = y;
  page.appendChild(tabContainer);

  const tabs = ["Всі ТЗ", "Активні", "Архів", "Документи"];
  let tabX = 4;
  for (let i = 0; i < tabs.length; i++) {
    const isActive = i === 0;
    const tab = fr(`Tab/${tabs[i]}`, 120, 36, isActive ? "#030213" : "");
    if (!isActive) tab.fills = [];
    tab.cornerRadius = 10;
    tab.x = tabX; tab.y = 4;
    tabContainer.appendChild(tab);
    const tabLbl = await t(tabs[i], 13, isActive ? "Medium" : "Regular", isActive ? "#ffffff" : "#737373", { ls: -0.15, lh: 18 });
    tabLbl.x = Math.round((120 - tabLbl.width) / 2);
    tabLbl.y = 9;
    tab.appendChild(tabLbl);
    tabX += 124;
  }
  y += 72;

  // ── CHECKBOX / TOGGLE ────────────────────────────────────
  await section("Чекбокс / Перемикач");

  // Checkbox checked
  const cbOn = rc(20, 20, "#2b7fff", 4);
  cbOn.x = 40; cbOn.y = y;
  page.appendChild(cbOn);
  const cbOnLbl = await t("Активний", 14, "Regular", "#0a0a0a", { ls: -0.15, lh: 20 });
  cbOnLbl.x = 68; cbOnLbl.y = y;
  page.appendChild(cbOnLbl);

  // Checkbox unchecked
  const cbOff = rc(20, 20, "#ffffff", 4);
  cbOff.strokes = [{ type: "SOLID", color: hexRGB("#e5e7eb"), opacity: 1 }];
  cbOff.strokeWeight = 1.5;
  cbOff.x = 200; cbOff.y = y;
  page.appendChild(cbOff);
  const cbOffLbl = await t("Неактивний", 14, "Regular", "#737373", { ls: -0.15, lh: 20 });
  cbOffLbl.x = 228; cbOffLbl.y = y;
  page.appendChild(cbOffLbl);

  // Toggle on
  const toggleOn = fr("Toggle/On", 44, 24, "#2b7fff");
  toggleOn.cornerRadius = 12; toggleOn.x = 380; toggleOn.y = y - 2;
  page.appendChild(toggleOn);
  const knob = rc(20, 20, "#ffffff", 10);
  knob.x = 22; knob.y = 2; toggleOn.appendChild(knob);

  const toggleOnLbl = await t("Увімкнено", 14, "Regular", "#0a0a0a", { ls: -0.15, lh: 20 });
  toggleOnLbl.x = 432; toggleOnLbl.y = y;
  page.appendChild(toggleOnLbl);

  y += 48;
}

// ── Page 4: Complex Components ────────────────────────────────

async function buildComplexComponents(page: PageNode): Promise<void> {
  page.name = "🗂 Складні компоненти";
  let y = 40;

  async function section(title: string): Promise<void> {
    const lbl = await t(title, 13, "SemiBold", "#030213", { ls: -0.15, lh: 18 });
    lbl.x = 40; lbl.y = y;
    page.appendChild(lbl);
    y += 28;
  }

  // ── VEHICLE CARD ─────────────────────────────────────────
  await section("Картка транспортного засобу");

  const card = fr("Card / Vehicle", 420, 360, "#ffffff");
  card.cornerRadius = 14;
  card.strokes = [borderPaint(0.1)]; card.strokeWeight = 1;
  card.x = 40; card.y = y;
  page.appendChild(card);

  const imgPlaceholder = rc(372, 160, "#f3f3f5", 10);
  imgPlaceholder.x = 24; imgPlaceholder.y = 20;
  card.appendChild(imgPlaceholder);
  const imgLbl = await t("Фото ТЗ", 12, "Regular", "#bcbcbc");
  imgLbl.x = 186 - imgLbl.width / 2; imgLbl.y = 92;
  card.appendChild(imgLbl);

  const cardTitle = await t("Загальна інформація", 16, "Medium", "#0a0a0a", { ls: -0.31, lh: 24 });
  cardTitle.x = 24; cardTitle.y = 196;
  card.appendChild(cardTitle);
  div(card, 24, 228, 372);

  const rows: [string, string][] = [
    ["Марка / Модель:", "Toyota Camry"],
    ["Рік:", "2024"],
    ["VIN:", "1HGBH41JXMN109186"],
    ["Пробіг:", "15 000 км"],
  ];
  for (let i = 0; i < rows.length; i++) {
    const lbl = await t(rows[i][0], 13, "Regular", "#4a5565", { ls: -0.15, lh: 18 });
    lbl.x = 24; lbl.y = 240 + i * 26; card.appendChild(lbl);
    const val = await t(rows[i][1], 13, "Medium", "#0a0a0a", { ls: -0.15, lh: 18, family: i === 2 ? "Courier New" : "Inter" });
    val.x = 420 - 24 - val.width; val.y = 240 + i * 26; card.appendChild(val);
  }

  // Badge inside card
  const cardBadge = await makeBadge("Нереалізовано", "#e6f9ef", "#00a63e");
  cardBadge.x = 24; cardBadge.y = 320;
  card.appendChild(cardBadge);

  y += 380;

  // ── TABLE ────────────────────────────────────────────────
  await section("Таблиця транспортних засобів");

  const tableW = 680;
  const headerCells = ["№", "Держ. номер", "Марка/Модель", "Рік", "Статус", "Ціна", "Дії"];
  const headerRow = await makeTableRow(headerCells, true);
  headerRow.resize(tableW, 40);
  headerRow.cornerRadius = 10;
  headerRow.x = 40; headerRow.y = y;
  page.appendChild(headerRow);

  const dataRows = [
    ["1", "АА1234ВВ", "Toyota Camry", "2024", "Активний", "$28 500", "→"],
    ["2", "КА5678СС", "BMW 3 Series", "2022", "Архів",    "$32 000", "→"],
    ["3", "ВА9012ТТ", "Volkswagen",   "2023", "Новий",    "$24 900", "→"],
  ];
  for (let i = 0; i < dataRows.length; i++) {
    const row = await makeTableRow(dataRows[i]);
    row.resize(tableW, 52);
    row.cornerRadius = i === dataRows.length - 1 ? 10 : 0;
    row.fills = [fill(i % 2 === 0 ? "#ffffff" : "#fafafa")];
    row.x = 40; row.y = y + 40 + i * 52;
    page.appendChild(row);
  }
  y += 216;

  // ── SIDEBAR ──────────────────────────────────────────────
  await section("Бічна панель навігації");

  const sidebar = fr("Sidebar", 240, 480, "#ffffff");
  sidebar.cornerRadius = 14;
  sidebar.strokes = [borderPaint(0.08)]; sidebar.strokeWeight = 1;
  sidebar.x = 40; sidebar.y = y;
  page.appendChild(sidebar);

  const logo = await t("ЄДРТЗВ", 16, "Bold", "#030213", { ls: -0.31, lh: 22 });
  logo.x = 24; logo.y = 20; sidebar.appendChild(logo);
  div(sidebar, 16, 52, 208);

  const navItems: [string, boolean][] = [
    ["Список ТЗ", true],
    ["Документи", false],
    ["Пошук", false],
    ["Звіти", false],
    ["Налаштування", false],
  ];
  for (let i = 0; i < navItems.length; i++) {
    const [label, isActive] = navItems[i];
    if (isActive) {
      const activeBar = rc(240, 40, "#eff6ff", 8);
      activeBar.x = 0; activeBar.y = 68 + i * 48;
      sidebar.appendChild(activeBar);
    }
    const navLbl = await t(label, 14, isActive ? "Medium" : "Regular", isActive ? "#2b7fff" : "#6a7282", { ls: -0.15, lh: 20 });
    navLbl.x = 24; navLbl.y = 78 + i * 48;
    sidebar.appendChild(navLbl);
  }

  // Stats cards in sidebar
  div(sidebar, 16, 316, 208);
  const statsTitle = await t("Статистика", 12, "Medium", "#737373", { ls: -0.15, lh: 16 });
  statsTitle.x = 24; statsTitle.y = 328; sidebar.appendChild(statsTitle);

  const stats: [string, string][] = [["142", "Активних ТЗ"], ["38", "Документів"]];
  for (let i = 0; i < stats.length; i++) {
    const statCard = fr(`Stat/${i}`, 96, 64, "#f9fafb");
    statCard.cornerRadius = 10;
    statCard.x = 16 + i * 112; statCard.y = 352;
    sidebar.appendChild(statCard);
    const num = await t(stats[i][0], 20, "SemiBold", "#0a0a0a", { ls: -0.44, lh: 28 });
    num.x = 12; num.y = 10; statCard.appendChild(num);
    const lbl = await t(stats[i][1], 10, "Regular", "#737373", { ls: -0.15, lh: 14 });
    lbl.x = 12; lbl.y = 40; statCard.appendChild(lbl);
  }

  y += 500;

  // ── MODAL / DIALOG ───────────────────────────────────────
  await section("Модальне вікно");

  const modal = fr("Modal", 520, 280, "#ffffff");
  modal.cornerRadius = 14;
  modal.effects = [{
    type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.15 },
    offset: { x: 0, y: 8 }, radius: 32, spread: 0, visible: true, blendMode: "NORMAL",
  }];
  modal.x = 40; modal.y = y;
  page.appendChild(modal);

  const modalH = await t("Постановка ТЗ на комісію", 18, "SemiBold", "#0a0a0a", { ls: -0.44, lh: 27 });
  modalH.x = 24; modalH.y = 24; modal.appendChild(modalH);
  div(modal, 0, 63, 520);

  const modalSub = await t("Заповніть всі обов'язкові поля форми.", 14, "Regular", "#6a7282", { ls: -0.15, lh: 20 });
  modalSub.x = 24; modalSub.y = 80; modal.appendChild(modalSub);

  const closeRect = rc(24, 24, "#f3f3f5", 6);
  closeRect.x = 480; closeRect.y = 20; modal.appendChild(closeRect);
  const closeLbl = await t("✕", 12, "Regular", "#737373");
  closeLbl.x = 486; closeLbl.y = 22; modal.appendChild(closeLbl);

  div(modal, 0, 220, 520);
  const btnCancel = await makeButton("Скасувати", "#f3f3f5", "#0a0a0a", 120);
  btnCancel.x = 24; btnCancel.y = 232; modal.appendChild(btnCancel);
  const btnOk = await makeButton("Підтвердити", "#2b7fff", "#ffffff", 140);
  btnOk.x = 356; btnOk.y = 232; modal.appendChild(btnOk);

  y += 300;

  // ── FILE UPLOAD ──────────────────────────────────────────
  await section("Завантаження файлу");

  const dropzone = fr("Dropzone", 360, 120, "#fafafa");
  dropzone.cornerRadius = 10;
  dropzone.strokes = [{ type: "SOLID", color: hexRGB("#bedbff"), opacity: 1 }];
  dropzone.strokeWeight = 1.5;
  (dropzone as FrameNode).dashPattern = [8, 4];
  dropzone.x = 40; dropzone.y = y;
  page.appendChild(dropzone);

  const uploadTitle = await t("Перетягніть файл або", 14, "Medium", "#2b7fff", { ls: -0.15, lh: 20 });
  uploadTitle.x = 180 - uploadTitle.width / 2; uploadTitle.y = 32;
  dropzone.appendChild(uploadTitle);

  const uploadSub = await t("PDF, JPG, PNG — до 10 МБ", 12, "Regular", "#737373", { ls: -0.15, lh: 16 });
  uploadSub.x = 180 - uploadSub.width / 2; uploadSub.y = 56;
  dropzone.appendChild(uploadSub);

  const browseBtn = fr("Browse", 120, 32, "#eff6ff");
  browseBtn.cornerRadius = 8; browseBtn.x = 120; browseBtn.y = 80;
  dropzone.appendChild(browseBtn);
  const browseLbl = await t("Обрати файл", 12, "Medium", "#2b7fff", { ls: -0.15, lh: 16 });
  browseLbl.x = 60 - browseLbl.width / 2; browseLbl.y = 8;
  browseBtn.appendChild(browseLbl);

  y += 140;
}

// ── Main ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  await preload();
  figma.root.name = "ЄДРТЗВ — Design System v2";

  while (figma.root.children.length < 4) figma.createPage();
  const pages = figma.root.children.slice(0, 4) as PageNode[];

  await figma.setCurrentPageAsync(pages[0]);
  for (const c of [...pages[0].children]) c.remove();
  await buildColors(pages[0]);

  await figma.setCurrentPageAsync(pages[1]);
  for (const c of [...pages[1].children]) c.remove();
  await buildTypography(pages[1]);

  await figma.setCurrentPageAsync(pages[2]);
  for (const c of [...pages[2].children]) c.remove();
  await buildBasicComponents(pages[2]);

  await figma.setCurrentPageAsync(pages[3]);
  for (const c of [...pages[3].children]) c.remove();
  await buildComplexComponents(pages[3]);

  await figma.setCurrentPageAsync(pages[0]);
  figma.viewport.scrollAndZoomIntoView(pages[0].children);
  figma.notify("✅ Design System v2 — готово!", { timeout: 4000 });
  figma.closePlugin();
}

main().catch((err) => {
  console.error(err);
  figma.notify("❌ Помилка: " + String(err), { error: true });
  figma.closePlugin();
});
