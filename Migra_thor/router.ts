/// <reference types="@figma/plugin-typings" />

const MT_NS = "migra_thor";
const MT_COMPONENT_KEY = "componentKey";
const MT_SOURCE_COMPONENT_KEY = "sourceComponentKey";
const MT_COMPONENT_PROPS_KEY = "componentProps";

// ── Shared interface (design-system only) ─────────────────────
interface ColorToken { hex: string; group: string; opacity?: number; note?: string; }
type ComponentProps = Record<string, string>;
interface ComponentHint { key: string; props?: ComponentProps; }
interface InfoFieldValue { label: string; value: string; }
interface FormFieldValue { label: string; value: string; kind?: string; required?: boolean; span?: number; }
type TokenPaintUsage = "fill"|"stroke"|"text";
type TabItemState = "active"|"default"|"hover"|"disabled";
type InfoFieldState = "default"|"empty"|"muted"|"disabled";
interface TokenColorValue { name: string; hex: string; alpha: number; aliases?: string[]; }
interface TokenRadiusValue { name: string; value: number; aliases?: string[]; }
interface IndexedColorVariable { variable: Variable; hex: string; alpha: number; name: string; }
interface IndexedNumberVariable { variable: Variable; value: number; name: string; resolvedType: VariableResolvedDataType; }
interface TokenBindingIndex {
  colorsByName: Map<string, Variable>;
  radiiByName: Map<string, Variable>;
  colorValues: IndexedColorVariable[];
  radiusValues: IndexedNumberVariable[];
  hasVariables: boolean;
}

// ── Import interfaces ─────────────────────────────────────────
interface IFill   { type: "SOLID"; color: { r:number;g:number;b:number }; opacity: number }
interface IStroke { type: "SOLID"; color: { r:number;g:number;b:number }; opacity: number }
interface ILayer {
  type: "FRAME"|"RECTANGLE"|"TEXT"|"IMAGE"|"SVG"; name: string;
  x: number; y: number; width: number; height: number;
  fills: IFill[]; strokes: IStroke[]; strokeWeight: number;
  cornerRadius: number; opacity: number; overflow?: boolean;
  component?: ComponentHint;
  componentKey?: string; componentProps?: ComponentProps;
  characters?: string; fontSize?: number; fontWeight?: number;
  fontFamily?: string; letterSpacing?: number; lineHeight?: number;
  textColor?: { r:number;g:number;b:number }; imageData?: string; svg?: string;
  children?: ILayer[];
}
interface IExport { version: 1; title: string; viewport: { width:number; height:number }; root: ILayer }

// ── Dispatch ──────────────────────────────────────────────────

const cmd = figma.command;

if (cmd === "import") {
  runImport();
} else if (cmd === "design-system") {
  runDesignSystem().catch((err) => {
    figma.notify("Помилка: " + String(err), { error: true });
    figma.closePlugin();
  });
} else if (cmd === "screens") {
  runScreens().catch((err) => {
    figma.notify("Помилка: " + String(err), { error: true });
    figma.closePlugin();
  });
} else if (cmd === "rebuild-selection") {
  runRebuildSelection().catch((err) => {
    figma.notify("Помилка: " + String(err), { error: true });
    figma.closePlugin();
  });
} else {
  figma.closePlugin("Оберіть дію з меню плагіна");
}

function getLayerComponentHint(layer: ILayer): ComponentHint|null {
  if (layer.component?.key) return layer.component;
  if (layer.componentKey) return { key:layer.componentKey, props:layer.componentProps };
  return null;
}

let allPagesLoaded = false;

async function ensureAllPagesLoaded(): Promise<void> {
  if (allPagesLoaded) return;
  try {
    await figma.loadAllPagesAsync();
    allPagesLoaded = true;
  } catch (_) {}
}

async function ensureCurrentPageLoaded(): Promise<void> {
  try {
    await figma.currentPage.loadAsync();
  } catch (_) {}
}

function matchesRegistryComponent(node: PageNode|SceneNode, key: string): node is ComponentNode {
  return node.type === "COMPONENT" && (
    node.getSharedPluginData(MT_NS, MT_COMPONENT_KEY) === key ||
    node.name === key ||
    node.name.endsWith(`/${key}`)
  );
}

function findRegistryComponentOnPage(page: PageNode, key: string): ComponentNode|null {
  try {
    const found = page.findAll((node) => matchesRegistryComponent(node, key)) as ComponentNode[];
    return found[0] ?? null;
  } catch (_) {
    return null;
  }
}

async function findRegistryComponent(key: string): Promise<ComponentNode|null> {
  await ensureAllPagesLoaded();
  try {
    const found = figma.root.findAll((node) => matchesRegistryComponent(node, key)) as ComponentNode[];
    return found[0] ?? null;
  } catch (_) {
    return findRegistryComponentOnPage(figma.currentPage, key);
  }
}

async function setTextNodeCharacters(node: TextNode, value: string): Promise<void> {
  if (node.fontName !== figma.mixed) {
    try { await figma.loadFontAsync(node.fontName); } catch (_) {}
  } else {
    try { await figma.loadFontAsync({ family:"Inter", style:"Regular" }); } catch (_) {}
  }
  node.characters = value;
}

async function setInstanceText(instance: InstanceNode, names: string[], value: string): Promise<void> {
  const textNodes = instance.findAll((node) => node.type === "TEXT") as TextNode[];
  if (textNodes.length === 0) return;
  const target = textNodes.find((node) => names.includes(node.name)) ?? textNodes[0];
  await setTextNodeCharacters(target, value);
}

function parseStringArrayProp(value: string|undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? ""));
  } catch (_) {}
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}

function parseStringRowsProp(value: string|undefined): string[][] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((row): row is unknown[] => Array.isArray(row))
        .map((row) => row.map((item) => String(item ?? "")));
    }
  } catch (_) {}
  return [];
}

function parseInfoFieldsProp(value: string|undefined): InfoFieldValue[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): InfoFieldValue|null => {
        if (Array.isArray(item)) {
          return { label:String(item[0] ?? ""), value:String(item[1] ?? "") };
        }
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return { label:String(record.label ?? ""), value:String(record.value ?? "") };
        }
        return null;
      })
      .filter((item): item is InfoFieldValue => !!item && !!item.label);
  } catch (_) {
    return [];
  }
}

function parseFormFieldsProp(value: string|undefined): FormFieldValue[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): FormFieldValue|null => {
        if (Array.isArray(item)) {
          return { label:String(item[0] ?? ""), value:String(item[1] ?? ""), kind:String(item[2] ?? "input") };
        }
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return {
            label:String(record.label ?? ""),
            value:String(record.value ?? ""),
            kind:String(record.kind ?? "input"),
            required:Boolean(record.required),
            span:Number(record.span) || undefined,
          };
        }
        return null;
      })
      .filter((item): item is FormFieldValue => !!item && !!item.label);
  } catch (_) {
    return [];
  }
}

const SHELTER_TABLE_HEADERS = ["", "Назва / Статус", "Доступ", "Місткість", "Адреса", "Джерело", "Створено"];
const SHELTER_TABLE_WIDTHS = [44, 324, 170, 150, 380, 220, 180];
const DEFAULT_STEPPER_LABELS = ["Основні", "Розташування", "Характеристики", "Власність", "Інвентаризація", "Огляд", "Документи", "Фінанси", "Медіа"];
const DEFAULT_TAB_LABELS = [
  "Основні параметри",
  "Розташування",
  "Характеристики",
  "Власність",
  "Інвентаризація",
  "Огляд",
  "Документи",
  "Фінанси",
  "Медіа",
];
const DEFAULT_INFO_TABLE_FIELDS: InfoFieldValue[] = [
  { label:"ID", value:"0f6ca5cc-24c3-4d79-b6c5-d422d074f439" },
  { label:"Дата створення", value:"15.05.2026, 14:00:30" },
  { label:"Створив", value:"dsns@example.com" },
  { label:"Дата редагування", value:"—" },
  { label:"Обліковий номер", value:"14-КВ-0012" },
  { label:"Тимчасовий номер", value:"ТН-2024-0847" },
  { label:"Технічний номер", value:"ТЕХ-0012-КВ" },
  { label:"Дата реєстрації", value:"2023-04-12" },
  { label:"Назва об'єкта", value:"Укриття «Хрещатик»" },
  { label:"Регіон", value:"Київська" },
  { label:"Вид укриття", value:"—" },
  { label:"Статус укриття", value:"OPERATION" },
  { label:"Дата статусу укриття", value:"2024-01-10" },
  { label:"Статус обліку", value:"ACCOUNTED" },
  { label:"Дата статусу обліку", value:"2023-04-12" },
  { label:"Статус запису", value:"ACTIVE" },
  { label:"Дата статусу запису", value:"2023-04-12" },
  { label:"Публікація", value:"Так" },
  { label:"Відповідальний", value:"Іваненко Михайло Петрович" },
];
const DEFAULT_FORM_FIELDS: FormFieldValue[] = [
  { label:"Обліковий номер", value:"14-КВ-0012", kind:"input" },
  { label:"Тимчасовий номер", value:"ТН-2024-XXXX", kind:"input" },
  { label:"Технічний номер", value:"ТЕХ-XXXX-XX", kind:"input" },
  { label:"Дата реєстрації", value:"Search", kind:"input" },
  { label:"Назва об'єкта", value:"Офіційна назва укриття", kind:"input", required:true, span:2 },
  { label:"Регіон", value:"Київська", kind:"input" },
  { label:"Вид укриття", value:"Оберіть вид", kind:"select", required:true },
  { label:"Тип доступу", value:"Оберіть тип доступу", kind:"select", required:true },
  { label:"Стан укриття", value:"Потреба", kind:"select" },
  { label:"Дата стану укриття", value:"Search", kind:"input" },
  { label:"Стан обліку", value:"Новий", kind:"select" },
  { label:"Дата стану обліку", value:"Search", kind:"input" },
  { label:"Стан запису", value:"Чернетка", kind:"select" },
  { label:"Дата стану запису", value:"Search", kind:"input" },
  { label:"Відповідальний", value:"ПІБ відповідального", kind:"input" },
];
const FIGMA_COLOR_TOKEN_VALUES: TokenColorValue[] = [
  { name:"bg/base", hex:"#0A0B0E", alpha:1 },
  { name:"bg/surface", hex:"#111318", alpha:1 },
  { name:"bg/surface-2", hex:"#1A1D26", alpha:1 },
  { name:"bg/overlay", hex:"#111318", alpha:0.95 },
  { name:"hover/md", hex:"#FFFFFF", alpha:0.04 },
  { name:"hover/strong", hex:"#FFFFFF", alpha:0.06 },
  { name:"text/primary", hex:"#F0F2F8", alpha:1 },
  { name:"text/secondary", hex:"#8892A4", alpha:1 },
  { name:"text/muted", hex:"#4A5568", alpha:1 },
  { name:"text/ghost", hex:"#2D3748", alpha:1 },
  { name:"border/default", hex:"#FFFFFF", alpha:0.06, aliases:["border"] },
  { name:"border/strong", hex:"#FFFFFF", alpha:0.08 },
  { name:"border/hover", hex:"#FFFFFF", alpha:0.14 },
  { name:"ring", hex:"#FFFFFF", alpha:0.06 },
  { name:"accent/default", hex:"#00E5A0", alpha:1, aliases:["accent"] },
  { name:"accent/10", hex:"#00E5A0", alpha:0.10 },
  { name:"accent/15", hex:"#00E5A0", alpha:0.15 },
  { name:"accent/25", hex:"#00E5A0", alpha:0.25 },
  { name:"purple", hex:"#6C63FF", alpha:1 },
  { name:"blue", hex:"#60A5FA", alpha:1 },
  { name:"amber", hex:"#F59E0B", alpha:1 },
  { name:"red", hex:"#FF6B6B", alpha:1 },
  { name:"bg/base", hex:"#F6F8FB", alpha:1 },
  { name:"bg/surface", hex:"#FFFFFF", alpha:1 },
  { name:"bg/surface-2", hex:"#EEF2F7", alpha:1 },
  { name:"bg/overlay", hex:"#FFFFFF", alpha:0.96 },
  { name:"hover/md", hex:"#101828", alpha:0.04 },
  { name:"hover/strong", hex:"#101828", alpha:0.07 },
  { name:"text/primary", hex:"#101828", alpha:1 },
  { name:"text/secondary", hex:"#475467", alpha:1 },
  { name:"text/muted", hex:"#667085", alpha:1 },
  { name:"text/ghost", hex:"#98A2B3", alpha:1 },
  { name:"border/default", hex:"#101828", alpha:0.08, aliases:["border"] },
  { name:"border/strong", hex:"#101828", alpha:0.12 },
  { name:"border/hover", hex:"#101828", alpha:0.18 },
  { name:"ring", hex:"#00A876", alpha:0.28 },
  { name:"accent/default", hex:"#00A876", alpha:1, aliases:["accent"] },
  { name:"accent/10", hex:"#00A876", alpha:0.10 },
  { name:"accent/15", hex:"#00A876", alpha:0.15 },
  { name:"accent/25", hex:"#00A876", alpha:0.25 },
  { name:"purple", hex:"#5B55D6", alpha:1 },
  { name:"blue", hex:"#2563EB", alpha:1 },
  { name:"amber", hex:"#B45309", alpha:1 },
  { name:"red", hex:"#DC2626", alpha:1 },
];
const FIGMA_RADIUS_TOKEN_VALUES: TokenRadiusValue[] = [
  { name:"radius/sm", value:6, aliases:["sm"] },
  { name:"radius/md", value:8, aliases:["md"] },
  { name:"radius/lg", value:10, aliases:["lg"] },
  { name:"radius/xl", value:12, aliases:["xl"] },
  { name:"radius/2xl", value:16, aliases:["2xl"] },
];
let tokenBindingIndexPromise: Promise<TokenBindingIndex>|null = null;

function emptyTokenBindingIndex(): TokenBindingIndex {
  return {
    colorsByName:new Map<string, Variable>(),
    radiiByName:new Map<string, Variable>(),
    colorValues:[],
    radiusValues:[],
    hasVariables:false,
  };
}

function normalizeHeaderText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isShelterTableHeaders(headers: string[]): boolean {
  const normalized = headers.map(normalizeHeaderText);
  return (
    normalized.some((header) => header.includes("назва") && header.includes("статус")) &&
    normalized.includes("доступ") &&
    normalized.includes("місткість") &&
    normalized.includes("адреса")
  );
}

function splitShelterNameStatus(value: string): { name:string; type:string; status:string } {
  const clean = value.replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ").trim();
  const typeLabels = ["Мобільне", "Стац.", "MOBILE", "STATIC"];
  const statusLabels = ["Експлуатація", "Потреба", "Проєкт", "Ремонт", "Схвалена", "Відхилена", "Подана"];
  const status = statusLabels.find((label) => clean.includes(label)) ?? "";
  const type = typeLabels.find((label) => clean.includes(label)) ?? "";
  let name = clean;
  for (const label of [...typeLabels, ...statusLabels]) {
    name = name.replace(label, " ");
  }
  name = name.replace(/\s+/g, " ").trim();
  return { name:name || clean, type:type === "STATIC" ? "Стац." : type === "MOBILE" ? "Мобільне" : type, status };
}

function normalizeShelterTableRows(rows: string[][]): string[][] {
  return rows.map((row) => {
    if (row.length >= 9) return row.slice(0, 9);
    const first = row[0] ?? "";
    const firstLooksLikeType = /^(STATIC|MOBILE|Стац\.|Мобільне)$/i.test(first.trim());
    const nameIndex = firstLooksLikeType ? 1 : 0;
    const nameParts = splitShelterNameStatus(row[nameIndex] ?? "");
    const type = nameParts.type || (firstLooksLikeType ? splitShelterNameStatus(first).type : "");
    const valueOffset = firstLooksLikeType ? 2 : 1;
    return [
      "",
      nameParts.name,
      type,
      nameParts.status,
      row[valueOffset] ?? "",
      row[valueOffset + 1] ?? "",
      row[valueOffset + 2] ?? "",
      row[valueOffset + 3] ?? "",
      row[valueOffset + 4] ?? "",
    ];
  });
}

function isShelterTableProps(props: ComponentProps|undefined): boolean {
  if (!props) return false;
  if (props.tableKind === "shelters") return true;
  return isShelterTableHeaders(parseStringArrayProp(props.headers));
}

function normalizeTokenVariableName(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\s*\/\s*/g, "/").toLowerCase();
}

function tokenVariableLookupNames(name: string, aliases: string[] = []): string[] {
  const values = new Set<string>();
  const sourceNames = [name, ...aliases];
  for (const source of sourceNames) {
    const normalized = normalizeTokenVariableName(source);
    values.add(normalized);
    values.add(`color/${normalized}`);
    values.add(`colors/${normalized}`);
    values.add(`token/${normalized}`);
    values.add(`tokens/${normalized}`);
    values.add(normalized.replace(/\//g, "."));
    values.add(normalized.replace(/\//g, "-"));
  }
  return Array.from(values);
}

async function getLocalVariablesByType(type: VariableResolvedDataType): Promise<Variable[]> {
  try {
    return await figma.variables.getLocalVariablesAsync(type);
  } catch (_) {
    return [];
  }
}

async function getTokenBindingIndex(): Promise<TokenBindingIndex> {
  if (tokenBindingIndexPromise) return tokenBindingIndexPromise;
  tokenBindingIndexPromise = (async () => {
    try {
      const [colorVariables, radiusVariables, stringVariables] = await Promise.all([
        getLocalVariablesByType("COLOR"),
        getLocalVariablesByType("FLOAT"),
        getLocalVariablesByType("STRING"),
      ]);
      const numericVariables = [...radiusVariables, ...stringVariables];
      const colorsByName = new Map<string, Variable>();
      const radiiByName = new Map<string, Variable>();
      for (const variable of colorVariables) colorsByName.set(normalizeTokenVariableName(variable.name), variable);
      for (const variable of numericVariables) radiiByName.set(normalizeTokenVariableName(variable.name), variable);
      return {
        colorsByName,
        radiiByName,
        colorValues:colorVariables.flatMap(colorValuesFromVariable),
        radiusValues:numericVariables.flatMap(numberValuesFromVariable),
        hasVariables: colorVariables.length > 0 || numericVariables.length > 0,
      };
    } catch (_) {
      return emptyTokenBindingIndex();
    }
  })();
  return tokenBindingIndexPromise;
}

function findVariableForToken(map: Map<string, Variable>, token: { name:string; aliases?: string[] }): Variable|null {
  for (const name of tokenVariableLookupNames(token.name, token.aliases ?? [])) {
    const variable = map.get(name);
    if (variable) return variable;
  }
  return null;
}

function channelToHex(value: number): string {
  return Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, "0").toUpperCase();
}

function paintHex(paint: SolidPaint): string {
  return `#${channelToHex(paint.color.r)}${channelToHex(paint.color.g)}${channelToHex(paint.color.b)}`;
}

function rgbValueHex(color: RGB): string {
  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`;
}

function isRgbValue(value: VariableValue): value is RGB|RGBA {
  return (
    value !== null &&
    typeof value === "object" &&
    "r" in value &&
    "g" in value &&
    "b" in value
  );
}

function variableAlpha(value: RGB|RGBA): number {
  return "a" in value && typeof value.a === "number" ? value.a : 1;
}

function colorValuesFromVariable(variable: Variable): IndexedColorVariable[] {
  const result: IndexedColorVariable[] = [];
  for (const value of Object.values(variable.valuesByMode)) {
    if (!isRgbValue(value)) continue;
    result.push({
      variable,
      hex:rgbValueHex(value),
      alpha:variableAlpha(value),
      name:normalizeTokenVariableName(variable.name),
    });
  }
  return result;
}

function numericVariableValue(value: VariableValue): number|null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValuesFromVariable(variable: Variable): IndexedNumberVariable[] {
  const result: IndexedNumberVariable[] = [];
  for (const value of Object.values(variable.valuesByMode)) {
    const numericValue = numericVariableValue(value);
    if (numericValue === null) continue;
    result.push({
      variable,
      value:numericValue,
      name:normalizeTokenVariableName(variable.name),
      resolvedType:variable.resolvedType,
    });
  }
  return result;
}

function alphaMatches(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.015;
}

function colorTokenRank(token: TokenColorValue, usage: TokenPaintUsage, alpha: number): number {
  let rank = alphaMatches(token.alpha, alpha) ? -100 : 0;
  if (usage === "text") {
    if (token.name.startsWith("text/")) rank -= 60;
    if (["accent/default", "red", "blue", "amber", "purple"].includes(token.name)) rank -= 30;
    if (token.name.startsWith("bg/") || token.name.startsWith("border/") || token.name.startsWith("hover/")) rank += 30;
  } else if (usage === "stroke") {
    if (token.name.startsWith("border/")) rank -= 60;
    if (token.name === "ring") rank -= 35;
    if (token.name.startsWith("accent/") || ["red", "blue", "amber", "purple"].includes(token.name)) rank -= 25;
    if (token.name.startsWith("text/") || token.name.startsWith("bg/") || token.name.startsWith("hover/")) rank += 25;
  } else {
    if (token.name.startsWith("bg/") || token.name.startsWith("hover/")) rank -= 50;
    if (token.name.startsWith("accent/") || ["red", "blue", "amber", "purple"].includes(token.name)) rank -= 25;
    if (token.name.startsWith("border/") || token.name === "ring" || token.name.startsWith("text/")) rank += 25;
  }
  return rank;
}

function colorVariableRank(name: string, usage: TokenPaintUsage): number {
  let rank = 0;
  if (usage === "text") {
    if (name.startsWith("text/")) rank -= 70;
    if (name.includes("on-accent")) rank -= 45;
    if (name.startsWith("status/") || name.startsWith("brand/") || name.startsWith("accent/")) rank -= 25;
    if (name.startsWith("bg/") || name.startsWith("border/") || name.startsWith("hover/")) rank += 30;
  } else if (usage === "stroke") {
    if (name.startsWith("border/")) rank -= 70;
    if (name === "ring") rank -= 50;
    if (name.includes("/border") || name.startsWith("status/") || name.startsWith("accent/")) rank -= 25;
    if (name.startsWith("text/") || name.startsWith("bg/") || name.startsWith("hover/")) rank += 25;
  } else {
    if (name.startsWith("bg/") || name.startsWith("hover/") || name.startsWith("overlay/")) rank -= 65;
    if (name.includes("/bg") || name.startsWith("accent/") || name.startsWith("status/") || name.startsWith("brand/")) rank -= 25;
    if (name.startsWith("border/") || name === "ring" || name.startsWith("text/")) rank += 25;
  }
  return rank;
}

function findColorTokenForPaint(paint: SolidPaint, usage: TokenPaintUsage): TokenColorValue|null {
  const hex = paintHex(paint);
  const alpha = paint.opacity ?? 1;
  const exact = FIGMA_COLOR_TOKEN_VALUES.filter((token) => token.hex === hex && alphaMatches(token.alpha, alpha));
  const matches = exact.length > 0
    ? exact
    : FIGMA_COLOR_TOKEN_VALUES.filter((token) => token.hex === hex && alphaMatches(token.alpha, 1));
  matches.sort((a, b) => colorTokenRank(a, usage, alpha) - colorTokenRank(b, usage, alpha));
  return matches[0] ?? null;
}

function findColorVariableForPaint(paint: SolidPaint, usage: TokenPaintUsage, index: TokenBindingIndex): Variable|null {
  const token = findColorTokenForPaint(paint, usage);
  if (token) {
    const namedVariable = findVariableForToken(index.colorsByName, token);
    if (namedVariable) return namedVariable;
  }
  const hex = paintHex(paint);
  const alpha = paint.opacity ?? 1;
  const matches = index.colorValues.filter((entry) => entry.hex === hex && alphaMatches(entry.alpha, alpha));
  matches.sort((a, b) => colorVariableRank(a.name, usage) - colorVariableRank(b.name, usage));
  return matches[0]?.variable ?? null;
}

function bindPaintsToTokenVariables(
  paints: ReadonlyArray<Paint>,
  usage: TokenPaintUsage,
  index: TokenBindingIndex,
): { paints: Paint[]; count: number } {
  let count = 0;
  const bound = paints.map((paint): Paint => {
    if (paint.type !== "SOLID") return paint;
    const variable = findColorVariableForPaint(paint, usage, index);
    if (!variable) return paint;
    try {
      count++;
      return figma.variables.setBoundVariableForPaint(paint, "color", variable);
    } catch (_) {
      count--;
      return paint;
    }
  });
  return { paints:bound, count };
}

function findRadiusToken(value: number): TokenRadiusValue|null {
  return FIGMA_RADIUS_TOKEN_VALUES.find((token) => Math.abs(token.value - value) < 0.1) ?? null;
}

function findRadiusVariableForValue(value: number, index: TokenBindingIndex): Variable|null {
  const token = findRadiusToken(value);
  if (token) {
    const namedVariable = findVariableForToken(index.radiiByName, token);
    if (namedVariable) return namedVariable;
  }
  const preferred = index.radiusValues
    .filter((entry) => Math.abs(entry.value - value) < 0.1)
    .sort((a, b) => {
      const aIsRadius = a.name.startsWith("radius/");
      const bIsRadius = b.name.startsWith("radius/");
      return Number(bIsRadius) - Number(aIsRadius);
    });
  return preferred[0]?.variable ?? null;
}

function numberVariableRank(name: string, preferredPatterns: string[]): number {
  let rank = 0;
  for (let i=0; i<preferredPatterns.length; i++) {
    if (name.includes(preferredPatterns[i])) rank -= 100 - i * 10;
  }
  if (name.includes("radius/")) rank += preferredPatterns.includes("radius/") ? 0 : 80;
  if (name.includes("spacing/")) rank += preferredPatterns.includes("spacing/") ? 0 : 20;
  if (name.includes("typography/")) rank += preferredPatterns.includes("typography/") ? 0 : 20;
  return rank;
}

function findNumberVariableForValue(
  value: number,
  index: TokenBindingIndex,
  preferredPatterns: string[],
): Variable|null {
  const matches = index.radiusValues
    .filter((entry) => Math.abs(entry.value - value) < 0.1)
    .sort((a, b) => {
      const typeRank = Number(b.resolvedType === "FLOAT") - Number(a.resolvedType === "FLOAT");
      if (typeRank !== 0) return typeRank;
      return numberVariableRank(a.name, preferredPatterns) - numberVariableRank(b.name, preferredPatterns);
    });
  return matches[0]?.variable ?? null;
}

function bindNumericFieldToVariable(
  node: SceneNode,
  field: VariableBindableNodeField,
  value: number,
  index: TokenBindingIndex,
  preferredPatterns: string[],
  options: { skipZero?: boolean } = {},
): number {
  if (options.skipZero && Math.abs(value) < 0.1) return 0;
  const variable = findNumberVariableForValue(value, index, preferredPatterns);
  if (!variable) return 0;
  try {
    const setVariable = node.setBoundVariable.bind(node);
    setVariable(field, variable);
    return 1;
  } catch (_) {
    return 0;
  }
}

function bindRadiusToTokenVariable(node: SceneNode, index: TokenBindingIndex): number {
  if (!("cornerRadius" in node)) return 0;
  const radiusNode = node as SceneNode & CornerMixin;
  if (typeof radiusNode.cornerRadius !== "number") return 0;
  const variable = findRadiusVariableForValue(radiusNode.cornerRadius, index);
  if (!variable) return 0;
  let count = 0;
  const fields: VariableBindableNodeField[] = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
  const setVariable = node.setBoundVariable.bind(node);
  for (const field of fields) {
    try {
      setVariable(field, variable);
      count++;
    } catch (_) {}
  }
  return count;
}

function bindLayoutSpacingToTokenVariables(node: SceneNode, index: TokenBindingIndex): number {
  let count = 0;
  if ("itemSpacing" in node && typeof node.itemSpacing === "number") {
    count += bindNumericFieldToVariable(node, "itemSpacing", node.itemSpacing, index, ["gap/", "spacing/", "component/", "layout/"]);
  }
  const paddingNode = node as SceneNode & {
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
  };
  const paddingFields: Array<{ prop:"paddingLeft"|"paddingRight"|"paddingTop"|"paddingBottom"; field:VariableBindableNodeField }> = [
    { prop:"paddingLeft", field:"paddingLeft" },
    { prop:"paddingRight", field:"paddingRight" },
    { prop:"paddingTop", field:"paddingTop" },
    { prop:"paddingBottom", field:"paddingBottom" },
  ];
  for (const { prop, field } of paddingFields) {
    const value = paddingNode[prop];
    if (typeof value === "number") {
      count += bindNumericFieldToVariable(node, field, value, index, ["padding/", "spacing/", "component/", "layout/"]);
    }
  }
  if ("strokeWeight" in node && typeof node.strokeWeight === "number") {
    count += bindNumericFieldToVariable(node, "strokeWeight", node.strokeWeight, index, ["borderwidth/", "border-width/", "stroke/"], { skipZero:true });
  }
  return count;
}

function bindTextVariables(node: SceneNode, index: TokenBindingIndex): number {
  if (node.type !== "TEXT") return 0;
  let count = 0;
  const textNode = node as TextNode;
  if (typeof node.fontSize === "number") {
    const fontSizeVariable = findNumberVariableForValue(node.fontSize, index, ["typography/size/", "font/size/"]);
    if (fontSizeVariable) {
      count += bindTextFieldToVariable(textNode, "fontSize", fontSizeVariable);
    }
  }
  if (node.fontWeight !== figma.mixed) {
    const fontWeightVariable = findNumberVariableForValue(node.fontWeight, index, ["typography/weight/", "font/weight/", "fontweight/"]);
    if (fontWeightVariable) {
      count += bindTextFieldToVariable(textNode, "fontWeight", fontWeightVariable);
    }
  }
  if (node.lineHeight !== figma.mixed && node.lineHeight.unit === "PIXELS") {
    const lineHeightVariable = findNumberVariableForValue(node.lineHeight.value, index, ["typography/lineheight/", "typography/line-height/", "lineheight/", "font/lineheight/"]);
    if (lineHeightVariable) {
      count += bindTextFieldToVariable(textNode, "lineHeight", lineHeightVariable);
    }
  }
  if (node.letterSpacing !== figma.mixed && node.letterSpacing.unit === "PIXELS") {
    const letterSpacingVariable = findNumberVariableForValue(node.letterSpacing.value, index, ["typography/letterspacing/", "typography/letter-spacing/", "letterspacing/", "font/letterspacing/"]);
    if (letterSpacingVariable) {
      count += bindTextFieldToVariable(textNode, "letterSpacing", letterSpacingVariable);
    }
  }
  return count;
}

function bindTextFieldToVariable(
  node: TextNode,
  field: VariableBindableTextField,
  variable: Variable,
): number {
  try {
    const setVariable = node.setBoundVariable.bind(node);
    setVariable(field, variable);
    return 1;
  } catch (_) {}
  if (node.characters.length === 0) return 0;
  try {
    const setRangeVariable = node.setRangeBoundVariable.bind(node);
    setRangeVariable(0, node.characters.length, field, variable);
    return 1;
  } catch (_) {
    return 0;
  }
}

function bindNodePaintVariables(node: SceneNode, index: TokenBindingIndex): number {
  let count = 0;
  if ("fills" in node) {
    const paintNode = node as SceneNode & MinimalFillsMixin;
    if (Array.isArray(paintNode.fills)) {
      const result = bindPaintsToTokenVariables(paintNode.fills, node.type === "TEXT" ? "text" : "fill", index);
      if (result.count > 0) {
        try {
          paintNode.fills = result.paints;
          count += result.count;
        } catch (_) {}
      }
    }
  }
  if ("strokes" in node) {
    const strokeNode = node as SceneNode & MinimalStrokesMixin;
    if (Array.isArray(strokeNode.strokes)) {
      const result = bindPaintsToTokenVariables(strokeNode.strokes, "stroke", index);
      if (result.count > 0) {
        try {
          strokeNode.strokes = result.paints;
          count += result.count;
        } catch (_) {}
      }
    }
  }
  return count;
}

async function bindNodeToTokenVariables(node: SceneNode, index?: TokenBindingIndex): Promise<number> {
  const tokenIndex = index ?? await getTokenBindingIndex();
  if (!tokenIndex.hasVariables) return 0;
  let count = bindNodePaintVariables(node, tokenIndex)
    + bindRadiusToTokenVariable(node, tokenIndex)
    + bindLayoutSpacingToTokenVariables(node, tokenIndex)
    + bindTextVariables(node, tokenIndex);
  if ("children" in node) {
    for (const child of node.children) count += await bindNodeToTokenVariables(child, tokenIndex);
  }
  return count;
}

async function safeBindNodeToTokenVariables(
  node: SceneNode,
  index?: TokenBindingIndex,
): Promise<{ count:number; failed:boolean }> {
  try {
    return { count:await bindNodeToTokenVariables(node, index), failed:false };
  } catch (_) {
    return { count:0, failed:true };
  }
}

function parseNumberArrayProp(value: string|undefined): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => Number(item)).filter(Number.isFinite);
  } catch (_) {}
  return value
    .split(/[|,]/)
    .map((item) => Number(item.trim()))
    .filter(Number.isFinite);
}

async function setTextInNamedContainer(instance: InstanceNode, containerName: string, value: string): Promise<void> {
  const container = instance.findOne((node) => node.name === containerName) as SceneNode|null;
  if (!container) return;
  if (container.type === "TEXT") {
    await setTextNodeCharacters(container, value);
    return;
  }
  if (!("findAll" in container)) return;
  const textNodes = container.findAll((node) => node.type === "TEXT") as TextNode[];
  if (textNodes.length === 0) return;
  const preferred = textNodes.find((node) => ["Text", "Title", "Label"].includes(node.name)) ?? textNodes[0];
  await setTextNodeCharacters(preferred, value);
}

async function setNamedTextInContainer(instance: InstanceNode, containerName: string, textName: string, value: string): Promise<void> {
  const container = instance.findOne((node) => node.name === containerName) as SceneNode|null;
  if (!container) return;
  if (container.type === "TEXT") {
    if (container.name === textName) await setTextNodeCharacters(container, value);
    return;
  }
  if (!("findAll" in container)) return;
  const textNode = (container.findAll((node) => node.type === "TEXT" && node.name === textName) as TextNode[])[0];
  if (textNode) await setTextNodeCharacters(textNode, value);
}

function nodeNameMatches(actual: string, expected: string): boolean {
  return actual === expected || actual.endsWith(`/${expected}`);
}

async function setFormFieldTexts(instance: InstanceNode, containerName: string, label: string, value: string): Promise<void> {
  const container = instance.findOne((node) => nodeNameMatches(node.name, containerName)) as SceneNode|null;
  if (!container) return;
  const textNodes =
    container.type === "TEXT"
      ? [container]
      : "findAll" in container
        ? (container.findAll((node) => node.type === "TEXT") as TextNode[])
        : [];
  if (textNodes.length === 0) return;

  const sorted = textNodes.sort((a, b) => {
    const aPos = absolutePosition(a);
    const bPos = absolutePosition(b);
    return (aPos.y - bPos.y) || (aPos.x - bPos.x);
  });
  const labelNode = sorted.find((node) => node.name === "Field Label") ?? sorted.find((node) => node.name === "Label") ?? sorted[0];
  const valueNode =
    sorted.find((node) => node.name === "Value") ??
    sorted.find((node) => node.name === "Placeholder") ??
    sorted.find((node) => node.name === "Text" && node.id !== labelNode.id) ??
    sorted.find((node) => node.id !== labelNode.id);

  if (labelNode) await setTextNodeCharacters(labelNode, label);
  if (valueNode) await setTextNodeCharacters(valueNode, value);
}

function setNamedNodePaintInContainer(instance: InstanceNode, containerName: string, nodeName: string, fills: Paint[], strokes?: Paint[]): void {
  const container = instance.findOne((node) => node.name === containerName) as SceneNode|null;
  if (!container || !("findOne" in container)) return;
  const node = container.findOne((child) => child.name === nodeName) as SceneNode|null;
  if (!node) return;
  try {
    if ("fills" in node) node.fills = fills;
    if (strokes && "strokes" in node) node.strokes = strokes;
  } catch (_) {}
}

function setNamedTextPaintInContainer(instance: InstanceNode, containerName: string, textName: string, color: string): void {
  const container = instance.findOne((node) => node.name === containerName) as SceneNode|null;
  if (!container || !("findOne" in container)) return;
  const textNode = container.findOne((node) => node.type === "TEXT" && node.name === textName) as TextNode|null;
  if (!textNode) return;
  try { textNode.fills = [dynamicPaint(color)]; } catch (_) {}
}

function setIconPaintInContainer(instance: InstanceNode, containerName: string, color: string): void {
  const container = instance.findOne((node) => node.name === containerName) as SceneNode|null;
  if (!container || !("findAll" in container)) return;
  const paintValue = dynamicPaint(color);
  const iconNodes = container.findAll((node) => node.name.startsWith("Icon/") || node.type === "VECTOR");
  for (const iconNode of iconNodes) {
    try {
      if ("strokes" in iconNode) iconNode.strokes = [paintValue];
      if ("fills" in iconNode && iconNode.type === "VECTOR") iconNode.fills = [];
    } catch (_) {}
  }
}

function stepperTone(state: "invalid"|"completed"|"active"|"pending"): { fill:Paint[]; stroke:Paint[]; text:string; connector:Paint[] } {
  if (state === "invalid") return {
    fill:[dynamicPaint("#ff6b6b", 0.15)],
    stroke:[dynamicPaint("#ff6b6b", 0.5)],
    text:"#ff6b6b",
    connector:[dynamicPaint("#ff6b6b", 0.3)],
  };
  if (state === "completed") return {
    fill:[dynamicPaint("#00e5a0", 0.2)],
    stroke:[dynamicPaint("#00e5a0", 0.5)],
    text:"#00e5a0",
    connector:[dynamicPaint("#00e5a0", 0.4)],
  };
  if (state === "active") return {
    fill:[dynamicPaint("#00e5a0")],
    stroke:[dynamicPaint("#00e5a0")],
    text:"#051a12",
    connector:[dynamicPaint("#343a46")],
  };
  return {
    fill:[dynamicPaint("#1a1f2b")],
    stroke:[dynamicPaint("#343a46")],
    text:"#6f7a8f",
    connector:[dynamicPaint("#343a46")],
  };
}

async function applyStepperProps(instance: InstanceNode, props: ComponentProps): Promise<void> {
  const labels = parseStringArrayProp(props.labels).length ? parseStringArrayProp(props.labels) : DEFAULT_STEPPER_LABELS;
  const total = Math.max(1, Math.min(Number(props.total) || labels.length || DEFAULT_STEPPER_LABELS.length, DEFAULT_STEPPER_LABELS.length));
  const current = Math.max(1, Math.min(Number(props.current) || 1, total));
  const invalidSteps = new Set(parseNumberArrayProp(props.invalidSteps));

  for (let i=1; i<=DEFAULT_STEPPER_LABELS.length; i++) {
    const label = labels[i - 1] ?? DEFAULT_STEPPER_LABELS[i - 1] ?? `Крок ${i}`;
    await setNamedTextInContainer(instance, `Step/${i}`, "StepNumber", String(i));
    await setNamedTextInContainer(instance, `Step/${i}`, "StepLabel", label);

    const state = invalidSteps.has(i) ? "invalid" : i < current ? "completed" : i === current ? "active" : "pending";
    const tone = stepperTone(state);
    setNamedNodePaintInContainer(instance, `Step/${i}`, "StepCircle", tone.fill, tone.stroke);
    setNamedTextPaintInContainer(instance, `Step/${i}`, "StepNumber", tone.text);
    setNamedTextPaintInContainer(instance, `Step/${i}`, "StepLabel", state === "active" ? "#f0f2f8" : tone.text);
    setInstanceNodePaint(instance, `StepConnector/${i}`, state === "invalid" || state === "completed" ? tone.connector : [dynamicPaint("#343a46")]);
  }
}

async function applyTabBarProps(instance: InstanceNode, props: ComponentProps): Promise<void> {
  const tabLabels = parseStringArrayProp(props.tabs).length
    ? parseStringArrayProp(props.tabs)
    : parseStringArrayProp(props.labels).length
      ? parseStringArrayProp(props.labels)
      : DEFAULT_TAB_LABELS;
  const counts = parseNumberArrayProp(props.counts);
  const active = Math.max(1, Math.min(Number(props.activeIndex || props.active) || 1, DEFAULT_TAB_LABELS.length));

  for (let i=1; i<=DEFAULT_TAB_LABELS.length; i++) {
    const label = tabLabels[i - 1] ?? DEFAULT_TAB_LABELS[i - 1] ?? `Розділ ${i}`;
    const isActive = i === active;
    await setNamedTextInContainer(instance, `Tab/${i}`, "Label", label);
    await setNamedTextInContainer(instance, `Tab/${i}`, "Count", String(counts[i - 1] ?? 0));
    setInstanceNodePaint(instance, `Tab/${i}`, [isActive ? dynamicPaint("#00e5a0", 0.1) : dynamicPaint("#ffffff", 0)]);
    setNamedTextPaintInContainer(instance, `Tab/${i}`, "Label", isActive ? "#00e5a0" : "#8892a4");
  }
}

async function applySegmentedTabsProps(instance: InstanceNode, props: ComponentProps): Promise<void> {
  const labels = parseStringArrayProp(props.tabs).length
    ? parseStringArrayProp(props.tabs)
    : parseStringArrayProp(props.labels).length
      ? parseStringArrayProp(props.labels)
      : ["2D", "3D"];
  const active = Math.max(1, Math.min(Number(props.activeIndex || props.active) || 1, labels.length || 2));

  for (let i=1; i<=2; i++) {
    const label = labels[i - 1] ?? (i === 1 ? "2D" : "3D");
    const isActive = i === active;
    await setNamedTextInContainer(instance, `Segment/${i}`, "Label", label);
    setInstanceNodePaint(instance, `Segment/${i}`, [isActive ? dynamicPaint("#111318") : dynamicPaint("#ffffff", 0)]);
    setNamedTextPaintInContainer(instance, `Segment/${i}`, "Label", isActive ? "#f0f2f8" : "#8892a4");
    setIconPaintInContainer(instance, `Segment/${i}`, isActive ? "#f0f2f8" : "#8892a4");
  }
}

async function applyInfoTableProps(instance: InstanceNode, props: ComponentProps): Promise<void> {
  const fields = parseInfoFieldsProp(props.fields).length ? parseInfoFieldsProp(props.fields) : DEFAULT_INFO_TABLE_FIELDS;
  await setInstanceText(instance, ["Title"], props.title || "Системна інформація");

  for (let i=0; i<DEFAULT_INFO_TABLE_FIELDS.length; i++) {
    const field = fields[i] ?? DEFAULT_INFO_TABLE_FIELDS[i];
    await setNamedTextInContainer(instance, `Field/${i + 1}`, "FieldLabel", field.label.toUpperCase());
    await setNamedTextInContainer(instance, `Field/${i + 1}`, "FieldValue", field.value || "—");
  }
}

async function applyFormSectionProps(instance: InstanceNode, props: ComponentProps): Promise<void> {
  const fields = parseFormFieldsProp(props.fields).length ? parseFormFieldsProp(props.fields) : DEFAULT_FORM_FIELDS;
  await setInstanceText(instance, ["Title"], props.title || "Крок 1 з 9 — Основні параметри");
  for (let i=0; i<DEFAULT_FORM_FIELDS.length; i++) {
    const field = fields[i] ?? DEFAULT_FORM_FIELDS[i];
    const label = `${field.label.toUpperCase()}${field.required ? " *" : ""}`;
    await setFormFieldTexts(instance, `Field/${i + 1}`, label, field.value || "");
  }
}

async function applyShelterTableProps(instance: InstanceNode, props: ComponentProps): Promise<void> {
  const headers = parseStringArrayProp(props.headers).length ? parseStringArrayProp(props.headers) : SHELTER_TABLE_HEADERS;
  const rows = normalizeShelterTableRows(parseStringRowsProp(props.rows));
  for (let c=0; c<headers.length; c++) {
    await setTextInNamedContainer(instance, `Header/${c}`, headers[c]);
  }
  for (let r=0; r<rows.length; r++) {
    const row = rows[r];
    await setNamedTextInContainer(instance, `Cell/${r}/1`, "Title", row[1] ?? "");
    await setNamedTextInContainer(instance, `Cell/${r}/1`, "Type", row[2] ?? "");
    await setNamedTextInContainer(instance, `Cell/${r}/1`, "Status", row[3] ?? "");
    await setTextInNamedContainer(instance, `Cell/${r}/2`, row[4] ?? "");
    await setTextInNamedContainer(instance, `Cell/${r}/3`, row[5] ?? "");
    await setTextInNamedContainer(instance, `Cell/${r}/4`, row[6] ?? "");
    await setTextInNamedContainer(instance, `Cell/${r}/5`, row[7] ?? "");
    await setTextInNamedContainer(instance, `Cell/${r}/6`, row[8] ?? "");
  }
}

async function applyTableProps(instance: InstanceNode, props: ComponentProps): Promise<void> {
  if (isShelterTableProps(props)) {
    await applyShelterTableProps(instance, props);
    return;
  }
  const headers = parseStringArrayProp(props.headers);
  const rows = parseStringRowsProp(props.rows);
  for (let c=0; c<headers.length; c++) {
    await setTextInNamedContainer(instance, `Header/${c}`, headers[c]);
  }
  for (let r=0; r<12; r++) {
    const row = rows[r] ?? [];
    for (let c=0; c<7; c++) {
      if (row[c] !== undefined && row[c] !== "") await setTextInNamedContainer(instance, `Cell/${r}/${c}`, row[c]);
    }
  }
}

async function applyComponentProps(instance: InstanceNode, props: ComponentProps = {}): Promise<void> {
  const sourceKey = instance.getSharedPluginData(MT_NS, MT_SOURCE_COMPONENT_KEY) || instance.name;
  if (props.headers || props.rows) await applyTableProps(instance, props);
  const isTabItem = sourceKey.startsWith("Navigation/TabItem");
  const isSegmentedTabItem = sourceKey.startsWith("Navigation/SegmentedTabItem");
  const isInfoField = sourceKey.startsWith("Data/InfoField");
  if (sourceKey === "Form/RequestBasics") await applyFormSectionProps(instance, props);
  else if (sourceKey === "Data/InfoTable") await applyInfoTableProps(instance, props);
  else if (sourceKey === "Navigation/SegmentedTabs") await applySegmentedTabsProps(instance, props);
  else if (sourceKey === "Navigation/TabBar") await applyTabBarProps(instance, props);
  else if (isSegmentedTabItem) {
    if (props.text || props.label) await setInstanceText(instance, ["Label"], props.text || props.label || "");
  }
  else if (isInfoField) {
    if (props.label) await setInstanceText(instance, ["FieldLabel"], props.label);
    if (props.value || props.text) await setInstanceText(instance, ["FieldValue"], props.value || props.text || "—");
  }
  else if (isTabItem) {
    if (props.text || props.label) await setInstanceText(instance, ["Label"], props.text || props.label || "");
    if (props.count || props.value || props.badge) await setInstanceText(instance, ["Count"], props.count || props.value || props.badge || "");
  }
  else if (props.labels || props.current || props.invalidSteps) await applyStepperProps(instance, props);
  if (props.title) await setInstanceText(instance, ["Title", "LogoTitle"], props.title);
  if (props.message) await setInstanceText(instance, ["Message"], props.message);
  if (props.subtitle) await setInstanceText(instance, ["Subtitle", "LogoSubtitle"], props.subtitle);
  if (props.eyebrow) await setInstanceText(instance, ["Eyebrow"], props.eyebrow);
  if (props.delta) await setInstanceText(instance, ["Delta"], props.delta);
  if (props.badge) await setInstanceText(instance, ["Badge", "NavBadge"], props.badge);
  if (props.user) await setInstanceText(instance, ["User", "UserName"], props.user);
  if (props.role) await setInstanceText(instance, ["Role", "UserRole"], props.role);
  if (props.primaryAction) {
    await setInstanceText(instance, ["PrimaryAction", "PrimaryActionLabel"], props.primaryAction);
    await setTextInNamedContainer(instance, "PrimaryAction", props.primaryAction);
  }
  if (props.secondaryAction) {
    await setInstanceText(instance, ["SecondaryAction", "SecondaryActionLabel"], props.secondaryAction);
    await setTextInNamedContainer(instance, "SecondaryAction", props.secondaryAction);
  }
  if (props.text && !isTabItem && !isSegmentedTabItem && !isInfoField) await setInstanceText(instance, ["Label", "Text", "Title"], props.text);
  if (props.label && !isTabItem && !isSegmentedTabItem && !isInfoField) await setInstanceText(instance, ["Field Label", "Label"], props.label);
  if (props.value && !isTabItem && !isSegmentedTabItem && !isInfoField) await setInstanceText(instance, ["Value", "Text", "Label"], props.value);
  if (props.placeholder) await setInstanceText(instance, ["Placeholder", "Value"], props.placeholder);
}

function dynamicRgb(hex: string): RGB {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  const parsed = Number.parseInt(full || "000000", 16);
  return {
    r: ((parsed >> 16) & 255) / 255,
    g: ((parsed >> 8) & 255) / 255,
    b: (parsed & 255) / 255,
  };
}

function dynamicPaint(hex: string, opacity=1): SolidPaint {
  return { type:"SOLID", color:dynamicRgb(hex), opacity };
}

function setDynamicAutoLayout(
  node: FrameNode,
  mode: "HORIZONTAL"|"VERTICAL",
  itemSpacing=0,
): void {
  node.layoutMode = mode;
  node.primaryAxisSizingMode = "FIXED";
  node.counterAxisSizingMode = "FIXED";
  node.primaryAxisAlignItems = "MIN";
  node.counterAxisAlignItems = mode === "HORIZONTAL" ? "CENTER" : "MIN";
  node.itemSpacing = itemSpacing;
  node.paddingLeft = 0;
  node.paddingRight = 0;
  node.paddingTop = 0;
  node.paddingBottom = 0;
}

function badgeTone(value: string): { fill:string; stroke:string; text:string; dot:string } {
  const lower = value.toLowerCase();
  if (lower.includes("потреб") || lower.includes("ремонт")) return { fill:"#1f1710", stroke:"#8a5a12", text:"#f59e0b", dot:"#f59e0b" };
  if (lower.includes("проєкт") || lower.includes("мобіль")) return { fill:"#101a2b", stroke:"#24558f", text:"#60a5fa", dot:"#60a5fa" };
  if (lower.includes("відхил")) return { fill:"#2a1518", stroke:"#82434d", text:"#ff6b6b", dot:"#ff6b6b" };
  if (lower.includes("експлуатац") || lower.includes("схвал")) return { fill:"#06261d", stroke:"#007a58", text:"#00e5a0", dot:"#00e5a0" };
  return { fill:"#1a1d24", stroke:"#343a46", text:"#9aa4b5", dot:"#8390a3" };
}

function setInstanceNodePaint(root: InstanceNode, name: string, fills: Paint[], strokes?: Paint[]): void {
  const node = root.findOne((child) => child.name === name) as SceneNode|null;
  if (!node) return;
  try {
    if ("fills" in node) node.fills = fills;
    if (strokes && "strokes" in node) node.strokes = strokes;
  } catch (_) {}
}

function setInstanceTextPaint(root: InstanceNode, name: string, color: string): void {
  const node = root.findOne((child) => child.type === "TEXT" && child.name === name) as TextNode|null;
  if (!node) return;
  try { node.fills = [dynamicPaint(color)]; } catch (_) {}
}

function setInstanceStrokePaint(root: InstanceNode, color: string): void {
  const paint = dynamicPaint(color);
  try {
    const nodes = root.findAll((child) => "strokes" in child) as Array<SceneNode & MinimalStrokesMixin>;
    for (const node of nodes) node.strokes = [paint];
  } catch (_) {}
}

async function createTableAtomInstance(
  key: string,
  name: string,
  width: number,
  height: number,
): Promise<InstanceNode|null> {
  const component = await findRegistryComponent(key);
  if (!component) return null;
  const instance = component.createInstance();
  instance.name = name;
  try { instance.resize(width, height); } catch (_) {}
  instance.setSharedPluginData(MT_NS, MT_SOURCE_COMPONENT_KEY, key);
  return instance;
}

async function createShelterTableNode(
  props: ComponentProps|undefined,
  width: number,
  height: number,
  opacity=1,
): Promise<FrameNode|null> {
  const rows = normalizeShelterTableRows(parseStringRowsProp(props?.rows)).slice(0, 24);
  const displayRows = rows.length ? rows : [
    ["active", "Бомбосховище «Університет»", "Стац.", "Експлуатація", "PUBLIC", "1500", "—", "ручне", "11.05.2026"],
    ["", "Підземний перехід «Майдан»", "Стац.", "Потреба", "PUBLIC", "600", "м. Київ, Майдан Незалежності", "a1524da6", "11.05.2026"],
    ["active", "Укриття «Поштова площа»", "Стац.", "Проєкт", "PUBLIC", "400", "м. Київ, Поштова площа, 2", "0dc0ace9", "11.05.2026"],
  ];
  const headers = parseStringArrayProp(props?.headers).length ? parseStringArrayProp(props?.headers) : SHELTER_TABLE_HEADERS;
  const baseTotal = SHELTER_TABLE_WIDTHS.reduce((sum, item) => sum + item, 0);
  const targetWidth = Math.max(Math.round(width || baseTotal), baseTotal);
  const scale = targetWidth / baseTotal;
  const widths = SHELTER_TABLE_WIDTHS.map((item, index) =>
    index === SHELTER_TABLE_WIDTHS.length - 1
      ? targetWidth - SHELTER_TABLE_WIDTHS.slice(0, -1).reduce((sum, value) => sum + Math.round(value * scale), 0)
      : Math.round(item * scale),
  );
  const headerH = 44;
  const rowH = Math.max(64, Math.min(92, Math.round(((height || 0) - headerH) / Math.max(displayRows.length, 1)) || 78));
  const totalHeight = headerH + displayRows.length * rowH;

  const table = figma.createFrame();
  table.name = "Data/Table/Shelters";
  table.resize(targetWidth, totalHeight);
  table.cornerRadius = 12;
  table.clipsContent = true;
  table.opacity = opacity;
  table.fills = [dynamicPaint("#101319")];
  table.strokes = [dynamicPaint("#252a34")];
  table.strokeWeight = 1;
  table.setSharedPluginData(MT_NS, MT_SOURCE_COMPONENT_KEY, "Data/Table/Shelters");
  if (props) table.setSharedPluginData(MT_NS, MT_COMPONENT_PROPS_KEY, JSON.stringify({ ...props, tableKind:"shelters" }));
  setDynamicAutoLayout(table, "VERTICAL");

  const header = figma.createFrame();
  header.name = "Table/Header";
  header.resize(targetWidth, headerH);
  header.fills = [dynamicPaint("#171b25")];
  header.strokes = [dynamicPaint("#252a34")];
  header.strokeWeight = 1;
  setDynamicAutoLayout(header, "HORIZONTAL");
  for (let c=0; c<widths.length; c++) {
    const cell = await createTableAtomInstance("Data/TableCell/header", `Header/${c}`, widths[c], headerH);
    if (!cell) return null;
    await setInstanceText(cell, ["Header", "Text", "Title"], headers[c] ?? "");
    header.appendChild(cell);
  }
  table.appendChild(header);

  for (let r=0; r<displayRows.length; r++) {
    const row = figma.createFrame();
    row.name = `Table/Row/${r}`;
    row.resize(targetWidth, rowH);
    row.fills = [dynamicPaint(r % 2 === 1 ? "#11151c" : "#101319")];
    row.strokes = [dynamicPaint("#202530")];
    row.strokeWeight = 1;
    setDynamicAutoLayout(row, "HORIZONTAL");

    const values = displayRows[r];
    const favorite = await createTableAtomInstance("Data/TableCell/favorite", `Cell/${r}/0`, widths[0], rowH);
    if (!favorite) return null;
    setInstanceStrokePaint(favorite, (values[0] ?? "") === "active" ? "#00e5a0" : "#5f6b80");
    row.appendChild(favorite);

    const nameCell = await createTableAtomInstance("Data/TableCell/shelterName", `Cell/${r}/1`, widths[1], rowH);
    if (!nameCell) return null;
    await setInstanceText(nameCell, ["Title"], values[1] ?? "");
    await setInstanceText(nameCell, ["Type"], values[2] ?? "");
    await setInstanceText(nameCell, ["Status"], values[3] ?? "");
    const typeTone = badgeTone(values[2] ?? "");
    const statusTone = badgeTone(values[3] ?? "");
    setInstanceNodePaint(nameCell, "TypeBadge", [dynamicPaint(typeTone.fill)], [dynamicPaint(typeTone.stroke)]);
    setInstanceNodePaint(nameCell, "StatusBadge", [dynamicPaint(statusTone.fill)], [dynamicPaint(statusTone.stroke)]);
    setInstanceNodePaint(nameCell, "StatusDot", [dynamicPaint(statusTone.dot)]);
    setInstanceTextPaint(nameCell, "Type", typeTone.text);
    setInstanceTextPaint(nameCell, "Status", statusTone.text);
    row.appendChild(nameCell);

    const cellKeys = ["Data/TableCell/muted", "Data/TableCell/text", "Data/TableCell/muted", "Data/TableCell/muted", "Data/TableCell/muted"];
    for (let c=2; c<widths.length; c++) {
      const cell = await createTableAtomInstance(cellKeys[c - 2], `Cell/${r}/${c}`, widths[c], rowH);
      if (!cell) return null;
      await setInstanceText(cell, ["Text", "Title", "Value", "Label"], values[c + 2] ?? "");
      row.appendChild(cell);
    }
    table.appendChild(row);
  }

  return table;
}

async function createRegistryInstance(
  key: string,
  props: ComponentProps|undefined,
  width: number,
  height: number,
  opacity=1,
): Promise<SceneNode|null> {
  if (key === "Data/Table/Shelters" || (key === "Data/Table" && isShelterTableProps(props))) {
    const table = await createShelterTableNode({ ...(props ?? {}), tableKind:"shelters" }, width, height, opacity);
    if (table) return table;
  }
  const component = await findRegistryComponent(key);
  if (!component) return null;
  const instance = component.createInstance();
  instance.name = key;
  if (width >= 1 && height >= 1) {
    try { instance.resize(width, height); } catch (_) {}
  }
  instance.opacity = opacity;
  instance.setSharedPluginData(MT_NS, MT_SOURCE_COMPONENT_KEY, key);
  if (props && Object.keys(props).length > 0) {
    instance.setSharedPluginData(MT_NS, MT_COMPONENT_PROPS_KEY, JSON.stringify(props));
    await applyComponentProps(instance, props);
  }
  return instance;
}

function readStoredComponentProps(node: BaseNode): ComponentProps|undefined {
  const raw = node.getSharedPluginData(MT_NS, MT_COMPONENT_PROPS_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as ComponentProps : undefined;
  } catch (_) {
    return undefined;
  }
}

function rgbToHex(color: RGB): string {
  const part = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, "0");
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

function textContentOfNode(node: SceneNode): string {
  if (node.type === "TEXT") return node.characters.trim();
  if (!("findAll" in node)) return "";
  const textNodes = node.findAll((child) => child.type === "TEXT") as TextNode[];
  return textNodes
    .sort((a, b) => {
      const aPos = absolutePosition(a);
      const bPos = absolutePosition(b);
      return (aPos.y - bPos.y) || (aPos.x - bPos.x);
    })
    .map((textNode) => textNode.characters.trim())
    .filter(Boolean)
    .join("\n");
}

function absolutePosition(node: BaseNode): { x:number; y:number } {
  let x = 0;
  let y = 0;
  let current: BaseNode|null = node;
  while (current && current.type !== "PAGE") {
    if ("x" in current && typeof current.x === "number") x += current.x;
    if ("y" in current && typeof current.y === "number") y += current.y;
    current = current.parent;
  }
  return { x, y };
}

interface NodeBounds { x:number; y:number; width:number; height:number }

function absoluteBounds(node: SceneNode): NodeBounds|null {
  if (!("width" in node) || !("height" in node)) return null;
  const pos = absolutePosition(node);
  return { x:pos.x, y:pos.y, width:node.width, height:node.height };
}

function centerInsideBounds(node: SceneNode, bounds: NodeBounds, pad=2): boolean {
  const nodeBounds = absoluteBounds(node);
  if (!nodeBounds) return false;
  const cx = nodeBounds.x + nodeBounds.width / 2;
  const cy = nodeBounds.y + nodeBounds.height / 2;
  return (
    cx >= bounds.x - pad &&
    cx <= bounds.x + bounds.width + pad &&
    cy >= bounds.y - pad &&
    cy <= bounds.y + bounds.height + pad
  );
}

function collectSceneNodes(root: BaseNode|null): SceneNode[] {
  const result: SceneNode[] = [];
  if (!root || !("children" in root)) return result;
  const visit = (node: SceneNode): void => {
    result.push(node);
    if ("children" in node) {
      for (const child of node.children) visit(child);
    }
  };
  for (const child of root.children) {
    if (child.type !== "PAGE") visit(child as SceneNode);
  }
  return result;
}

function tableScopeNodes(node: SceneNode): SceneNode[] {
  const scope = node.parent && "children" in node.parent ? node.parent : node;
  return collectSceneNodes(scope);
}

function textNodesInsideBounds(scopeNodes: SceneNode[], bounds: NodeBounds): TextNode[] {
  return scopeNodes
    .filter((node): node is TextNode => node.type === "TEXT" && centerInsideBounds(node, bounds, 4))
    .sort((a, b) => {
      const aPos = absolutePosition(a);
      const bPos = absolutePosition(b);
      return (aPos.y - bPos.y) || (aPos.x - bPos.x);
    });
}

function textFromBounds(scopeNodes: SceneNode[], bounds: NodeBounds): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const node of textNodesInsideBounds(scopeNodes, bounds)) {
    const value = node.characters.trim();
    if (!value) continue;
    const pos = absolutePosition(node);
    const key = `${Math.round(pos.x)}:${Math.round(pos.y)}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(value);
  }
  return parts.join("\n");
}

function countDescendants(node: SceneNode, predicate: (child: SceneNode) => boolean, limit=80): number {
  if (!("children" in node)) return 0;
  let count = 0;
  const visit = (child: SceneNode): void => {
    if (count >= limit) return;
    if (predicate(child)) count++;
    if ("children" in child) {
      for (const nested of child.children) visit(nested);
    }
  };
  for (const child of node.children) visit(child);
  return count;
}

function tableCellContainersInBounds(node: SceneNode, prefix: "th"|"td"): SceneNode[] {
  const bounds = absoluteBounds(node);
  if (!bounds) return [];
  return tableScopeNodes(node)
    .filter((candidate) => {
      if (candidate.id === node.id) return false;
      const lower = candidate.name.toLowerCase();
      return lower.startsWith(prefix) && centerInsideBounds(candidate, bounds, 4);
    })
    .sort((a, b) => {
      const aPos = absolutePosition(a);
      const bPos = absolutePosition(b);
      return (aPos.y - bPos.y) || (aPos.x - bPos.x);
    });
}

function hasTableCellsWithinBounds(node: SceneNode): boolean {
  return tableCellContainersInBounds(node, "th").length >= 3 && tableCellContainersInBounds(node, "td").length >= 6;
}

function hasTableStructure(node: SceneNode): boolean {
  if (!("width" in node) || !("height" in node)) return false;
  if (node.width < 420 || node.height < 120) return false;
  const lower = node.name.toLowerCase();
  const tableishName =
    lower.includes("table") ||
    lower.includes("tbody") ||
    lower.includes("thead") ||
    lower.includes("overflow-auto") ||
    (lower.includes("border") && lower.includes("bg-"));
  if (!tableishName) return false;
  if (hasTableCellsWithinBounds(node)) return true;
  if (!("children" in node)) return false;
  const headerCount = countDescendants(node, (child) => child.name.toLowerCase().startsWith("th"), 12);
  const cellCount = countDescendants(node, (child) => child.name.toLowerCase().startsWith("td"), 24);
  const rowCount = countDescendants(node, (child) => child.name.toLowerCase().startsWith("tr"), 16);
  return headerCount >= 3 && (cellCount >= 6 || rowCount >= 2);
}

function inferTablePropsFromNode(node: SceneNode): ComponentProps|undefined {
  const scopeNodes = tableScopeNodes(node);
  let cells = [...tableCellContainersInBounds(node, "th"), ...tableCellContainersInBounds(node, "td")];
  if (cells.length === 0 && "findAll" in node) {
    cells = node.findAll((child) => {
      const lower = child.name.toLowerCase();
      return lower.startsWith("th") || lower.startsWith("td");
    }) as SceneNode[];
  }
  if (cells.length === 0) return undefined;

  const headerCells = cells.filter((cell) => cell.name.toLowerCase().startsWith("th"));
  const bodyCells = cells.filter((cell) => cell.name.toLowerCase().startsWith("td"));
  const headers = headerCells
    .sort((a, b) => {
      const aPos = absolutePosition(a);
      const bPos = absolutePosition(b);
      return (aPos.y - bPos.y) || (aPos.x - bPos.x);
    })
    .map((cell) => {
      const direct = textContentOfNode(cell);
      const bounds = absoluteBounds(cell);
      return direct || (bounds ? textFromBounds(scopeNodes, bounds) : "");
    })
    .filter(Boolean);

  const groups: Array<{ y:number; cells: SceneNode[] }> = [];
  for (const cell of bodyCells.sort((a, b) => {
    const aPos = absolutePosition(a);
    const bPos = absolutePosition(b);
    return (aPos.y - bPos.y) || (aPos.x - bPos.x);
  })) {
    const cellPos = absolutePosition(cell);
    let group = groups.find((candidate) => Math.abs(candidate.y - cellPos.y) < 18);
    if (!group) {
      group = { y:cellPos.y, cells:[] };
      groups.push(group);
    }
    group.cells.push(cell);
  }
  const rows = groups.map((group) =>
    group.cells
      .sort((a, b) => absolutePosition(a).x - absolutePosition(b).x)
      .map((cell) => {
        const direct = textContentOfNode(cell);
        const bounds = absoluteBounds(cell);
        return direct || (bounds ? textFromBounds(scopeNodes, bounds) : "");
      })
      .filter(Boolean)
  );

  const props: ComponentProps = {};
  const headerSlice = headers.slice(0, 7);
  const rowSlice = rows.slice(0, 12).map((row) => row.slice(0, 9));
  if (isShelterTableHeaders(headerSlice)) {
    props.tableKind = "shelters";
    props.headers = JSON.stringify(SHELTER_TABLE_HEADERS);
    if (rowSlice.length) props.rows = JSON.stringify(normalizeShelterTableRows(rowSlice));
  } else {
    if (headerSlice.length) props.headers = JSON.stringify(headerSlice);
    if (rowSlice.length) props.rows = JSON.stringify(rowSlice.map((row) => row.slice(0, 7)));
  }
  return Object.keys(props).length > 0 ? props : undefined;
}

function inferTabBarPropsFromNode(node: SceneNode): ComponentProps|undefined {
  const lines = textContentOfNode(node)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const labels: string[] = [];
  const counts: number[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower === "розділи" || lower.includes("оберіть вкладку")) continue;
    if (/^\d+$/.test(line)) {
      counts.push(Number(line));
      continue;
    }
    if (!labels.includes(line)) labels.push(line);
  }
  if (labels.length === 0) return undefined;
  const props: ComponentProps = {
    tabs:JSON.stringify(labels.slice(0, DEFAULT_TAB_LABELS.length)),
    activeIndex:"1",
  };
  if (counts.length > 0) props.counts = JSON.stringify(counts.slice(0, DEFAULT_TAB_LABELS.length));
  return props;
}

function inferComponentPropsFromNode(node: SceneNode, key: string): ComponentProps|undefined {
  if (key === "Data/Table" || key === "Data/Table/Shelters") return inferTablePropsFromNode(node);
  if (key === "Data/InfoTable") {
    return { title:"Системна інформація", fields:JSON.stringify(DEFAULT_INFO_TABLE_FIELDS) };
  }
  if (key === "Form/RequestBasics") {
    return { title:"Крок 1 з 9 — Основні параметри", fields:JSON.stringify(DEFAULT_FORM_FIELDS) };
  }
  if (key === "Navigation/TabBar") return inferTabBarPropsFromNode(node);
  if (key === "Navigation/SegmentedTabs") return { tabs:JSON.stringify(["2D", "3D"]), activeIndex:"1" };
  return undefined;
}

function hasTabBarStructure(node: SceneNode): boolean {
  if (!("width" in node) || !("height" in node)) return false;
  if (node.width < 180 || node.height < 120) return false;
  const lower = node.name.toLowerCase();
  if (lower.includes("tabbar") || lower.includes("tab-bar") || lower.includes("tabnav") || lower === "tabs") return true;
  const textContent = textContentOfNode(node).toLowerCase();
  if (!textContent) return false;
  const tabSignals = [
    "розділи",
    "оберіть вкладку",
    "основні параметри",
    "характеристики",
    "документи",
    "фінанси",
    "медіа",
  ];
  return tabSignals.filter((signal) => textContent.includes(signal)).length >= 3;
}

function hasSegmentedTabsStructure(node: SceneNode): boolean {
  if (!("width" in node) || !("height" in node)) return false;
  if (node.width < 100 || node.width > 360 || node.height < 34 || node.height > 96) return false;
  const lower = node.name.toLowerCase();
  const textContent = textContentOfNode(node).toLowerCase();
  return lower.includes("segmented") || lower.includes("viewmode") || (textContent.includes("2d") && textContent.includes("3d"));
}

function hasInfoTableStructure(node: SceneNode): boolean {
  if (!("width" in node) || !("height" in node)) return false;
  if (node.width < 520 || node.height < 220) return false;
  const textContent = textContentOfNode(node).toLowerCase();
  const signals = [
    "системна інформація",
    "обліковий номер",
    "тимчасовий номер",
    "технічний номер",
    "статус обліку",
    "відповідальний",
  ];
  return signals.filter((signal) => textContent.includes(signal)).length >= 3;
}

function hasRequestBasicsFormStructure(node: SceneNode): boolean {
  if (!("width" in node) || !("height" in node)) return false;
  if (node.width < 520 || node.height < 320) return false;
  const textContent = textContentOfNode(node).toLowerCase();
  const signals = [
    "крок 1",
    "основні параметри",
    "обліковий номер",
    "тимчасовий номер",
    "тип доступу",
    "стан запису",
  ];
  return signals.filter((signal) => textContent.includes(signal)).length >= 3;
}

function isTableFragmentNode(node: SceneNode): boolean {
  const lower = node.name.toLowerCase();
  return (
    node.type === "TEXT" ||
    lower.startsWith("th") ||
    lower.startsWith("td") ||
    lower.startsWith("tr") ||
    lower.startsWith("thead") ||
    lower.startsWith("tbody") ||
    lower.startsWith("table")
  );
}

function removeTableFragmentsAround(source: SceneNode, replacement: SceneNode): void {
  const bounds = absoluteBounds(source);
  const parent = source.parent;
  if (!bounds || !parent || !("children" in parent)) return;
  for (const child of [...parent.children]) {
    if (child.id === source.id || child.id === replacement.id) continue;
    if (!centerInsideBounds(child, bounds, 4)) continue;
    if (!isTableFragmentNode(child)) continue;
    try { child.remove(); } catch (_) {}
  }
}

function inferComponentKeyFromNode(node: SceneNode): string|null {
  const stored = node.getSharedPluginData(MT_NS, MT_SOURCE_COMPONENT_KEY);
  if (stored) return stored;

  const lower = node.name.toLowerCase();
  if (lower.includes("dialog") || lower.includes("modal")) return "Dialog/ValidationWarning";
  if (lower.startsWith("icon/")) return node.name;
  if (hasSegmentedTabsStructure(node)) return "Navigation/SegmentedTabs";
  if (hasTabBarStructure(node)) return "Navigation/TabBar";
  if (hasInfoTableStructure(node)) return "Data/InfoTable";
  if (hasRequestBasicsFormStructure(node)) return "Form/RequestBasics";
  if (hasTableStructure(node)) return "Data/Table";
  if (lower.startsWith("th")) return "Data/TableCell/header";
  if (lower.startsWith("td")) return "Data/TableCell/text";
  if (lower.startsWith("tr")) return "Data/TableRow/default";
  if (lower.includes("search")) return "Form/Search/default";
  if (lower.includes("textarea")) return "Form/Textarea/default";
  if (lower.includes("select")) return "Form/Select/default";
  if (lower.includes("input")) return "Form/Input/default";

  if (lower.startsWith("button") || lower.includes(" button")) {
    let variant = "secondary";
    const fills = "fills" in node ? node.fills : figma.mixed;
    if (fills !== figma.mixed && Array.isArray(fills)) {
      const solid = fills.find((fill): fill is SolidPaint => fill.type === "SOLID");
      if (solid) {
        const hex = rgbToHex(solid.color);
        if (hex === "#00e5a0") variant = "primary";
        else if (hex === "#ff6b6b") variant = "danger";
        else if ((solid.opacity ?? 1) < 0.02) variant = "outline";
      }
    }
    return `Button/${variant}/md`;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════════════════════

function runImport() {
  figma.showUI(__html__, { width: 356, height: 640, title: "Migra Thor → Figma Import" });

  const loadedFontsI = new Set<string>();

  async function loadFontI(family: string, weight: number): Promise<FontName> {
    const style = weight >= 700 ? "Bold" : weight >= 600 ? "SemiBold" : weight >= 500 ? "Medium" : "Regular";
    const candidates: FontName[] = [{ family, style }, { family:"Inter", style }, { family:"Inter", style:"Regular" }];
    for (const font of candidates) {
      const key = `${font.family}:${font.style}`;
      if (loadedFontsI.has(key)) return font;
      try { await figma.loadFontAsync(font); loadedFontsI.add(key); return font; } catch (_) {}
    }
    return { family:"Inter", style:"Regular" };
  }

  function applyFills(node: GeometryMixin, fills: IFill[]) {
    node.fills = fills.map(f => ({ type:"SOLID" as const, color:f.color, opacity:f.opacity }));
  }
  function applyStrokes(node: GeometryMixin & MinimalStrokesMixin, strokes: IStroke[], weight: number) {
    if (strokes.length > 0) {
      node.strokes = strokes.map(s => ({ type:"SOLID" as const, color:s.color, opacity:s.opacity }));
      node.strokeWeight = weight;
      node.strokeAlign = "INSIDE";
    }
  }

  function decodeBase64(base64: string): Uint8Array {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const cleaned = base64.replace(/[\r\n\s=]/g, "");
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const char of cleaned) {
      const value = alphabet.indexOf(char);
      if (value < 0) continue;
      buffer = (buffer << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 0xff);
      }
    }
    return new Uint8Array(bytes);
  }

  function imageBytesFromDataUrl(dataUrl: string): Uint8Array {
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return decodeBase64(base64);
  }

  function makeFallbackFill(): IFill[] {
    return [{ type:"SOLID", color:{ r:0.95, g:0.96, b:0.98 }, opacity:1 }];
  }

  async function buildNode(layer: ILayer): Promise<SceneNode|null> {
    if (layer.width < 1 || layer.height < 1) return null;
    const hint = getLayerComponentHint(layer);
    if (hint) {
      const instance = await createRegistryInstance(hint.key, hint.props, layer.width, layer.height, layer.opacity);
      if (instance) return instance;
    }

    const annotate = <T extends SceneNode>(node: T): T => {
      if (hint) {
        node.setSharedPluginData(MT_NS, MT_SOURCE_COMPONENT_KEY, hint.key);
        if (hint.props && Object.keys(hint.props).length > 0) {
          node.setSharedPluginData(MT_NS, MT_COMPONENT_PROPS_KEY, JSON.stringify(hint.props));
        }
      }
      return node;
    };

    if (layer.type === "TEXT") {
      const node = figma.createText();
      node.name = layer.name;
      const fontName = await loadFontI(layer.fontFamily || "Inter", layer.fontWeight || 400);
      node.fontName = fontName;
      node.fontSize = layer.fontSize || 14;
      node.characters = layer.characters || "";
      if (layer.letterSpacing != null) node.letterSpacing = { value:layer.letterSpacing, unit:"PIXELS" };
      if (layer.lineHeight != null && layer.lineHeight > 0) node.lineHeight = { value:layer.lineHeight, unit:"PIXELS" };
      if (layer.textColor) node.fills = [{ type:"SOLID", color:layer.textColor, opacity:1 }];
      node.opacity = layer.opacity;
      // Constrain text to DOM-measured width so it doesn't overflow its parent frame
      node.textAutoResize = "HEIGHT";
      node.resize(Math.max(layer.width, 1), Math.max(layer.height, 1));
      // x/y set by parent after appendChild
      return annotate(node);
    }
    if (layer.type === "RECTANGLE") {
      const node = figma.createRectangle();
      node.name = layer.name;
      node.resize(layer.width, layer.height);
      node.cornerRadius = layer.cornerRadius; node.opacity = layer.opacity;
      applyFills(node, layer.fills);
      applyStrokes(node, layer.strokes, layer.strokeWeight);
      return annotate(node);
    }
    if (layer.type === "IMAGE") {
      const node = figma.createRectangle();
      node.name = layer.name;
      node.resize(layer.width, layer.height);
      node.cornerRadius = layer.cornerRadius; node.opacity = layer.opacity;
      if (layer.imageData) {
        try {
          const image = figma.createImage(imageBytesFromDataUrl(layer.imageData));
          node.fills = [{ type:"IMAGE", scaleMode:"FILL", imageHash:image.hash }];
        } catch (_) {
          applyFills(node, layer.fills.length > 0 ? layer.fills : makeFallbackFill());
        }
      } else {
        applyFills(node, layer.fills.length > 0 ? layer.fills : makeFallbackFill());
      }
      applyStrokes(node, layer.strokes, layer.strokeWeight);
      return annotate(node);
    }
    if (layer.type === "SVG" && layer.svg) {
      try {
        const node = figma.createNodeFromSvg(layer.svg);
        node.name = layer.name;
        node.resize(layer.width, layer.height);
        node.opacity = layer.opacity;
        return annotate(node);
      } catch (_) {
        const fallback = figma.createRectangle();
        fallback.name = layer.name;
        fallback.resize(layer.width, layer.height);
        fallback.cornerRadius = layer.cornerRadius; fallback.opacity = layer.opacity;
        applyFills(fallback, layer.fills.length > 0 ? layer.fills : makeFallbackFill());
        applyStrokes(fallback, layer.strokes, layer.strokeWeight);
        return annotate(fallback);
      }
    }
    const node = figma.createFrame();
    node.name = layer.name;
    node.resize(layer.width, layer.height);
    node.cornerRadius = layer.cornerRadius; node.opacity = layer.opacity;
    // Only clip if the frame has a visible fill OR explicit overflow:hidden — transparent wrappers must not clip
    node.clipsContent = layer.fills.some(f => f.opacity > 0) || !!layer.overflow;
    applyFills(node, layer.fills.length > 0 ? layer.fills : [{ type:"SOLID", color:{r:1,g:1,b:1}, opacity:0 }]);
    applyStrokes(node, layer.strokes, layer.strokeWeight);
    if (layer.children) {
      for (const child of layer.children) {
        const childNode = await buildNode(child);
        if (childNode) {
          node.appendChild(childNode);
          // Set position AFTER append so coords are relative to this parent frame
          childNode.x = child.x;
          childNode.y = child.y;
        }
      }
    }
    return annotate(node);
  }

  async function importLayers(data: IExport): Promise<number> {
    await figma.loadFontAsync({ family:"Inter", style:"Regular" });
    await figma.loadFontAsync({ family:"Inter", style:"Medium" });
    try { await figma.loadFontAsync({ family:"Inter", style:"SemiBold" }); } catch(_){}
    const root = await buildNode(data.root);
    if (!root) throw new Error("Failed to build root node");
    await safeBindNodeToTokenVariables(root);
    root.name = data.title || "Imported Screen";
    const existing = figma.currentPage.children;
    const maxX = existing.reduce((m,n) => Math.max(m, n.x + ("width" in n ? (n as {width:number}).width : 0)), 0);
    root.x = maxX > 0 ? maxX + 80 : 0; root.y = 0;
    figma.currentPage.appendChild(root);
    figma.currentPage.selection = [root];
    figma.viewport.scrollAndZoomIntoView([root]);
    return countI(data.root);
  }

  function countI(layer: ILayer): number {
    return 1 + (layer.children || []).reduce((s,c) => s + countI(c), 0);
  }

  figma.ui.onmessage = async (msg) => {
    if (msg.type !== "import") return;
    try {
      const count = await importLayers(msg.data as IExport);
      figma.ui.postMessage({ type:"done", count });
      figma.notify(`Імпортовано — ${count} шарів`, { timeout:4000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      figma.ui.postMessage({ type:"error", message });
      figma.notify(message, { error:true });
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════

async function runDesignSystem(): Promise<void> {
  const TOKENS: Record<string, ColorToken> = {
    "bg/base":       { hex:"#0a0b0e", group:"Background" },
    "bg/surface":    { hex:"#111318", group:"Background" },
    "bg/surface-2":  { hex:"#1a1d26", group:"Background" },
    "bg/overlay":    { hex:"#111318", group:"Background", opacity:0.95 },
    "hover/md":      { hex:"#ffffff", group:"State", opacity:0.04 },
    "hover/strong":  { hex:"#ffffff", group:"State", opacity:0.06 },
    "text/primary":  { hex:"#f0f2f8", group:"Text" },
    "text/secondary":{ hex:"#8892a4", group:"Text" },
    "text/muted":    { hex:"#4a5568", group:"Text" },
    "text/ghost":    { hex:"#2d3748", group:"Text" },
    "border":        { hex:"#ffffff", group:"Border", opacity:0.06 },
    "border/strong": { hex:"#ffffff", group:"Border", opacity:0.08 },
    "border/hover":  { hex:"#ffffff", group:"Border", opacity:0.14 },
    "ring":          { hex:"#ffffff", group:"Border", opacity:0.06 },
    "accent":        { hex:"#00e5a0", group:"Brand" },
    "accent/10":     { hex:"#00e5a0", group:"Brand", opacity:0.10 },
    "accent/15":     { hex:"#00e5a0", group:"Brand", opacity:0.15 },
    "accent/25":     { hex:"#00e5a0", group:"Brand", opacity:0.25 },
    "purple":        { hex:"#6c63ff", group:"Brand" },
    "blue":          { hex:"#60a5fa", group:"Status" },
    "amber":         { hex:"#f59e0b", group:"Status" },
    "red":           { hex:"#ff6b6b", group:"Status" },
  };

  const LIGHT_TOKENS: Record<string, ColorToken> = {
    "bg/base":       { hex:"#f6f8fb", group:"Background" },
    "bg/surface":    { hex:"#ffffff", group:"Background" },
    "bg/surface-2":  { hex:"#eef2f7", group:"Background" },
    "bg/overlay":    { hex:"#ffffff", group:"Background", opacity:0.96 },
    "hover/md":      { hex:"#101828", group:"State", opacity:0.04 },
    "hover/strong":  { hex:"#101828", group:"State", opacity:0.07 },
    "text/primary":  { hex:"#101828", group:"Text" },
    "text/secondary":{ hex:"#475467", group:"Text" },
    "text/muted":    { hex:"#667085", group:"Text" },
    "text/ghost":    { hex:"#98a2b3", group:"Text" },
    "border":        { hex:"#101828", group:"Border", opacity:0.08 },
    "border/strong": { hex:"#101828", group:"Border", opacity:0.12 },
    "border/hover":  { hex:"#101828", group:"Border", opacity:0.18 },
    "ring":          { hex:"#00a876", group:"Border", opacity:0.28 },
    "accent":        { hex:"#00a876", group:"Brand" },
    "accent/10":     { hex:"#00a876", group:"Brand", opacity:0.10 },
    "accent/15":     { hex:"#00a876", group:"Brand", opacity:0.15 },
    "accent/25":     { hex:"#00a876", group:"Brand", opacity:0.25 },
    "purple":        { hex:"#5b55d6", group:"Brand" },
    "blue":          { hex:"#2563eb", group:"Status" },
    "amber":         { hex:"#b45309", group:"Status" },
    "red":           { hex:"#dc2626", group:"Status" },
  };

  const LUCIDE_ICON_SVGS: Record<string, string> = {
    "Activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\" />",
    "AlertCircle": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\" /><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\" />",
    "AlertTriangle": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /><path d=\"M12 9v4\" /><path d=\"M12 17h.01\" />",
    "ArrowLeft": "<path d=\"m12 19-7-7 7-7\" /><path d=\"M19 12H5\" />",
    "BarChart2": "<line x1=\"18\" x2=\"18\" y1=\"20\" y2=\"10\" /><line x1=\"12\" x2=\"12\" y1=\"20\" y2=\"4\" /><line x1=\"6\" x2=\"6\" y1=\"20\" y2=\"14\" />",
    "BarChart3": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /><path d=\"M18 17V9\" /><path d=\"M13 17V5\" /><path d=\"M8 17v-3\" />",
    "Bell": "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\" /><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\" />",
    "Bookmark": "<path d=\"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z\" />",
    "Box": "<path d=\"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z\" /><path d=\"m3.3 7 8.7 5 8.7-5\" /><path d=\"M12 22V12\" />",
    "Building2": "<path d=\"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z\" /><path d=\"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2\" /><path d=\"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2\" /><path d=\"M10 6h4\" /><path d=\"M10 10h4\" /><path d=\"M10 14h4\" /><path d=\"M10 18h4\" />",
    "CalendarDays": "<path d=\"M8 2v4\" /><path d=\"M16 2v4\" /><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" /><path d=\"M3 10h18\" /><path d=\"M8 14h.01\" /><path d=\"M12 14h.01\" /><path d=\"M16 14h.01\" /><path d=\"M8 18h.01\" /><path d=\"M12 18h.01\" /><path d=\"M16 18h.01\" />",
    "Check": "<path d=\"M20 6 9 17l-5-5\" />",
    "CheckCircle": "<path d=\"M21.801 10A10 10 0 1 1 17 3.335\" /><path d=\"m9 11 3 3L22 4\" />",
    "ChevronDown": "<path d=\"m6 9 6 6 6-6\" />",
    "ChevronRight": "<path d=\"m9 18 6-6-6-6\" />",
    "ChevronsUpDown": "<path d=\"m7 15 5 5 5-5\" /><path d=\"m7 9 5-5 5 5\" />",
    "ChevronUp": "<path d=\"m18 15-6-6-6 6\" />",
    "ClipboardCheck": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /><path d=\"m9 14 2 2 4-4\" />",
    "ClipboardCopy": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /><path d=\"M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2\" /><path d=\"M16 4h2a2 2 0 0 1 2 2v4\" /><path d=\"M21 14H11\" /><path d=\"m15 10-4 4 4 4\" />",
    "ClipboardList": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /><path d=\"M12 11h4\" /><path d=\"M12 16h4\" /><path d=\"M8 11h.01\" /><path d=\"M8 16h.01\" />",
    "Copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />",
    "Database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" /><path d=\"M3 5V19A9 3 0 0 0 21 19V5\" /><path d=\"M3 12A9 3 0 0 0 21 12\" />",
    "Download": "<path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" />",
    "Edit2": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" />",
    "ExternalLink": "<path d=\"M15 3h6v6\" /><path d=\"M10 14 21 3\" /><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\" />",
    "FileBarChart": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /><path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /><path d=\"M8 18v-2\" /><path d=\"M12 18v-4\" /><path d=\"M16 18v-6\" />",
    "FileText": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /><path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /><path d=\"M10 9H8\" /><path d=\"M16 13H8\" /><path d=\"M16 17H8\" />",
    "FileX": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /><path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /><path d=\"m14.5 12.5-5 5\" /><path d=\"m9.5 12.5 5 5\" />",
    "Filter": "<path d=\"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z\" />",
    "Flame": "<path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\" />",
    "Globe2": "<path d=\"M21.54 15H17a2 2 0 0 0-2 2v4.54\" /><path d=\"M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17\" /><path d=\"M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05\" /><circle cx=\"12\" cy=\"12\" r=\"10\" />",
    "HandHeart": "<path d=\"M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16\" /><path d=\"m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95\" /><path d=\"m2 15 6 6\" /><path d=\"m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91\" />",
    "HelpCircle": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\" /><path d=\"M12 17h.01\" />",
    "Home": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" /><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />",
    "Info": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" />",
    "LayoutDashboard": "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" />",
    "List": "<path d=\"M3 12h.01\" /><path d=\"M3 18h.01\" /><path d=\"M3 6h.01\" /><path d=\"M8 12h13\" /><path d=\"M8 18h13\" /><path d=\"M8 6h13\" />",
    "Loader2": "<path d=\"M21 12a9 9 0 1 1-6.219-8.56\" />",
    "LocateFixed": "<line x1=\"2\" x2=\"5\" y1=\"12\" y2=\"12\" /><line x1=\"19\" x2=\"22\" y1=\"12\" y2=\"12\" /><line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"5\" /><line x1=\"12\" x2=\"12\" y1=\"19\" y2=\"22\" /><circle cx=\"12\" cy=\"12\" r=\"7\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
    "LogOut": "<path d=\"m16 17 5-5-5-5\" /><path d=\"M21 12H9\" /><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" />",
    "Map": "<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\" /><path d=\"M15 5.764v15\" /><path d=\"M9 3.236v15\" />",
    "MapPinned": "<path d=\"M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0\" /><circle cx=\"12\" cy=\"8\" r=\"2\" /><path d=\"M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712\" />",
    "Minus": "<path d=\"M5 12h14\" />",
    "Moon": "<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\" />",
    "Plus": "<path d=\"M5 12h14\" /><path d=\"M12 5v14\" />",
    "RefreshCw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" />",
    "RotateCcw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /><path d=\"M3 3v5h5\" />",
    "Search": "<path d=\"m21 21-4.34-4.34\" /><circle cx=\"11\" cy=\"11\" r=\"8\" />",
    "Settings": "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
    "Shield": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" />",
    "ShieldCheck": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /><path d=\"m9 12 2 2 4-4\" />",
    "Sparkles": "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" /><path d=\"M20 2v4\" /><path d=\"M22 4h-4\" /><circle cx=\"4\" cy=\"20\" r=\"2\" />",
    "Sun": "<circle cx=\"12\" cy=\"12\" r=\"4\" /><path d=\"M12 2v2\" /><path d=\"M12 20v2\" /><path d=\"m4.93 4.93 1.41 1.41\" /><path d=\"m17.66 17.66 1.41 1.41\" /><path d=\"M2 12h2\" /><path d=\"M20 12h2\" /><path d=\"m6.34 17.66-1.41 1.41\" /><path d=\"m19.07 4.93-1.41 1.41\" />",
    "TrendingDown": "<path d=\"M16 17h6v-6\" /><path d=\"m22 17-8.5-8.5-5 5L2 7\" />",
    "TrendingUp": "<path d=\"M16 7h6v6\" /><path d=\"m22 7-8.5 8.5-5-5L2 17\" />",
    "TriangleAlert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /><path d=\"M12 9v4\" /><path d=\"M12 17h.01\" />",
    "Users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /><path d=\"M16 3.128a4 4 0 0 1 0 7.744\" /><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" /><circle cx=\"9\" cy=\"7\" r=\"4\" />",
    "UsersRound": "<path d=\"M18 21a8 8 0 0 0-16 0\" /><circle cx=\"10\" cy=\"8\" r=\"5\" /><path d=\"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3\" />",
    "X": "<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />",
  };

  const ICON_NAMES = Object.keys(LUCIDE_ICON_SVGS).sort((a, b) => a.localeCompare(b));

  const loadedFonts = new Set<string>();

  function hexRGB(hex: string): RGB {
    const c = hex.replace("#", "");
    return {
      r: parseInt(c.slice(0, 2), 16) / 255,
      g: parseInt(c.slice(2, 4), 16) / 255,
      b: parseInt(c.slice(4, 6), 16) / 255,
    };
  }

  function paint(hex: string, opacity=1): SolidPaint {
    return { type:"SOLID", color:hexRGB(hex), opacity };
  }

  function token(name: string): SolidPaint {
    const value = TOKENS[name];
    return paint(value.hex, value.opacity ?? 1);
  }

  function tokenPaint(value: ColorToken): SolidPaint {
    return paint(value.hex, value.opacity ?? 1);
  }

  function stroke(name="border"): SolidPaint {
    return token(name);
  }

  async function loadFont(style: string): Promise<FontName> {
    const styles = style === "SemiBold" ? ["SemiBold", "Semi Bold"] : [style];
    const candidates: FontName[] = [];
    for (const candidateStyle of styles) {
      candidates.push({ family:"Geist", style:candidateStyle });
      candidates.push({ family:"Inter", style:candidateStyle });
    }
    candidates.push({ family:"Inter", style:"Regular" });

    for (const candidate of candidates) {
      const key = `${candidate.family}:${candidate.style}`;
      if (loadedFonts.has(key)) return candidate;
      try {
        await figma.loadFontAsync(candidate);
        loadedFonts.add(key);
        return candidate;
      } catch (_) {}
    }
    return { family:"Inter", style:"Regular" };
  }

  async function preload(): Promise<void> {
    for (const style of ["Regular", "Medium", "SemiBold", "Bold"]) {
      await loadFont(style);
    }
  }

  function frame(name: string, w: number, h: number, fillNameOrHex=""): FrameNode {
    const node = figma.createFrame();
    node.name = name;
    node.resize(w, h);
    node.fills = fillNameOrHex ? [fillNameOrHex.startsWith("#") ? paint(fillNameOrHex) : token(fillNameOrHex)] : [];
    node.clipsContent = false;
    return node;
  }

  function component(name: string, w: number, h: number, fillNameOrHex=""): ComponentNode {
    const node = figma.createFrame();
    node.name = name;
    node.resize(w, h);
    node.fills = fillNameOrHex ? [fillNameOrHex.startsWith("#") ? paint(fillNameOrHex) : token(fillNameOrHex)] : [];
    node.clipsContent = false;
    return node as unknown as ComponentNode;
  }

  function rect(name: string, w: number, h: number, fillNameOrHex: string, radius=0): RectangleNode {
    const node = figma.createRectangle();
    node.name = name;
    node.resize(w, h);
    node.fills = [fillNameOrHex.startsWith("#") ? paint(fillNameOrHex) : token(fillNameOrHex)];
    node.cornerRadius = radius;
    return node;
  }

  function ellipse(name: string, w: number, h: number, fillNameOrHex: string): EllipseNode {
    const node = figma.createEllipse();
    node.name = name;
    node.resize(w, h);
    node.fills = [fillNameOrHex.startsWith("#") ? paint(fillNameOrHex) : token(fillNameOrHex)];
    return node;
  }

  async function text(
    content: string,
    size: number,
    style: string,
    colorNameOrHex: string,
    opts: { lh?:number; align?:"LEFT"|"CENTER"|"RIGHT"; mono?:boolean; width?:number } = {},
  ): Promise<TextNode> {
    const node = figma.createText();
    const fontName = opts.mono ? { family:"Courier New", style:"Regular" } : await loadFont(style);
    if (opts.mono) {
      try { await figma.loadFontAsync(fontName); } catch (_) {}
    }
    try { node.fontName = fontName; } catch (_) { node.fontName = { family:"Inter", style:"Regular" }; }
    node.fontSize = size;
    node.characters = content;
    node.fills = [colorNameOrHex.startsWith("#") ? paint(colorNameOrHex) : token(colorNameOrHex)];
    node.letterSpacing = { value:0, unit:"PIXELS" };
    if (opts.lh) node.lineHeight = { value:opts.lh, unit:"PIXELS" };
    if (opts.align) node.textAlignHorizontal = opts.align;
    if (opts.width) {
      node.textAutoResize = "HEIGHT";
      node.resize(opts.width, Math.max(node.height, opts.lh ?? size * 1.35));
    }
    return node;
  }

  function add(parent: ChildrenMixin, node: SceneNode, x: number, y: number): void {
    parent.appendChild(node);
    node.x = x;
    node.y = y;
  }

  function divider(parent: FrameNode|ComponentNode, x: number, y: number, w: number): void {
    add(parent, rect("Divider", w, 1, "border", 0), x, y);
  }

  async function caption(parent: ChildrenMixin, label: string, x: number, y: number): Promise<void> {
    add(parent, await text(label, 10, "SemiBold", "text/muted", { lh:14 }), x, y);
  }

  async function sectionTitle(page: PageNode, title: string, x: number, y: number, subtitle=""): Promise<void> {
    add(page, await text(title, 18, "SemiBold", "text/primary", { lh:24 }), x, y);
    if (subtitle) add(page, await text(subtitle, 12, "Regular", "text/secondary", { lh:18, width:760 }), x, y + 28);
  }

  function lucideSvg(name: string, color="#f0f2f8"): string {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"`,
      `stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
      LUCIDE_ICON_SVGS[name] ?? "",
      "</svg>",
    ].join(" ");
  }

  function makeLucideIcon(name: string, color="#f0f2f8"): FrameNode {
    const node = figma.createNodeFromSvg(lucideSvg(name, color));
    node.name = `Icon/${name}`;
    node.resize(24, 24);
    node.clipsContent = false;
    return node;
  }

  async function makeIconTile(name: string): Promise<FrameNode> {
    const tile = frame(`Icon tile/${name}`, 132, 104, "bg/surface");
    tile.cornerRadius = 12;
    tile.strokes = [stroke("border")];
    tile.strokeWeight = 1;

    const well = frame("Icon well", 44, 44, "bg/surface-2");
    well.cornerRadius = 10;
    well.strokes = [stroke("border/strong")];
    well.strokeWeight = 1;
    add(tile, well, 44, 14);

    try {
      add(well, makeLucideIcon(name), 10, 10);
    } catch (_) {
      add(well, await text("?", 18, "Bold", "text/primary", { lh:22, align:"CENTER" }), 16, 10);
    }

    add(tile, await text(name, 11, "SemiBold", "text/primary", { lh:14, align:"CENTER", width:112 }), 10, 66);
    add(tile, await text("lucide-react", 9, "Regular", "text/muted", { lh:12, align:"CENTER", width:112 }), 10, 84);
    return tile;
  }

  function getOrCreateRegistryComponent(page: PageNode, key: string, w: number, h: number): ComponentNode {
    let node = findRegistryComponentOnPage(page, key);
    if (!node) node = figma.createComponent();
    if (node.parent !== page) page.appendChild(node);
    node.name = key;
    node.resize(w, h);
    node.setSharedPluginData(MT_NS, MT_COMPONENT_KEY, key);
    node.setSharedPluginData(MT_NS, "generatedBy", "design-system");
    node.clipsContent = false;
    for (const child of [...node.children]) child.remove();
    return node;
  }

  function placeRegistryComponent(page: PageNode, node: ComponentNode, x: number, y: number): void {
    finalizeRegistryComponentAutoLayout(node);
    if (node.parent !== page) page.appendChild(node);
    node.x = x;
    node.y = y;
  }

  function constrain(node: SceneNode, horizontal: ConstraintType, vertical: ConstraintType): void {
    try { (node as SceneNode & ConstraintMixin).constraints = { horizontal, vertical }; } catch (_) {}
  }

  function setAutoLayout(
    node: FrameNode|ComponentNode,
    mode: "HORIZONTAL"|"VERTICAL",
    itemSpacing=0,
    padding: { left?:number; right?:number; top?:number; bottom?:number } = {},
  ): void {
    node.layoutMode = mode;
    node.primaryAxisSizingMode = "FIXED";
    node.counterAxisSizingMode = "FIXED";
    node.primaryAxisAlignItems = "MIN";
    node.counterAxisAlignItems = mode === "HORIZONTAL" ? "CENTER" : "MIN";
    node.itemSpacing = itemSpacing;
    node.paddingLeft = padding.left ?? 0;
    node.paddingRight = padding.right ?? 0;
    node.paddingTop = padding.top ?? 0;
    node.paddingBottom = padding.bottom ?? 0;
  }

  function fillAutoLayoutChild(node: SceneNode): void {
    try { (node as SceneNode & AutoLayoutChildrenMixin).layoutGrow = 1; } catch (_) {}
  }

  function isAutoLayoutFrame(node: SceneNode): node is FrameNode|ComponentNode {
    return node.type === "FRAME" || node.type === "COMPONENT";
  }

  function shouldSkipAutoLayoutConversion(node: FrameNode|ComponentNode): boolean {
    if (node.type === "COMPONENT") return false;
    if (node.name.startsWith("Icon/")) return true;
    const children = "children" in node ? node.children : [];
    return children.length > 0 && children.every((child) => child.type === "VECTOR" || child.type === "BOOLEAN_OPERATION");
  }

  function nodeDepth(node: BaseNode): number {
    let depth = 0;
    let parent = node.parent;
    while (parent) {
      depth++;
      parent = parent.parent;
    }
    return depth;
  }

  function inferFallbackAutoLayoutMode(node: FrameNode|ComponentNode): "HORIZONTAL"|"VERTICAL" {
    if (node.children.length <= 1) return "HORIZONTAL";
    const children = Array.from(node.children);
    const ySpread = Math.max(...children.map((child) => child.y)) - Math.min(...children.map((child) => child.y));
    const xSpread = Math.max(...children.map((child) => child.x)) - Math.min(...children.map((child) => child.x));
    return xSpread > ySpread * 1.4 ? "HORIZONTAL" : "VERTICAL";
  }

  function applyInferredAutoLayout(node: FrameNode|ComponentNode, inferred: InferredAutoLayoutResult): boolean {
    if (inferred.layoutMode !== "HORIZONTAL" && inferred.layoutMode !== "VERTICAL") return false;
    const width = node.width;
    const height = node.height;
    try {
      node.layoutMode = inferred.layoutMode;
      node.layoutWrap = inferred.layoutWrap;
      node.primaryAxisSizingMode = "FIXED";
      node.counterAxisSizingMode = "FIXED";
      node.primaryAxisAlignItems = inferred.primaryAxisAlignItems;
      node.counterAxisAlignItems = inferred.counterAxisAlignItems;
      node.counterAxisAlignContent = inferred.counterAxisAlignContent;
      node.itemSpacing = Math.max(0, Math.round(inferred.itemSpacing));
      node.counterAxisSpacing = inferred.counterAxisSpacing === null ? null : Math.max(0, Math.round(inferred.counterAxisSpacing));
      node.paddingLeft = Math.max(0, Math.round(inferred.paddingLeft));
      node.paddingRight = Math.max(0, Math.round(inferred.paddingRight));
      node.paddingTop = Math.max(0, Math.round(inferred.paddingTop));
      node.paddingBottom = Math.max(0, Math.round(inferred.paddingBottom));
      node.itemReverseZIndex = inferred.itemReverseZIndex;
      node.strokesIncludedInLayout = true;
      node.resize(width, height);
      return true;
    } catch (_) {
      return false;
    }
  }

  function applyFallbackAutoLayout(node: FrameNode|ComponentNode): void {
    const width = node.width;
    const height = node.height;
    const childPositions = node.children.map((child) => ({ node:child, x:child.x, y:child.y }));
    try {
      setAutoLayout(node, inferFallbackAutoLayoutMode(node), 0);
      node.strokesIncludedInLayout = true;
      for (const child of childPositions) {
        try {
          (child.node as SceneNode & AutoLayoutChildrenMixin).layoutPositioning = "ABSOLUTE";
          child.node.x = child.x;
          child.node.y = child.y;
        } catch (_) {}
      }
      node.resize(width, height);
    } catch (_) {}
  }

  function ensureAutoLayout(node: FrameNode|ComponentNode): void {
    if (shouldSkipAutoLayoutConversion(node)) return;
    if (node.layoutMode !== "NONE") {
      node.primaryAxisSizingMode = "FIXED";
      node.counterAxisSizingMode = "FIXED";
      node.strokesIncludedInLayout = true;
      return;
    }
    const inferred = node.inferredAutoLayout;
    if (inferred && applyInferredAutoLayout(node, inferred)) return;
    applyFallbackAutoLayout(node);
  }

  function finalizeRegistryComponentAutoLayout(node: ComponentNode): void {
    const frames = node
      .findAll((child) => isAutoLayoutFrame(child) && !shouldSkipAutoLayoutConversion(child))
      .filter(isAutoLayoutFrame)
      .sort((a, b) => nodeDepth(b) - nodeDepth(a));
    for (const frameNode of frames) ensureAutoLayout(frameNode);
    ensureAutoLayout(node);
  }

  async function registryButton(
    page: PageNode,
    key: string,
    variant: "primary"|"secondary"|"outline"|"ghost"|"danger",
    size: "sm"|"md"|"lg"|"icon",
    state: "default"|"hover"|"active"|"disabled"|"loading",
    x: number,
    y: number,
  ): Promise<void> {
    const metrics = {
      sm: { w:112, h:28, fs:11, radius:8 },
      md: { w:136, h:32, fs:12, radius:10 },
      lg: { w:156, h:36, fs:13, radius:10 },
      icon: { w:28, h:28, fs:12, radius:8 },
    }[size];
    const node = getOrCreateRegistryComponent(page, key, metrics.w, metrics.h);
    const paddingX = size === "icon" ? 7 : size === "sm" ? 12 : size === "md" ? 14 : 16;
    const paddingY = size === "lg" ? 8 : 6;
    setAutoLayout(node, "HORIZONTAL", state === "loading" ? 8 : 0, {
      left:paddingX,
      right:paddingX,
      top:size === "icon" ? 7 : paddingY,
      bottom:size === "icon" ? 7 : paddingY,
    });
    node.primaryAxisAlignItems = "CENTER";
    node.counterAxisAlignItems = "CENTER";
    node.cornerRadius = metrics.radius;
    node.strokeWeight = variant === "ghost" ? 0 : 1;
    const disabled = state === "disabled";
    const stateOpacity = disabled ? 0.42 : 1;
    const fills: Record<typeof variant, Paint> = {
      primary: state === "hover" ? paint("#00e5a0", 0.9) : state === "active" ? paint("#00b57f") : token("accent"),
      secondary: state === "hover" || state === "active" ? token("hover/strong") : token("hover/md"),
      outline: state === "hover" || state === "active" ? token("hover/md") : token("bg/surface"),
      ghost: state === "hover" || state === "active" ? token("hover/md") : paint("#ffffff", 0),
      danger: paint("#ff6b6b", state === "hover" || state === "active" ? 0.2 : 0.1),
    };
    node.fills = disabled ? [token("hover/md")] : [fills[variant]];
    node.strokes = [disabled ? stroke("border") : stroke(variant === "primary" ? "accent/25" : variant === "danger" ? "red" : "border/strong")];
    node.opacity = stateOpacity;
    const fg = disabled ? "text/muted" : variant === "primary" ? "#051a12" : variant === "danger" ? "red" : "text/primary";
    if (size === "icon") {
      const icon = makeLucideIcon(state === "loading" ? "Loader2" : "Plus", typeof fg === "string" && fg.startsWith("#") ? fg : TOKENS[fg]?.hex ?? TOKENS["text/primary"].hex);
      icon.resize(14, 14);
      node.appendChild(icon);
      placeRegistryComponent(page, node, x, y);
      return;
    }
    if (state === "loading") {
      const loader = makeLucideIcon("Loader2", variant === "primary" ? "#051a12" : TOKENS["text/secondary"].hex);
      loader.resize(13, 13);
      node.appendChild(loader);
    }
    const label = await text(state === "loading" ? "Loading" : "Label", metrics.fs, "SemiBold", fg, { lh:metrics.fs + 4, align:"CENTER" });
    label.name = "Label";
    label.textAutoResize = "WIDTH_AND_HEIGHT";
    node.appendChild(label);
    placeRegistryComponent(page, node, x, y);
  }

  async function registryBadge(
    page: PageNode,
    key: string,
    severity: "ok"|"warning"|"danger"|"info"|"neutral",
    state: "default"|"subtle"|"disabled",
    x: number,
    y: number,
  ): Promise<void> {
    const color = { ok:"accent", warning:"amber", danger:"red", info:"blue", neutral:"text/secondary" }[severity];
    const fillColor = { ok:"#00e5a0", warning:"#f59e0b", danger:"#ff6b6b", info:"#60a5fa", neutral:"#ffffff" }[severity];
    const node = getOrCreateRegistryComponent(page, key, 116, 24);
    setAutoLayout(node, "HORIZONTAL", 6, { left:10, right:10, top:5, bottom:5 });
    node.primaryAxisAlignItems = "CENTER";
    node.counterAxisAlignItems = "CENTER";
    node.cornerRadius = 8;
    const fillOpacity = state === "subtle" ? 0.05 : severity === "neutral" ? 0.05 : 0.1;
    const strokeOpacity = state === "subtle" ? 0.12 : severity === "neutral" ? 0.1 : 0.25;
    node.fills = [paint(fillColor, fillOpacity)];
    node.strokes = [paint(fillColor, strokeOpacity)];
    node.strokeWeight = 1;
    node.opacity = state === "disabled" ? 0.42 : 1;
    if (state !== "subtle") node.appendChild(ellipse("Dot", 6, 6, color));
    const label = await text("Label", 11, "SemiBold", color, { lh:14 });
    label.name = "Label";
    label.textAutoResize = "WIDTH_AND_HEIGHT";
    node.appendChild(label);
    placeRegistryComponent(page, node, x, y);
  }

  async function registryField(
    page: PageNode,
    key: string,
    kind: "Input"|"Search"|"Select"|"Textarea",
    state: "default"|"hover"|"focused"|"error"|"disabled",
    x: number,
    y: number,
  ): Promise<void> {
    const h = kind === "Textarea" ? 96 : kind === "Search" ? 32 : 58;
    const w = kind === "Textarea" ? 320 : 280;
    const node = getOrCreateRegistryComponent(page, key, w, h);
    node.fills = [];
    node.opacity = state === "disabled" ? 0.5 : 1;
    let fieldY = 0;
    if (kind !== "Search") {
      const label = await text("Field Label", 11, "Medium", state === "error" ? "red" : "text/secondary", { lh:14 });
      label.name = "Field Label";
      add(node, label, 0, 0);
      fieldY = 20;
    }
    const field = frame(`${kind}/Field`, w, kind === "Textarea" ? 72 : 32, state === "hover" ? "hover/md" : state === "disabled" ? "hover/md" : "bg/surface-2");
    field.cornerRadius = 10;
    field.strokes = [state === "error" ? paint("#ff6b6b", 0.5) : state === "focused" ? token("accent") : stroke("border/strong")];
    field.strokeWeight = 1;
    add(node, field, 0, fieldY);
    if (kind === "Search") add(field, makeLucideIcon("Search", TOKENS["text/muted"].hex), 9, 4);
    const value = await text(state === "disabled" ? "Disabled" : kind === "Search" ? "Search" : "Value", 13, "Regular", state === "disabled" ? "text/muted" : "text/primary", { lh:18, width:w - (kind === "Search" ? 48 : 28) });
    value.name = kind === "Search" ? "Placeholder" : "Value";
    add(field, value, kind === "Search" ? 36 : 12, kind === "Textarea" ? 10 : 7);
    if (kind === "Select") add(field, makeLucideIcon("ChevronDown", TOKENS["text/secondary"].hex), w - 28, 4);
    placeRegistryComponent(page, node, x, y);
  }

  async function registryRequestBasicsForm(page: PageNode, x: number, y: number): Promise<void> {
    const fields = DEFAULT_FORM_FIELDS;
    const node = getOrCreateRegistryComponent(page, "Form/RequestBasics", 760, 704);
    node.cornerRadius = 14;
    node.fills = [token("bg/surface")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    setAutoLayout(node, "VERTICAL", 24, { left:24, right:24, top:24, bottom:24 });

    const title = await text("Крок 1 з 9 — Основні параметри", 11, "SemiBold", "text/muted", { lh:16, width:712 });
    title.name = "Title";
    node.appendChild(title);

    const content = frame("Fields", 712, 616);
    setAutoLayout(content, "VERTICAL", 12);
    fillAutoLayoutChild(content);

    let index = 0;
    const colGap = 20;
    const colW = Math.floor((712 - colGap) / 2);
    const fieldH = 58;
    const appendField = async (parent: FrameNode, fieldData: FormFieldValue, width: number): Promise<void> => {
      const kind = fieldData.kind === "select" ? "Select" : fieldData.kind === "textarea" ? "Textarea" : "Input";
      const componentNode = findRegistryComponentOnPage(page, `Form/${kind}/default`);
      if (!componentNode) return;
      const item = componentNode.createInstance();
      item.name = `Field/${index + 1}`;
      try { item.resize(width, kind === "Textarea" ? 96 : fieldH); } catch (_) {}
      fillAutoLayoutChild(item);
      await applyComponentProps(item, {
        label:`${fieldData.label.toUpperCase()}${fieldData.required ? " *" : ""}`,
        value:fieldData.value,
        placeholder:fieldData.value,
      });
      parent.appendChild(item);
      index++;
    };

    while (index < fields.length) {
      const fieldData = fields[index];
      if (fieldData.span === 2) {
        const row = frame(`Row/${index + 1}`, 712, fieldH);
        setAutoLayout(row, "HORIZONTAL", colGap);
        fillAutoLayoutChild(row);
        await appendField(row, fieldData, 712);
        content.appendChild(row);
        continue;
      }

      const row = frame(`Row/${index + 1}`, 712, fieldH);
      setAutoLayout(row, "HORIZONTAL", colGap);
      fillAutoLayoutChild(row);
      await appendField(row, fieldData, colW);
      if (index < fields.length && fields[index].span !== 2) await appendField(row, fields[index], colW);
      content.appendChild(row);
    }

    const checkboxRow = frame("PublishedCheckbox", 712, 24);
    setAutoLayout(checkboxRow, "HORIZONTAL", 8);
    fillAutoLayoutChild(checkboxRow);
    const box = frame("Checkbox", 16, 16);
    box.cornerRadius = 4;
    box.fills = [];
    box.strokes = [stroke("border/strong")];
    box.strokeWeight = 1;
    checkboxRow.appendChild(box);
    const checkboxLabel = await text("Публікація (відображати в публічному реєстрі)", 12, "Regular", "text/secondary", { lh:16, width:480 });
    checkboxLabel.name = "CheckboxLabel";
    checkboxRow.appendChild(checkboxLabel);
    content.appendChild(checkboxRow);

    node.appendChild(content);
    node.setSharedPluginData(MT_NS, MT_COMPONENT_PROPS_KEY, JSON.stringify({
      title:"Крок 1 з 9 — Основні параметри",
      fields:JSON.stringify(fields),
    }));
    placeRegistryComponent(page, node, x, y);
  }

  async function registryStepperStep(
    page: PageNode,
    key: string,
    state: "invalid"|"completed"|"active"|"pending",
    label: string,
    stepNumber: number,
    x: number,
    y: number,
  ): Promise<void> {
    const w = Math.max(92, Math.min(152, 36 + label.length * 7));
    const tone = stepperTone(state);
    const node = getOrCreateRegistryComponent(page, key, w, 24);
    node.fills = [];
    setAutoLayout(node, "HORIZONTAL", 8);

    const circle = frame("StepCircle", 24, 24);
    circle.cornerRadius = 999;
    circle.fills = tone.fill;
    circle.strokes = tone.stroke;
    circle.strokeWeight = 1;
    const num = await text(String(stepNumber), 11, "SemiBold", tone.text, { lh:14, align:"CENTER", width:24 });
    num.name = "StepNumber";
    add(circle, num, 0, 5);
    node.appendChild(circle);

    const labelNode = await text(label, 11, "Medium", state === "active" ? "text/primary" : tone.text, { lh:14, width:w - 32 });
    labelNode.name = "StepLabel";
    node.appendChild(labelNode);
    placeRegistryComponent(page, node, x, y);
  }

  async function registryStepper(page: PageNode, x: number, y: number): Promise<void> {
    const labels = DEFAULT_STEPPER_LABELS;
    const stepStates: Array<"invalid"|"completed"|"active"|"pending"> = labels.map((_, index) => index < 3 ? "invalid" : "pending");
    const widths = labels.map((label) => Math.max(92, Math.min(152, 36 + label.length * 7)));
    const totalW = 48 + widths.reduce((sum, width) => sum + width, 0) + (labels.length - 1) * 48;
    const node = getOrCreateRegistryComponent(page, "Form/Stepper", totalW, 58);
    node.fills = [token("bg/surface")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    setAutoLayout(node, "HORIZONTAL", 0, { left:24, right:24, top:16, bottom:16 });

    for (let i=0; i<labels.length; i++) {
      const state = stepStates[i];
      const stepComponent = findRegistryComponentOnPage(page, `Form/StepperStep/${state}`);
      if (stepComponent) {
        const step = stepComponent.createInstance();
        step.name = `Step/${i + 1}`;
        try { step.resize(widths[i], 24); } catch (_) {}
        await setInstanceText(step, ["StepNumber"], String(i + 1));
        await setInstanceText(step, ["StepLabel"], labels[i]);
        node.appendChild(step);
      }

      if (i < labels.length - 1) {
        const tone = stepperTone(state);
        const connector = rect(`StepConnector/${i + 1}`, 32, 1, "#343a46", 0);
        connector.fills = state === "invalid" || state === "completed" ? tone.connector : [paint("#343a46")];
        node.appendChild(connector);
      }
    }

    node.setSharedPluginData(MT_NS, MT_COMPONENT_PROPS_KEY, JSON.stringify({
      labels,
      current:"1",
      total:String(labels.length),
      invalidSteps:[1, 2, 3],
    }));
    placeRegistryComponent(page, node, x, y);
  }

  async function registryTabItem(
    page: PageNode,
    key: string,
    state: TabItemState,
    label: string,
    count: number,
    x: number,
    y: number,
  ): Promise<void> {
    const node = getOrCreateRegistryComponent(page, key, 256, 34);
    setAutoLayout(node, "HORIZONTAL", 8, { left:12, right:12, top:8, bottom:8 });
    node.primaryAxisAlignItems = "SPACE_BETWEEN";
    node.counterAxisAlignItems = "CENTER";
    node.cornerRadius = 8;
    node.fills = [state === "active" ? token("accent/10") : state === "hover" ? token("hover/md") : paint("#ffffff", 0)];
    node.strokes = [];
    node.strokeWeight = 0;
    node.opacity = state === "disabled" ? 0.45 : 1;

    const labelColor = state === "active" ? "accent" : state === "hover" ? "text/secondary" : "text/muted";
    const labelNode = await text(label, 12, "Medium", labelColor, { lh:16, width:188 });
    labelNode.name = "Label";
    try { (labelNode as SceneNode & AutoLayoutChildrenMixin).layoutGrow = 1; } catch (_) {}
    node.appendChild(labelNode);

    const countBadge = frame("CountBadge", 24, 18, "hover/strong");
    countBadge.cornerRadius = 999;
    setAutoLayout(countBadge, "HORIZONTAL", 0, { left:6, right:6, top:2, bottom:2 });
    countBadge.primaryAxisAlignItems = "CENTER";
    countBadge.counterAxisAlignItems = "CENTER";
    const countNode = await text(String(count), 10, "SemiBold", "text/secondary", { lh:12, align:"CENTER" });
    countNode.name = "Count";
    countNode.textAutoResize = "WIDTH_AND_HEIGHT";
    countBadge.appendChild(countNode);
    node.appendChild(countBadge);

    placeRegistryComponent(page, node, x, y);
  }

  async function registryTabBar(page: PageNode, x: number, y: number): Promise<void> {
    const labels = DEFAULT_TAB_LABELS;
    const counts = [0, 0, 0, 0, 0, 0, 2, 0, 5];
    const node = getOrCreateRegistryComponent(page, "Navigation/TabBar", 280, 414);
    node.cornerRadius = 10;
    node.fills = [token("bg/surface-2")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    setAutoLayout(node, "VERTICAL", 12, { left:12, right:12, top:12, bottom:12 });

    const header = frame("Header", 256, 42);
    setAutoLayout(header, "VERTICAL", 4);
    const title = await text("РОЗДІЛИ", 10, "SemiBold", "text/muted", { lh:12, width:256 });
    title.name = "Title";
    header.appendChild(title);
    const subtitle = await text("Оберіть вкладку для перегляду або редагування.", 12, "Regular", "text/secondary", { lh:16, width:256 });
    subtitle.name = "Subtitle";
    header.appendChild(subtitle);
    node.appendChild(header);

    const list = frame("Tabs", 256, 336);
    setAutoLayout(list, "VERTICAL", 4);
    for (let i=0; i<labels.length; i++) {
      const state: TabItemState = i === 0 ? "active" : "default";
      const componentNode = findRegistryComponentOnPage(page, `Navigation/TabItem/${state}`);
      if (!componentNode) continue;
      const item = componentNode.createInstance();
      item.name = `Tab/${i + 1}`;
      try { item.resize(256, 34); } catch (_) {}
      await setInstanceText(item, ["Label"], labels[i]);
      await setInstanceText(item, ["Count"], String(counts[i] ?? 0));
      list.appendChild(item);
    }
    node.appendChild(list);
    node.setSharedPluginData(MT_NS, MT_COMPONENT_PROPS_KEY, JSON.stringify({
      tabs:JSON.stringify(labels),
      activeIndex:"1",
      counts:JSON.stringify(counts),
    }));
    placeRegistryComponent(page, node, x, y);
  }

  async function registrySegmentedTabItem(
    page: PageNode,
    key: string,
    state: TabItemState,
    label: string,
    iconName: string,
    x: number,
    y: number,
  ): Promise<void> {
    const node = getOrCreateRegistryComponent(page, key, 94, 52);
    node.cornerRadius = 14;
    node.fills = [state === "active" ? token("bg/surface") : state === "hover" ? token("hover/md") : paint("#ffffff", 0)];
    node.strokes = state === "active" ? [paint("#000000", 0.12)] : [];
    node.strokeWeight = state === "active" ? 1 : 0;
    node.opacity = state === "disabled" ? 0.45 : 1;
    setAutoLayout(node, "HORIZONTAL", 10, { left:16, right:16, top:14, bottom:14 });
    node.primaryAxisAlignItems = "CENTER";
    node.counterAxisAlignItems = "CENTER";

    const color = state === "active" ? TOKENS["text/primary"].hex : TOKENS["text/secondary"].hex;
    const icon = makeLucideIcon(iconName, color);
    icon.name = `Icon/${iconName}`;
    icon.resize(22, 22);
    node.appendChild(icon);

    const labelNode = await text(label, 16, "Bold", state === "active" ? "text/primary" : "text/secondary", { lh:22 });
    labelNode.name = "Label";
    labelNode.textAutoResize = "WIDTH_AND_HEIGHT";
    node.appendChild(labelNode);

    placeRegistryComponent(page, node, x, y);
  }

  async function registrySegmentedTabs(page: PageNode, x: number, y: number): Promise<void> {
    const node = getOrCreateRegistryComponent(page, "Navigation/SegmentedTabs", 204, 64);
    node.cornerRadius = 18;
    node.fills = [token("bg/surface-2")];
    node.strokes = [stroke("border/strong")];
    node.strokeWeight = 1;
    setAutoLayout(node, "HORIZONTAL", 4, { left:6, right:6, top:6, bottom:6 });
    node.primaryAxisAlignItems = "CENTER";
    node.counterAxisAlignItems = "CENTER";

    const items: Array<{ label:string; icon:string; state:TabItemState }> = [
      { label:"2D", icon:"Map", state:"active" },
      { label:"3D", icon:"Box", state:"default" },
    ];
    for (let i=0; i<items.length; i++) {
      const itemConfig = items[i];
      const componentNode = findRegistryComponentOnPage(page, `Navigation/SegmentedTabItem/${itemConfig.state}`);
      if (!componentNode) continue;
      const item = componentNode.createInstance();
      item.name = `Segment/${i + 1}`;
      try { item.resize(94, 52); } catch (_) {}
      await setInstanceText(item, ["Label"], itemConfig.label);
      node.appendChild(item);
    }
    node.setSharedPluginData(MT_NS, MT_COMPONENT_PROPS_KEY, JSON.stringify({
      tabs:JSON.stringify(items.map((item) => item.label)),
      activeIndex:"1",
      icons:JSON.stringify(items.map((item) => item.icon)),
    }));
    placeRegistryComponent(page, node, x, y);
  }

  async function registryCard(page: PageNode, key: string, state: "default"|"hover"|"active"|"disabled", x: number, y: number): Promise<void> {
    const node = getOrCreateRegistryComponent(page, key, 300, 148);
    node.cornerRadius = 12;
    node.fills = [state === "hover" || state === "active" ? token("hover/md") : token("bg/surface")];
    node.strokes = [state === "active" ? token("accent/25") : stroke("border")];
    node.strokeWeight = 1;
    node.opacity = state === "disabled" ? 0.45 : 1;
    add(node, rect("Accent", 300, 2, "accent", 0), 0, 0);
    const title = await text("Title", 15, "SemiBold", "text/primary", { lh:20 });
    title.name = "Title";
    add(node, title, 16, 18);
    const value = await text("Value", 28, "Bold", "text/primary", { lh:32 });
    value.name = "Value";
    add(node, value, 16, 72);
    placeRegistryComponent(page, node, x, y);
  }

  async function registryDialog(
    page: PageNode,
    key: string,
    severity: "warning"|"danger"|"info",
    state: "default"|"disabled",
    x: number,
    y: number,
  ): Promise<void> {
    const tone = {
      warning: { color:"#f59e0b", fill:"#f59e0b", icon:"!" },
      danger: { color:"#ff6b6b", fill:"#ff6b6b", icon:"!" },
      info: { color:"#60a5fa", fill:"#60a5fa", icon:"i" },
    }[severity];
    const node = getOrCreateRegistryComponent(page, key, 520, 184);
    node.cornerRadius = 16;
    node.fills = [token("bg/surface")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    node.opacity = state === "disabled" ? 0.5 : 1;
    node.effects = [{
      type:"DROP_SHADOW",
      color:{ r:0, g:0, b:0, a:0.35 },
      offset:{ x:0, y:18 },
      radius:40,
      spread:0,
      visible:true,
      blendMode:"NORMAL",
    }];

    const alert = frame("AlertPanel", 456, 100);
    alert.cornerRadius = 14;
    alert.fills = [paint(tone.fill, 0.1)];
    alert.strokes = [paint(tone.fill, 0.45)];
    alert.strokeWeight = 1;
    add(node, alert, 32, 28);

    const iconWrap = ellipse("AlertIconBg", 24, 24, tone.fill);
    iconWrap.opacity = 0.85;
    add(alert, iconWrap, 22, 24);
    const icon = await text(tone.icon, 14, "Bold", "#141922", { lh:16, align:"CENTER", width:24 });
    icon.name = "Icon";
    add(alert, icon, 22, 27);

    const title = await text("обовʼязкові поля не заповнені", 14, "SemiBold", "text/primary", { lh:18, width:360 });
    title.name = "Title";
    add(alert, title, 70, 26);
    const message = await text("Заповніть: Назва об'єкта, Вид укриття, Тип доступу.", 13, "Regular", "text/secondary", { lh:18, width:360 });
    message.name = "Message";
    add(alert, message, 70, 54);

    const secondaryComponent = findRegistryComponentOnPage(page, "Button/secondary/md");
    if (secondaryComponent) {
      const secondary = secondaryComponent.createInstance();
      secondary.name = "SecondaryAction";
      await applyComponentProps(secondary, { text:"закрити" });
      try { secondary.resize(104, 36); } catch (_) {}
      add(node, secondary, 240, 144);
    }
    const primaryComponent = findRegistryComponentOnPage(page, "Button/primary/md");
    if (primaryComponent) {
      const primary = primaryComponent.createInstance();
      primary.name = "PrimaryAction";
      await applyComponentProps(primary, { text:"продовжити" });
      try { primary.resize(132, 36); } catch (_) {}
      add(node, primary, 356, 144);
    }
    placeRegistryComponent(page, node, x, y);
  }

  async function registryInfoField(
    page: PageNode,
    key: string,
    state: InfoFieldState,
    x: number,
    y: number,
  ): Promise<void> {
    const node = getOrCreateRegistryComponent(page, key, 340, 58);
    node.fills = [state === "muted" ? token("hover/md") : paint("#ffffff", 0)];
    node.opacity = state === "disabled" ? 0.45 : 1;
    setAutoLayout(node, "VERTICAL", 8, { left:0, right:0, top:0, bottom:0 });

    const label = await text("ОБЛІКОВИЙ НОМЕР", 13, "Medium", "text/muted", { lh:16, width:340 });
    label.name = "FieldLabel";
    fillAutoLayoutChild(label);
    node.appendChild(label);

    const value = await text(state === "empty" ? "—" : "14-КВ-0012", 18, "SemiBold", state === "empty" ? "text/secondary" : "text/primary", { lh:24, width:340 });
    value.name = "FieldValue";
    fillAutoLayoutChild(value);
    node.appendChild(value);

    placeRegistryComponent(page, node, x, y);
  }

  async function registryInfoTable(page: PageNode, x: number, y: number): Promise<void> {
    const fields = DEFAULT_INFO_TABLE_FIELDS;
    const width = 1180;
    const innerW = width - 56;
    const colW = Math.floor((innerW - 96) / 3);
    const node = getOrCreateRegistryComponent(page, "Data/InfoTable", width, 662);
    node.cornerRadius = 16;
    node.fills = [token("bg/surface")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    setAutoLayout(node, "VERTICAL", 28, { left:28, right:28, top:28, bottom:28 });

    const title = await text("СИСТЕМНА ІНФОРМАЦІЯ", 13, "SemiBold", "text/muted", { lh:18, width:innerW });
    title.name = "Title";
    node.appendChild(title);

    const grid = frame("InfoGrid", innerW, 560);
    setAutoLayout(grid, "VERTICAL", 30);
    fillAutoLayoutChild(grid);

    const fieldComponent = findRegistryComponentOnPage(page, "Data/InfoField/default");
    const addRow = async (rowName: string, rowFields: InfoFieldValue[], rowStartIndex: number): Promise<void> => {
      const row = frame(rowName, innerW, 58);
      setAutoLayout(row, "HORIZONTAL", 48);
      fillAutoLayoutChild(row);
      for (let i=0; i<3; i++) {
        const field = rowFields[i];
        if (!field || !fieldComponent) {
          const spacer = frame(`Field/${rowStartIndex + i + 1}`, colW, 58);
          spacer.fills = [];
          fillAutoLayoutChild(spacer);
          row.appendChild(spacer);
          continue;
        }
        const item = fieldComponent.createInstance();
        item.name = `Field/${rowStartIndex + i + 1}`;
        try { item.resize(colW, 58); } catch (_) {}
        fillAutoLayoutChild(item);
        await setInstanceText(item, ["FieldLabel"], field.label.toUpperCase());
        await setInstanceText(item, ["FieldValue"], field.value);
        row.appendChild(item);
      }
      grid.appendChild(row);
    };

    await addRow("SystemRow/1", fields.slice(0, 3), 0);
    await addRow("SystemRow/2", fields.slice(3, 4), 3);

    const dividerNode = rect("SectionDivider", innerW, 1, "border", 0);
    grid.appendChild(dividerNode);

    let start = 4;
    for (let rowIndex=0; rowIndex<5; rowIndex++) {
      await addRow(`MainRow/${rowIndex + 1}`, fields.slice(start, start + 3), start);
      start += 3;
    }

    node.appendChild(grid);
    node.setSharedPluginData(MT_NS, MT_COMPONENT_PROPS_KEY, JSON.stringify({
      title:"Системна інформація",
      fields:JSON.stringify(fields),
      dividerAfter:"4",
    }));
    placeRegistryComponent(page, node, x, y);
  }

  async function registryTableCell(
    page: PageNode,
    key: string,
    variant: "header"|"text"|"muted"|"twoLine"|"status"|"action"|"favorite"|"shelterName",
    state: "default"|"hover"|"selected"|"disabled",
    x: number,
    y: number,
  ): Promise<void> {
    const h = variant === "header" ? 44 : variant === "favorite" || variant === "shelterName" ? 78 : 58;
    const w = variant === "favorite" ? 44 : variant === "shelterName" ? 260 : 168;
    const isVertical = variant === "twoLine" || variant === "shelterName";
    const node = getOrCreateRegistryComponent(page, key, w, h);
    setAutoLayout(node, isVertical ? "VERTICAL" : "HORIZONTAL", isVertical ? 6 : 8, {
      left:12,
      right:12,
      top:isVertical ? 10 : 0,
      bottom:isVertical ? 10 : 0,
    });
    node.fills = [variant === "header" ? token("bg/surface-2") : state === "hover" ? token("hover/md") : state === "selected" ? token("accent/10") : token("bg/surface")];
    node.strokes = [state === "selected" ? token("accent/25") : stroke("border")];
    node.strokeWeight = 1;
    node.opacity = state === "disabled" ? 0.45 : 1;

    if (variant === "favorite") {
      const icon = makeLucideIcon("Bookmark", TOKENS["accent"].hex);
      icon.resize(16, 16);
      node.appendChild(icon);
    } else if (variant === "shelterName") {
      const title = await text("Бомбосховище «Університет»", 12, "SemiBold", "text/primary", { lh:16, width:w - 24 });
      title.name = "Title";
      node.appendChild(title);

      const badgeRow = frame("Badges", w - 24, 24);
      setAutoLayout(badgeRow, "HORIZONTAL", 6);

      const typeBadge = frame("TypeBadge", 64, 22, "bg/surface-2");
      typeBadge.cornerRadius = 7;
      typeBadge.strokes = [stroke("border/strong")];
      typeBadge.strokeWeight = 1;
      const typeLabel = await text("Стац.", 11, "SemiBold", "text/secondary", { lh:14, width:44 });
      typeLabel.name = "Type";
      add(typeBadge, typeLabel, 10, 4);
      badgeRow.appendChild(typeBadge);

      const statusBadge = frame("StatusBadge", 116, 22, "accent/10");
      statusBadge.cornerRadius = 7;
      statusBadge.strokes = [token("accent/25")];
      statusBadge.strokeWeight = 1;
      const dot = ellipse("StatusDot", 6, 6, "accent");
      add(statusBadge, dot, 10, 8);
      const statusLabel = await text("Експлуатація", 11, "SemiBold", "accent", { lh:14, width:84 });
      statusLabel.name = "Status";
      add(statusBadge, statusLabel, 24, 4);
      badgeRow.appendChild(statusBadge);
      node.appendChild(badgeRow);
    } else if (variant === "status") {
      const badge = frame("StatusBadge", 98, 24, "accent/10");
      badge.cornerRadius = 8;
      badge.strokes = [token("accent/25")];
      badge.strokeWeight = 1;
      add(badge, ellipse("StatusDot", 6, 6, "accent"), 10, 9);
      const label = await text("Схвалена", 11, "SemiBold", "accent", { lh:14 });
      label.name = "Text";
      add(badge, label, 24, 5);
      node.appendChild(badge);
    } else if (variant === "twoLine") {
      const title = await text("Підвальне приміщення", 12, "SemiBold", "text/primary", { lh:16, width:144 });
      title.name = "Title";
      node.appendChild(title);
      const subtitle = await text("STATIC", 11, "Regular", "text/muted", { lh:14, width:144 });
      subtitle.name = "Subtitle";
      node.appendChild(subtitle);
    } else {
      const label = await text(
        variant === "header" ? "Назва / Тип" : variant === "action" ? "Деталі" : "Text",
        variant === "header" ? 10 : 12,
        variant === "header" || variant === "action" ? "SemiBold" : "Regular",
        variant === "header" || variant === "muted" ? "text/secondary" : "text/primary",
        { lh:variant === "header" ? 14 : 16, width:144 },
      );
      label.name = variant === "header" ? "Header" : "Text";
      node.appendChild(label);
    }
    placeRegistryComponent(page, node, x, y);
  }

  async function registryTableRow(
    page: PageNode,
    key: string,
    isHeader: boolean,
    state: "default"|"hover"|"selected"|"disabled" = "default",
    x: number,
    y: number,
  ): Promise<void> {
    const widths = [220, 140, 220, 110, 180, 130, 110];
    const total = widths.reduce((sum, width) => sum + width, 0);
    const h = isHeader ? 44 : 58;
    const node = getOrCreateRegistryComponent(page, key, total, h);
    setAutoLayout(node, "HORIZONTAL");
    node.fills = [isHeader ? token("bg/surface-2") : state === "hover" ? token("hover/md") : state === "selected" ? token("accent/10") : token("bg/surface")];
    node.strokes = [state === "selected" ? token("accent/25") : stroke("border")];
    node.strokeWeight = 1;
    node.opacity = state === "disabled" ? 0.45 : 1;

    for (let c=0; c<widths.length; c++) {
      const cellKey = isHeader
        ? "Data/TableCell/header"
        : c === 0
          ? "Data/TableCell/twoLine"
          : c === 4
            ? "Data/TableCell/status"
            : c === 6
              ? "Data/TableCell/action"
              : c === 2 || c === 5
                ? "Data/TableCell/muted"
                : "Data/TableCell/text";
      const cellComponent = findRegistryComponentOnPage(page, cellKey);
      if (!cellComponent) continue;
      const cell = cellComponent.createInstance();
      cell.name = isHeader ? `Header/${c}` : `Cell/0/${c}`;
      try { cell.resize(widths[c], h); } catch (_) {}
      node.appendChild(cell);
    }
    placeRegistryComponent(page, node, x, y);
  }

  async function registryDataTable(page: PageNode, x: number, y: number): Promise<void> {
    const widths = [220, 140, 220, 110, 180, 130, 110];
    const headers = ["Назва / Тип", "Тип доступу", "Заявник", "Місткість", "Статус", "Дата", ""];
    const rows = [
      ["Підвальне приміщення на Клочківській\nSTATIC", "PUBLIC", "balance-holder3@example.com", "110", "Відхилена", "11.05.2026", "Деталі"],
      ["Склад на Городоцькій\nSTATIC", "PRIVATE", "gov-org2@example.com", "70", "Відхилена", "11.05.2026", "Деталі"],
      ["Укриття «Поштова площа»\nSTATIC", "PUBLIC", "gov-org@example.com", "400", "Схвалена", "11.05.2026", "Деталі"],
      ["Метро «Держпром»\nSTATIC", "PUBLIC", "balance-holder3@example.com", "900", "Схвалена", "11.05.2026", "Деталі"],
      ["Підземний перехід «Майдан»\nSTATIC", "PUBLIC", "balance-holder@example.com", "600", "Схвалена", "11.05.2026", "Деталі"],
      ["Укриття у підвалі адмінбудівлі\nSTATIC", "PRIVATE", "balance-holder3@example.com", "60", "Подана", "11.05.2026", "Деталі"],
      ["Підвал ЗОШ №45\nSTATIC", "PUBLIC", "balance-holder@example.com", "320", "Подана", "11.05.2026", "Деталі"],
      ["Мобільний модуль «Захист-1»\nMOBILE", "PUBLIC", "gov-org2@example.com", "45", "Подана", "11.05.2026", "Деталі"],
      ["Паркінг ТРЦ «Гулівер»\nSTATIC", "PUBLIC", "balance-holder@example.com", "850", "Подана", "11.05.2026", "Деталі"],
      ["Метро «Арсенальна»\nSTATIC", "PUBLIC", "gov-org@example.com", "1200", "Подана", "11.05.2026", "Деталі"],
      ["Підвал бібліотеки ім. Франка\nSTATIC", "PUBLIC", "balance-holder2@example.com", "180", "Подана", "11.05.2026", "Деталі"],
      ["Мобільний модуль «Захист-2»\nMOBILE", "PUBLIC", "gov-org2@example.com", "45", "Подана", "11.05.2026", "Деталі"],
    ];
    const total = widths.reduce((sum, width) => sum + width, 0);
    const node = getOrCreateRegistryComponent(page, "Data/Table", total, 44 + rows.length * 58);
    setAutoLayout(node, "VERTICAL");
    node.cornerRadius = 12;
    node.clipsContent = true;
    node.fills = [token("bg/surface")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;

    const makeCell = async (cellKey: string, name: string, w: number, h: number, value: string): Promise<InstanceNode|null> => {
      const componentNode = findRegistryComponentOnPage(page, cellKey);
      if (!componentNode) return null;
      const cell = componentNode.createInstance();
      cell.name = name;
      try { cell.resize(w, h); } catch (_) {}
      await applyComponentProps(cell, value.includes("\n") ? { title:value.split("\n")[0], subtitle:value.split("\n").slice(1).join("\n") } : { text:value });
      return cell;
    };

    const header = frame("Table/Header", total, 44, "bg/surface-2");
    setAutoLayout(header, "HORIZONTAL");
    for (let c=0; c<widths.length; c++) {
      const cell = await makeCell("Data/TableCell/header", `Header/${c}`, widths[c], 44, headers[c]);
      if (cell) header.appendChild(cell);
    }
    node.appendChild(header);

    for (let r=0; r<rows.length; r++) {
      const row = frame(`Table/Row/${r}`, total, 58, r % 2 === 1 ? "hover/md" : "bg/surface");
      setAutoLayout(row, "HORIZONTAL");
      for (let c=0; c<widths.length; c++) {
        const cellKey = c === 0
          ? "Data/TableCell/twoLine"
          : c === 4
            ? "Data/TableCell/status"
            : c === 6
              ? "Data/TableCell/action"
              : c === 2 || c === 5
                ? "Data/TableCell/muted"
                : "Data/TableCell/text";
        const cell = await makeCell(cellKey, `Cell/${r}/${c}`, widths[c], 58, rows[r][c]);
        if (cell) row.appendChild(cell);
      }
      node.appendChild(row);
    }

    placeRegistryComponent(page, node, x, y);
  }

  async function registryShelterDataTable(page: PageNode, x: number, y: number): Promise<void> {
    const headers = SHELTER_TABLE_HEADERS;
    const rows = [
      ["active", "Бомбосховище «Університет»", "Стац.", "Експлуатація", "PUBLIC", "1500", "—", "ручне", "11.05.2026"],
      ["", "Підземний перехід «Майдан»", "Стац.", "Потреба", "PUBLIC", "600", "м. Київ, Майдан Незалежності", "a1524da6", "11.05.2026"],
      ["active", "Укриття «Поштова площа»", "Стац.", "Проєкт", "PUBLIC", "400", "м. Київ, Поштова площа, 2", "0dc0ace9", "11.05.2026"],
      ["active", "Модульне укриття «Салтівка-1»", "Мобільне", "Потреба", "PUBLIC", "120", "—", "ручне", "11.05.2026"],
      ["", "Підземна парковка «Форум Львів»", "Стац.", "Ремонт", "PUBLIC", "380", "—", "ручне", "11.05.2026"],
    ];
    const widths = SHELTER_TABLE_WIDTHS;
    const total = widths.reduce((sum, width) => sum + width, 0);
    const rowH = 78;
    const node = getOrCreateRegistryComponent(page, "Data/Table/Shelters", total, 44 + rows.length * rowH);
    setAutoLayout(node, "VERTICAL");
    node.cornerRadius = 12;
    node.clipsContent = true;
    node.fills = [token("bg/surface")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;

    const makeCell = async (cellKey: string, name: string, w: number, h: number, value=""): Promise<InstanceNode|null> => {
      const componentNode = findRegistryComponentOnPage(page, cellKey);
      if (!componentNode) return null;
      const cell = componentNode.createInstance();
      cell.name = name;
      try { cell.resize(w, h); } catch (_) {}
      if (value || cellKey === "Data/TableCell/header") await setInstanceText(cell, ["Header", "Text", "Title", "Value", "Label"], value);
      return cell;
    };

    const header = frame("Table/Header", total, 44, "bg/surface-2");
    setAutoLayout(header, "HORIZONTAL");
    for (let c=0; c<widths.length; c++) {
      const cell = await makeCell("Data/TableCell/header", `Header/${c}`, widths[c], 44, headers[c]);
      if (cell) header.appendChild(cell);
    }
    node.appendChild(header);

    for (let r=0; r<rows.length; r++) {
      const row = frame(`Table/Row/${r}`, total, rowH, r % 2 === 1 ? "hover/md" : "bg/surface");
      setAutoLayout(row, "HORIZONTAL");
      const favorite = await makeCell("Data/TableCell/favorite", `Cell/${r}/0`, widths[0], rowH);
      if (favorite) {
        setInstanceStrokePaint(favorite, rows[r][0] === "active" ? "#00e5a0" : "#5f6b80");
        row.appendChild(favorite);
      }

      const nameCell = await makeCell("Data/TableCell/shelterName", `Cell/${r}/1`, widths[1], rowH);
      if (nameCell) {
        await setInstanceText(nameCell, ["Title"], rows[r][1]);
        await setInstanceText(nameCell, ["Type"], rows[r][2]);
        await setInstanceText(nameCell, ["Status"], rows[r][3]);
        const typeTone = badgeTone(rows[r][2]);
        const statusTone = badgeTone(rows[r][3]);
        setInstanceNodePaint(nameCell, "TypeBadge", [dynamicPaint(typeTone.fill)], [dynamicPaint(typeTone.stroke)]);
        setInstanceNodePaint(nameCell, "StatusBadge", [dynamicPaint(statusTone.fill)], [dynamicPaint(statusTone.stroke)]);
        setInstanceNodePaint(nameCell, "StatusDot", [dynamicPaint(statusTone.dot)]);
        setInstanceTextPaint(nameCell, "Type", typeTone.text);
        setInstanceTextPaint(nameCell, "Status", statusTone.text);
        row.appendChild(nameCell);
      }

      const cellKeys = ["Data/TableCell/muted", "Data/TableCell/text", "Data/TableCell/muted", "Data/TableCell/muted", "Data/TableCell/muted"];
      for (let c=2; c<widths.length; c++) {
        const cell = await makeCell(cellKeys[c - 2], `Cell/${r}/${c}`, widths[c], rowH, rows[r][c + 2]);
        if (cell) row.appendChild(cell);
      }
      node.appendChild(row);
    }

    placeRegistryComponent(page, node, x, y);
  }

  async function registryLogo(page: PageNode, x: number, y: number): Promise<void> {
    const node = getOrCreateRegistryComponent(page, "Layout/Logo", 190, 40);
    node.fills = [];
    const mark = frame("LogoMark", 32, 32, "accent");
    mark.cornerRadius = 8;
    add(node, mark, 0, 4);
    try {
      const homeIcon = makeLucideIcon("Home", "#051a12");
      homeIcon.resize(18, 18);
      add(mark, homeIcon, 7, 7);
    } catch (_) {
      add(mark, await text("D", 13, "Bold", "#051a12", { lh:16, align:"CENTER" }), 11, 8);
    }
    const title = await text("Облік укриттів", 13, "SemiBold", "text/primary", { lh:16, width:142 });
    title.name = "LogoTitle";
    add(node, title, 42, 5);
    const subtitle = await text("ДСНС України · v2.4", 10, "Regular", "text/muted", { lh:12, width:142 });
    subtitle.name = "LogoSubtitle";
    add(node, subtitle, 42, 24);
    placeRegistryComponent(page, node, x, y);
  }

  async function registryUserFooter(page: PageNode, x: number, y: number): Promise<void> {
    const node = getOrCreateRegistryComponent(page, "Layout/UserFooter", 196, 40);
    node.fills = [];
    const avatar = ellipse("Avatar", 32, 32, "blue");
    add(node, avatar, 0, 4);
    add(node, await text("D", 12, "Bold", "#ffffff", { lh:16, align:"CENTER" }), 12, 12);
    const user = await text("Dsns", 12, "Medium", "text/primary", { lh:16, width:104 });
    user.name = "UserName";
    add(node, user, 42, 5);
    const role = await text("ДСНС", 10, "Regular", "text/muted", { lh:12, width:104 });
    role.name = "UserRole";
    add(node, role, 42, 24);
    const settings = frame("SettingsButton", 28, 28, "");
    settings.cornerRadius = 8;
    constrain(settings, "MAX", "MIN");
    const settingsIcon = makeLucideIcon("Settings", TOKENS["text/muted"].hex);
    settingsIcon.resize(16, 16);
    add(settings, settingsIcon, 6, 6);
    add(node, settings, 168, 6);
    placeRegistryComponent(page, node, x, y);
  }

  async function registryNavItem(page: PageNode, key: string, state: "default"|"hover"|"active"|"disabled", x: number, y: number): Promise<void> {
    const active = state === "active";
    const node = getOrCreateRegistryComponent(page, key, 192, 34);
    node.cornerRadius = 10;
    node.fills = active ? [token("accent/10")] : state === "hover" ? [token("hover/md")] : [paint("#ffffff", 0)];
    node.strokes = active ? [token("accent/15")] : [paint("#ffffff", 0)];
    node.strokeWeight = 1;
    node.opacity = state === "disabled" ? 0.45 : 1;
    const navIcon = makeLucideIcon(active ? "LayoutDashboard" : "Map", active ? TOKENS["accent"].hex : state === "hover" ? TOKENS["text/primary"].hex : TOKENS["text/muted"].hex);
    navIcon.resize(16, 16);
    add(node, navIcon, 10, 9);
    const title = await text(active ? "Дашборд" : "Мапа", 12, active ? "SemiBold" : "Regular", active ? "accent" : state === "hover" ? "text/primary" : "text/secondary", { lh:16, width:112 });
    title.name = "Title";
    add(node, title, 36, 9);
    const badge = await text("5", 10, "SemiBold", "accent", { lh:12, align:"CENTER" });
    badge.name = "Badge";
    const badgeFrame = frame("BadgeFrame", 22, 20, active ? "accent/15" : "hover/md");
    badgeFrame.cornerRadius = 999;
    constrain(badgeFrame, "MAX", "CENTER");
    add(badgeFrame, badge, 8, 4);
    add(node, badgeFrame, 160, 7);
    placeRegistryComponent(page, node, x, y);
  }

  async function registrySidebar(page: PageNode, x: number, y: number): Promise<void> {
    const node = getOrCreateRegistryComponent(page, "Layout/Sidebar", 224, 1080);
    node.fills = [token("bg/surface")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;

    const logo = findRegistryComponentOnPage(page, "Layout/Logo");
    if (logo) {
      const logoInstance = logo.createInstance();
      constrain(logoInstance, "MIN", "MIN");
      add(node, logoInstance, 16, 20);
    } else {
      add(node, await text("Облік укриттів", 13, "SemiBold", "text/primary", { lh:16 }), 16, 24);
    }
    divider(node, 0, 72, 224);
    constrain(node.children[node.children.length - 1], "STRETCH", "MIN");

    const groups = [
      { label:"ОГЛЯД", y:104, items:[
        { title:"Дашборд", icon:"LayoutDashboard", active:true, badge:"" },
        { title:"Мапа", icon:"Map", active:false, badge:"" },
      ] },
      { label:"ОБЛІК", y:242, items:[
        { title:"Список укриттів", icon:"List", active:false, badge:"5" },
        { title:"Пропозиції", icon:"ClipboardList", active:false, badge:"13" },
      ] },
      { label:"ДОВІДКА", y:392, items:[
        { title:"FAQ", icon:"HelpCircle", active:false, badge:"" },
        { title:"Більше", icon:"ExternalLink", active:false, badge:"" },
        { title:"Подяка спонсорам", icon:"HandHeart", active:false, badge:"" },
      ] },
    ];

    for (const group of groups) {
      add(node, await text(group.label, 10, "SemiBold", "text/ghost", { lh:12, width:192 }), 16, group.y);
      for (let i=0; i<group.items.length; i++) {
        const item = group.items[i];
        const itemY = group.y + 24 + i * 44;
        const row = frame(`NavItem/${item.title}`, 200, 34, item.active ? "accent/10" : "");
        row.cornerRadius = 10;
        row.strokes = item.active ? [token("accent/15")] : [];
        row.strokeWeight = item.active ? 1 : 0;
        constrain(row, "STRETCH", "MIN");
        const rowIcon = makeLucideIcon(item.icon, item.active ? TOKENS["accent"].hex : TOKENS["text/muted"].hex);
        rowIcon.resize(16, 16);
        add(row, rowIcon, 10, 9);
        add(row, await text(item.title, 12, item.active ? "SemiBold" : "Regular", item.active ? "accent" : "text/secondary", { lh:16, width:122 }), 36, 9);
        if (item.badge) {
          const badgeFrame = frame("NavBadge", 22, 20, item.badge === "13" ? "amber" : "accent");
          badgeFrame.opacity = 0.9;
          badgeFrame.cornerRadius = 999;
          constrain(badgeFrame, "MAX", "CENTER");
          add(badgeFrame, await text(item.badge, 10, "SemiBold", "#051a12", { lh:12, align:"CENTER" }), item.badge.length > 1 ? 5 : 8, 4);
          add(row, badgeFrame, 168, 7);
        }
        add(node, row, 12, itemY);
      }
    }

    divider(node, 0, 1020, 224);
    constrain(node.children[node.children.length - 1], "STRETCH", "MAX");
    const footer = findRegistryComponentOnPage(page, "Layout/UserFooter");
    if (footer) {
      const footerInstance = footer.createInstance();
      constrain(footerInstance, "STRETCH", "MAX");
      add(node, footerInstance, 16, 1030);
    }
    placeRegistryComponent(page, node, x, y);
  }

  async function registryTopbar(page: PageNode, x: number, y: number): Promise<void> {
    const node = getOrCreateRegistryComponent(page, "Layout/Topbar", 960, 56);
    node.fills = [token("bg/overlay")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    const title = await text("Дашборд", 13, "SemiBold", "text/primary", { lh:16, width:260 });
    title.name = "Title";
    add(node, title, 24, 10);
    const subtitle = await text("Dsns", 10, "Regular", "text/muted", { lh:12, width:260 });
    subtitle.name = "Subtitle";
    add(node, subtitle, 24, 32);

    const bell = frame("Notifications", 32, 32, "");
    bell.cornerRadius = 8;
    constrain(bell, "MAX", "CENTER");
    const bellIcon = makeLucideIcon("Bell", TOKENS["text/secondary"].hex);
    bellIcon.resize(16, 16);
    add(bell, bellIcon, 8, 8);
    const countBg = ellipse("NotificationBadgeBg", 16, 16, "red");
    add(bell, countBg, 19, -2);
    const count = await text("2", 9, "Bold", "#ffffff", { lh:10, align:"CENTER" });
    count.name = "NotificationBadge";
    add(bell, count, 24, 1);
    add(node, bell, 780, 12);

    const logout = frame("LogoutButton", 96, 32, "");
    logout.cornerRadius = 8;
    logout.fills = [paint("#ff6b6b", 0.1)];
    logout.strokes = [paint("#ff6b6b", 0.2)];
    logout.strokeWeight = 1;
    constrain(logout, "MAX", "CENTER");
    const logoutIcon = makeLucideIcon("LogOut", "#ff6b6b");
    logoutIcon.resize(16, 16);
    add(logout, logoutIcon, 14, 8);
    const logoutLabel = await text("Вийти", 11, "SemiBold", "red", { lh:14 });
    logoutLabel.name = "Label";
    add(logout, logoutLabel, 38, 9);
    add(node, logout, 840, 12);
    placeRegistryComponent(page, node, x, y);
  }

  async function registryPageHeader(page: PageNode, x: number, y: number): Promise<void> {
    const node = getOrCreateRegistryComponent(page, "Layout/PageHeader", 960, 88);
    node.fills = [token("bg/surface")];
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    add(node, ellipse("Dot", 8, 8, "accent"), 24, 34);
    const title = await text("Дашборд", 15, "SemiBold", "text/primary", { lh:20, width:320 });
    title.name = "Title";
    add(node, title, 44, 24);
    const subtitle = await text("Огляд / Головна", 11, "Regular", "text/muted", { lh:14, width:320 });
    subtitle.name = "Subtitle";
    add(node, subtitle, 44, 48);

    const refreshComponent = findRegistryComponentOnPage(page, "Button/outline/md");
    if (refreshComponent) {
      const refresh = refreshComponent.createInstance();
      refresh.name = "SecondaryAction";
      constrain(refresh, "MAX", "CENTER");
      await applyComponentProps(refresh, { text:"Оновити" });
      add(node, refresh, 700, 28);
    }
    const primaryComponent = findRegistryComponentOnPage(page, "Button/primary/md");
    if (primaryComponent) {
      const addButton = primaryComponent.createInstance();
      addButton.name = "PrimaryAction";
      constrain(addButton, "MAX", "CENTER");
      await applyComponentProps(addButton, { text:"Додати укриття" });
      add(node, addButton, 844, 28);
    }
    placeRegistryComponent(page, node, x, y);
  }

  async function registryMetricCard(
    page: PageNode,
    id: "registry"|"readiness"|"verification"|"capacity",
    config: { title:string; eyebrow:string; value:string; delta:string; icon:string; accent:string },
    state: "default"|"hover"|"active"|"disabled",
    x: number,
    y: number,
  ): Promise<void> {
    const node = getOrCreateRegistryComponent(page, `Dashboard/MetricCard/${id}${state === "default" ? "" : `/${state}`}`, 360, 154);
    node.cornerRadius = 16;
    node.fills = [state === "hover" || state === "active" ? token("hover/md") : token("bg/surface")];
    node.strokes = [state === "active" ? paint(config.accent, 0.45) : stroke("border")];
    node.strokeWeight = 1;
    node.opacity = state === "disabled" ? 0.45 : 1;
    const accent = rect("Accent", 360, 2, config.accent, 0);
    constrain(accent, "STRETCH", "MIN");
    add(node, accent, 0, 0);

    const iconWell = frame("IconWell", 36, 36, "bg/surface-2");
    iconWell.cornerRadius = 10;
    iconWell.strokes = [stroke("border")];
    iconWell.strokeWeight = 1;
    const cardIcon = makeLucideIcon(config.icon, config.accent);
    cardIcon.resize(16, 16);
    add(iconWell, cardIcon, 10, 10);
    add(node, iconWell, 20, 20);

    const eyebrow = await text(config.eyebrow, 10, "SemiBold", "text/muted", { lh:12, width:220 });
    eyebrow.name = "Eyebrow";
    add(node, eyebrow, 20, 76);
    const title = await text(config.title, 15, "SemiBold", "text/primary", { lh:20, width:220 });
    title.name = "Title";
    add(node, title, 20, 96);
    const value = await text(config.value, 24, "Bold", "text/primary", { lh:28, width:140 });
    value.name = "Value";
    add(node, value, 20, 114);
    const delta = await text(config.delta, 11, "SemiBold", config.accent, { lh:14, width:160 });
    delta.name = "Delta";
    add(node, delta, 20, 138);

    const open = frame("OpenButton", 28, 28, "");
    open.cornerRadius = 8;
    open.strokes = [stroke("border")];
    open.strokeWeight = 1;
    constrain(open, "MAX", "MAX");
    const openIcon = makeLucideIcon("ChevronRight", TOKENS["text/muted"].hex);
    openIcon.resize(12, 12);
    add(open, openIcon, 8, 8);
    add(node, open, 312, 106);
    placeRegistryComponent(page, node, x, y);
  }

  async function registryActionCard(page: PageNode, key: string, state: "default"|"hover"|"active"|"disabled", x: number, y: number): Promise<void> {
    const node = getOrCreateRegistryComponent(page, key, 360, 92);
    node.cornerRadius = 14;
    node.fills = [state === "hover" || state === "active" ? token("hover/md") : token("bg/surface")];
    node.strokes = [state === "active" ? token("accent/25") : stroke("border")];
    node.strokeWeight = 1;
    node.opacity = state === "disabled" ? 0.45 : 1;
    const eyebrow = await text("Створити", 10, "SemiBold", "text/muted", { lh:12, width:300 });
    eyebrow.name = "Eyebrow";
    add(node, eyebrow, 20, 28);
    const title = await text("Нова заявка на укриття", 15, "SemiBold", "text/primary", { lh:20, width:300 });
    title.name = "Title";
    add(node, title, 20, 54);
    placeRegistryComponent(page, node, x, y);
  }

  function registryIcon(page: PageNode, name: string, x: number, y: number): void {
    const key = `Icon/${name}`;
    const node = getOrCreateRegistryComponent(page, key, 24, 24);
    node.fills = [];
    try {
      add(node, makeLucideIcon(name), 0, 0);
    } catch (_) {}
    placeRegistryComponent(page, node, x, y);
  }

  async function buildRegistryComponents(page: PageNode): Promise<void> {
    page.name = "🧱 Components";
    page.backgrounds = [paint("#0a0b0e")];
    await sectionTitle(page, "Registry components", 40, 40, "Реальні Figma Components з metadata. Importer шукає їх за componentKey і створює instances.");
    let errorY = 5600;

    async function safe(label: string, task: () => Promise<void>|void): Promise<void> {
      try {
        await task();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        add(page, await text(`Registry error · ${label}: ${message}`, 11, "Regular", "red", { lh:16, width:1180 }), 40, errorY);
        errorY += 22;
      }
    }

    await sectionTitle(page, "Buttons", 40, 110, "Для кожного variant/size генеруються default, hover, active, disabled і loading states.");
    const buttonVariants: ("primary"|"secondary"|"outline"|"ghost"|"danger")[] = ["primary", "secondary", "outline", "ghost", "danger"];
    const buttonSizes: ("sm"|"md"|"lg"|"icon")[] = ["sm", "md", "lg", "icon"];
    const buttonStates: ("default"|"hover"|"active"|"disabled"|"loading")[] = ["default", "hover", "active", "disabled", "loading"];
    for (let i=0; i<buttonVariants.length; i++) {
      const variant = buttonVariants[i];
      for (let s=0; s<buttonSizes.length; s++) {
        const size = buttonSizes[s];
        for (let st=0; st<buttonStates.length; st++) {
          const state = buttonStates[st];
          const key = state === "default" ? `Button/${variant}/${size}` : `Button/${variant}/${size}/${state}`;
          await safe(key, () => registryButton(page, key, variant, size, state, 40 + i * 190, 170 + s * 185 + st * 34));
        }
      }
    }

    await sectionTitle(page, "Forms", 40, 940, "Default, hover, focused, error і disabled для кожного form control.");
    const fieldKinds: Array<["Input"|"Search"|"Select"|"Textarea", string]> = [["Input", "Input"], ["Search", "Search"], ["Select", "Select"], ["Textarea", "Textarea"]];
    const fieldStates: ("default"|"hover"|"focused"|"error"|"disabled")[] = ["default", "hover", "focused", "error", "disabled"];
    for (let k=0; k<fieldKinds.length; k++) {
      const [kind, label] = fieldKinds[k];
      for (let st=0; st<fieldStates.length; st++) {
        const state = fieldStates[st];
        const key = `Form/${label}/${state}`;
        await safe(key, () => registryField(page, key, kind, state, 40 + k * 340, 1000 + st * 116));
      }
    }
    await sectionTitle(page, "Form patterns", 2760, 940, "Складені форми з auto layout grid, без дублювання label шарів при імпорті.");
    await safe("Form/RequestBasics", () => registryRequestBasicsForm(page, 2760, 1000));

    await sectionTitle(page, "Stepper", 1500, 940, "Wizard stepper з invalid, completed, active і pending станами.");
    await safe("Form/StepperStep/invalid", () => registryStepperStep(page, "Form/StepperStep/invalid", "invalid", "Основні", 1, 1500, 1000));
    await safe("Form/StepperStep/completed", () => registryStepperStep(page, "Form/StepperStep/completed", "completed", "Готовий", 2, 1660, 1000));
    await safe("Form/StepperStep/active", () => registryStepperStep(page, "Form/StepperStep/active", "active", "Активний", 3, 1820, 1000));
    await safe("Form/StepperStep/pending", () => registryStepperStep(page, "Form/StepperStep/pending", "pending", "Очікує", 4, 1980, 1000));
    await safe("Form/Stepper", () => registryStepper(page, 1500, 1060));

    await sectionTitle(page, "Tabs", 2060, 940, "Tab bar з item atoms, counts та default, hover, active, disabled states.");
    const tabStates: TabItemState[] = ["active", "default", "hover", "disabled"];
    for (let st=0; st<tabStates.length; st++) {
      const state = tabStates[st];
      await safe(`Navigation/TabItem/${state}`, () => registryTabItem(page, `Navigation/TabItem/${state}`, state, DEFAULT_TAB_LABELS[st], st === 0 ? 12 : st, 2060, 1000 + st * 48));
    }
    await safe("Navigation/TabBar", () => registryTabBar(page, 2060, 1220));
    for (let st=0; st<tabStates.length; st++) {
      const state = tabStates[st];
      await safe(`Navigation/SegmentedTabItem/${state}`, () => registrySegmentedTabItem(page, `Navigation/SegmentedTabItem/${state}`, state, st % 2 === 0 ? "2D" : "3D", st % 2 === 0 ? "Map" : "Box", 2380, 1000 + st * 66));
    }
    await safe("Navigation/SegmentedTabs", () => registrySegmentedTabs(page, 2380, 1290));

    await sectionTitle(page, "Badges & Cards", 40, 1600, "Badges мають tone states, cards мають default, hover, active і disabled.");
    const severities: ("ok"|"warning"|"danger"|"info"|"neutral")[] = ["ok", "warning", "danger", "info", "neutral"];
    const badgeStates: ("default"|"subtle"|"disabled")[] = ["default", "subtle", "disabled"];
    for (let i=0; i<severities.length; i++) {
      const severity = severities[i];
      for (let st=0; st<badgeStates.length; st++) {
        const state = badgeStates[st];
        const key = state === "default" ? `Badge/${severity}` : `Badge/${severity}/${state}`;
        await safe(key, () => registryBadge(page, key, severity, state, 40 + i * 150, 1650 + st * 34));
      }
    }
    const cardStates: ("default"|"hover"|"active"|"disabled")[] = ["default", "hover", "active", "disabled"];
    for (let st=0; st<cardStates.length; st++) {
      const state = cardStates[st];
      const key = state === "default" ? "Card/Base" : `Card/Base/${state}`;
      await safe(key, () => registryCard(page, key, state, 40 + st * 340, 1780));
    }
    await sectionTitle(page, "Dialogs", 1500, 1600, "Modal/dialog патерни з alert body та action buttons.");
    await safe("Dialog/ValidationWarning", () => registryDialog(page, "Dialog/ValidationWarning", "warning", "default", 1500, 1660));
    await safe("Dialog/ValidationWarning/disabled", () => registryDialog(page, "Dialog/ValidationWarning/disabled", "warning", "disabled", 1500, 1880));
    await safe("Dialog/Alert/danger", () => registryDialog(page, "Dialog/Alert/danger", "danger", "default", 2060, 1660));
    await safe("Dialog/Alert/info", () => registryDialog(page, "Dialog/Alert/info", "info", "default", 2060, 1880));

    await sectionTitle(page, "Information tables", 3580, 1980, "Label-value info grid з секціями, divider та auto layout rows.");
    const infoFieldStates: InfoFieldState[] = ["default", "empty", "muted", "disabled"];
    for (let st=0; st<infoFieldStates.length; st++) {
      const state = infoFieldStates[st];
      const key = state === "default" ? "Data/InfoField/default" : `Data/InfoField/${state}`;
      await safe(key, () => registryInfoField(page, key, state, 3580, 2040 + st * 84));
    }
    await safe("Data/InfoTable", () => registryInfoTable(page, 3580, 2400));

    await sectionTitle(page, "Table system", 40, 1980, "Атоми клітинок, рядки default/hover/selected/disabled та повний auto layout table grid.");
    const tableCellDefs: Array<[string, "header"|"text"|"muted"|"twoLine"|"status"|"action"|"favorite"|"shelterName"]> = [
      ["Data/TableCell/header", "header"],
      ["Data/TableCell/text", "text"],
      ["Data/TableCell/twoLine", "twoLine"],
      ["Data/TableCell/status", "status"],
      ["Data/TableCell/action", "action"],
      ["Data/TableCell/muted", "muted"],
      ["Data/TableCell/favorite", "favorite"],
      ["Data/TableCell/shelterName", "shelterName"],
    ];
    const tableCellStates: ("default"|"hover"|"selected"|"disabled")[] = ["default", "hover", "selected", "disabled"];
    for (let i=0; i<tableCellDefs.length; i++) {
      const [baseKey, variant] = tableCellDefs[i];
      for (let st=0; st<tableCellStates.length; st++) {
        const state = tableCellStates[st];
        const key = state === "default" ? baseKey : `${baseKey}/${state}`;
        await safe(key, () => registryTableCell(page, key, variant, state, 40 + i * 200, 2040 + st * 96));
      }
    }
    await safe("Data/TableRow/header", () => registryTableRow(page, "Data/TableRow/header", true, "default", 40, 2440));
    const rowStates: ("default"|"hover"|"selected"|"disabled")[] = ["default", "hover", "selected", "disabled"];
    for (let st=0; st<rowStates.length; st++) {
      const state = rowStates[st];
      const key = state === "default" ? "Data/TableRow/default" : `Data/TableRow/${state}`;
      await safe(key, () => registryTableRow(page, key, false, state, 40, 2500 + st * 60));
    }
    await safe("Data/Table", () => registryDataTable(page, 40, 2760));
    await safe("Data/Table/Shelters", () => registryShelterDataTable(page, 1180, 2760));

    await sectionTitle(page, "Layout systems", 40, 3620, "Складені компоненти для shell, навігації та заголовків сторінки.");
    await safe("Layout/Logo", () => registryLogo(page, 40, 3680));
    await safe("Layout/UserFooter", () => registryUserFooter(page, 280, 3680));
    const navStates: ("active"|"default"|"hover"|"disabled")[] = ["active", "default", "hover", "disabled"];
    for (let st=0; st<navStates.length; st++) {
      const state = navStates[st];
      await safe(`Layout/NavItem/${state}`, () => registryNavItem(page, `Layout/NavItem/${state}`, state, 520 + st * 240, 3680));
    }
    await safe("Layout/Topbar", () => registryTopbar(page, 40, 3760));
    await safe("Layout/PageHeader", () => registryPageHeader(page, 40, 3840));
    await safe("Layout/Sidebar", () => registrySidebar(page, 1280, 3680));

    await sectionTitle(page, "Dashboard systems", 40, 3980, "Картки й блоки з default, hover, active і disabled states.");
    const metricConfigs: Array<["registry"|"readiness"|"verification"|"capacity", { title:string; eyebrow:string; value:string; delta:string; icon:string; accent:string }]> = [
      ["registry", { title:"Фонд укриттів", eyebrow:"РЕЄСТР", value:"5", delta:"+5 за місяць", icon:"Building2", accent:"#00e5a0" }],
      ["readiness", { title:"Готовність", eyebrow:"СТАН", value:"20%", delta:"1 в експлуатації", icon:"ShieldCheck", accent:"#60a5fa" }],
      ["verification", { title:"Верифікація", eyebrow:"ЗАЯВКИ", value:"8", delta:"6 нових заявок", icon:"ClipboardCheck", accent:"#f59e0b" }],
      ["capacity", { title:"Місткість", eyebrow:"РЕСУРС", value:"3 000", delta:"1 500 доступно", icon:"UsersRound", accent:"#6c63ff" }],
    ];
    for (let i=0; i<metricConfigs.length; i++) {
      const [id, config] = metricConfigs[i];
      for (let st=0; st<cardStates.length; st++) {
        const state = cardStates[st];
        await safe(`Dashboard/MetricCard/${id}${state === "default" ? "" : `/${state}`}`, () => registryMetricCard(page, id, config, state, 40 + i * 390, 4040 + st * 190));
      }
    }
    for (let st=0; st<cardStates.length; st++) {
      const state = cardStates[st];
      const key = state === "default" ? "Dashboard/ActionCard" : `Dashboard/ActionCard/${state}`;
      await safe(key, () => registryActionCard(page, key, state, 40 + st * 390, 4840));
    }

    await sectionTitle(page, "Icons", 40, 5000, "Кожна іконка також доступна як component: Icon/Name.");
    const cols = 16;
    for (let i=0; i<ICON_NAMES.length; i++) {
      const iconName = ICON_NAMES[i];
      await safe(`Icon/${iconName}`, () => registryIcon(page, iconName, 40 + (i % cols) * 56, 5060 + Math.floor(i / cols) * 56));
    }
  }

  async function makeButton(label: string, variant: "primary"|"secondary"|"outline"|"ghost"|"danger", size: "sm"|"md"|"lg"|"icon" = "md"): Promise<ComponentNode> {
    const metrics = {
      sm: { w:112, h:28, fs:11, radius:8 },
      md: { w:136, h:32, fs:12, radius:10 },
      lg: { w:156, h:36, fs:13, radius:10 },
      icon: { w:28, h:28, fs:13, radius:8 },
    }[size];
    const node = component(`Button/${variant}/${size}`, metrics.w, metrics.h);
    node.cornerRadius = metrics.radius;
    node.strokes = [stroke(variant === "primary" ? "accent/25" : variant === "danger" ? "red" : "border/strong")];
    node.strokeWeight = variant === "ghost" ? 0 : 1;
    const fillMap = {
      primary: token("accent"),
      secondary: token("hover/md"),
      outline: token("bg/surface"),
      ghost: paint("#ffffff", 0),
      danger: paint("#ff6b6b", 0.1),
    };
    node.fills = [fillMap[variant]];
    const fg = variant === "primary" ? "#051a12" : variant === "danger" ? "red" : variant === "ghost" ? "text/secondary" : "text/primary";
    const labelNode = await text(size === "icon" ? "↗" : label, metrics.fs, "SemiBold", fg, { lh:metrics.fs + 4, align:"CENTER" });
    labelNode.textAutoResize = "HEIGHT";
    labelNode.resize(metrics.w - 24, metrics.h);
    add(node, labelNode, size === "icon" ? 8 : 12, Math.round((metrics.h - labelNode.height) / 2));
    return node;
  }

  async function makeBadge(name: string, label: string, severity: "ok"|"warning"|"danger"|"info"|"neutral", dot=true): Promise<ComponentNode> {
    const color = { ok:"accent", warning:"amber", danger:"red", info:"blue", neutral:"text/secondary" }[severity];
    const fillColor = { ok:"#00e5a0", warning:"#f59e0b", danger:"#ff6b6b", info:"#60a5fa", neutral:"#ffffff" }[severity];
    const borderOpacity = severity === "neutral" ? 0.1 : 0.25;
    const node = component(`Badge/${name}`, 120, 24);
    node.cornerRadius = 8;
    node.fills = [paint(fillColor, severity === "neutral" ? 0.05 : 0.1)];
    node.strokes = [paint(fillColor, borderOpacity)];
    node.strokeWeight = 1;
    let labelX = 10;
    if (dot) {
      add(node, ellipse("Dot", 6, 6, color), 10, 9);
      labelX = 22;
    }
    const labelNode = await text(label, 11, "SemiBold", color, { lh:14 });
    add(node, labelNode, labelX, 5);
    node.resize(labelNode.width + labelX + 10, 24);
    return node;
  }

  async function makeField(kind: "Input"|"Select"|"Textarea"|"Search", label: string, value: string, state: "default"|"focused"|"error" = "default"): Promise<ComponentNode> {
    const h = kind === "Textarea" ? 96 : kind === "Search" ? 32 : 58;
    const node = component(`Form/${kind}/${state}`, kind === "Textarea" ? 320 : 280, h);
    node.fills = [];
    let fieldY = 0;
    if (kind !== "Search") {
      add(node, await text(label.toUpperCase(), 11, "Medium", "text/secondary", { lh:14 }), 0, 0);
      fieldY = 20;
    }
    const field = frame(`${kind}/Field`, node.width, kind === "Textarea" ? 72 : 32, "bg/surface-2");
    field.cornerRadius = 10;
    field.strokes = [state === "error" ? paint("#ff6b6b", 0.5) : state === "focused" ? token("accent") : stroke("border/strong")];
    field.strokeWeight = 1;
    add(node, field, 0, fieldY);
    const copy = await text(value, 13, "Regular", state === "error" ? "red" : "text/primary", { lh:18, width:node.width - 28 });
    add(field, copy, kind === "Search" ? 36 : 12, kind === "Textarea" ? 10 : 7);
    if (kind === "Search") add(field, await text("⌕", 13, "Regular", "text/muted", { lh:16 }), 12, 8);
    if (kind === "Select") add(field, await text("⌄", 13, "Medium", "text/secondary", { lh:16 }), node.width - 24, 8);
    if (state === "error") add(node, await text("Обов'язкове поле", 11, "Regular", "red", { lh:14 }), 0, fieldY + field.height + 5);
    return node;
  }

  async function makeCheckbox(checked: boolean): Promise<ComponentNode> {
    const node = component(`Control/Checkbox/${checked ? "checked" : "empty"}`, 124, 24);
    node.fills = [];
    const box = frame("Box", 16, 16, checked ? "accent" : "bg/surface");
    box.cornerRadius = 4;
    box.strokes = [checked ? token("accent") : stroke("border/strong")];
    box.strokeWeight = 1;
    add(node, box, 0, 4);
    if (checked) add(box, await text("✓", 10, "Bold", "#051a12", { lh:12, align:"CENTER" }), 4, 1);
    add(node, await text(checked ? "Обрано" : "Не обрано", 12, "Regular", "text/secondary", { lh:16 }), 24, 4);
    return node;
  }

  async function makeToggle(checked: boolean): Promise<ComponentNode> {
    const node = component(`Control/Toggle/${checked ? "on" : "off"}`, 126, 24);
    node.fills = [];
    const track = frame("Track", 36, 20, checked ? "accent" : "border/strong");
    track.cornerRadius = 999;
    add(node, track, 0, 2);
    add(track, ellipse("Thumb", 16, 16, "#ffffff"), checked ? 18 : 2, 2);
    add(node, await text(checked ? "Увімкнено" : "Вимкнено", 12, "Regular", "text/secondary", { lh:16 }), 46, 4);
    return node;
  }

  async function makeCard(): Promise<ComponentNode> {
    const node = component("Card/Base", 300, 148, "bg/surface");
    node.cornerRadius = 12;
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    add(node, rect("Accent", 300, 2, "accent", 0), 0, 0);
    add(node, await text("Фонд укриттів", 15, "SemiBold", "text/primary", { lh:20 }), 16, 18);
    add(node, await text("Оперативний стан області", 12, "Regular", "text/secondary", { lh:16, width:240 }), 16, 42);
    add(node, await text("1 248", 28, "Bold", "text/primary", { lh:32 }), 16, 80);
    add(node, await text("+12 за місяць", 11, "Medium", "accent", { lh:14 }), 16, 118);
    return node;
  }

  async function makeStatCard(name: string, value: string, label: string, accent: string): Promise<ComponentNode> {
    const node = component(`StatCard/${name}`, 220, 124, "bg/surface");
    node.cornerRadius = 12;
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    add(node, rect("Accent", 220, 2, accent, 0), 0, 0);
    add(node, await text(label.toUpperCase(), 10, "SemiBold", "text/muted", { lh:14 }), 16, 18);
    add(node, await text(value, 24, "Bold", "text/primary", { lh:28 }), 16, 48);
    add(node, await text("актуально зараз", 11, "Regular", "text/secondary", { lh:14 }), 16, 88);
    return node;
  }

  async function makePageHeader(): Promise<ComponentNode> {
    const node = component("Layout/PageHeader", 760, 74, "bg/surface");
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    add(node, ellipse("Dot", 8, 8, "accent"), 24, 28);
    add(node, await text("Список укриттів", 15, "SemiBold", "text/primary", { lh:20 }), 44, 18);
    add(node, await text("Облік / Реєстр", 11, "Regular", "text/muted", { lh:14 }), 44, 42);
    const refresh = await makeButton("Оновити", "outline", "md");
    add(node, refresh, 552, 20);
    const addButton = await makeButton("+ Додати", "primary", "md");
    add(node, addButton, 660, 20);
    return node;
  }

  async function makeTable(): Promise<ComponentNode> {
    const node = component("Data/Table", 760, 234, "bg/surface");
    node.cornerRadius = 12;
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    const cols = [
      { label:"НАЗВА", x:18, w:190 },
      { label:"ТИП", x:224, w:90 },
      { label:"СТАТУС", x:328, w:130 },
      { label:"МІСТКІСТЬ", x:478, w:110 },
      { label:"АДРЕСА", x:600, w:140 },
    ];
    for (const col of cols) add(node, await text(col.label, 10, "SemiBold", "text/secondary", { lh:14, width:col.w }), col.x, 16);
    divider(node, 0, 43, 760);
    const rows = [
      ["Ліцей №4", "Стац.", "Експлуатація", "420", "вул. Центральна, 12"],
      ["Метро Університет", "Стац.", "Модернізація", "1200", "просп. Науки, 8"],
      ["Мобільний модуль 07", "Моб.", "Потреба", "80", "Черкаський район"],
    ];
    for (let r=0; r<rows.length; r++) {
      const y = 54 + r * 56;
      add(node, rect(`Row/${r}`, 760, 56, r === 1 ? "hover/md" : "bg/surface", 0), 0, y - 10);
      add(node, await text(rows[r][0], 12, "Medium", "text/primary", { lh:16, width:180 }), 18, y);
      add(node, await makeBadge(`Type/${r}`, rows[r][1], rows[r][1] === "Моб." ? "info" : "neutral", false), 224, y - 3);
      add(node, await makeBadge(`Status/${r}`, rows[r][2], r === 0 ? "ok" : r === 1 ? "info" : "warning", true), 328, y - 3);
      add(node, await text(rows[r][3], 12, "SemiBold", "text/primary", { lh:16 }), 478, y);
      add(node, await text(rows[r][4], 12, "Regular", "text/secondary", { lh:16, width:140 }), 600, y);
      divider(node, 0, y + 33, 760);
    }
    return node;
  }

  async function makePagination(): Promise<ComponentNode> {
    const node = component("Data/Pagination", 360, 36);
    node.fills = [];
    add(node, await text("1-25 з 248", 11, "Regular", "text/muted", { lh:14 }), 0, 11);
    const labels = ["‹", "1", "2", "3", "…", "10", "›"];
    let x = 160;
    for (const label of labels) {
      const active = label === "1";
      const item = frame(`Page/${label}`, 28, 28, active ? "accent" : "");
      item.cornerRadius = 8;
      item.fills = active ? [token("accent")] : [];
      add(item, await text(label, 11, "SemiBold", active ? "#051a12" : "text/secondary", { lh:14, align:"CENTER" }), 8, 7);
      add(node, item, x, 4);
      x += 30;
    }
    return node;
  }

  async function makeCapacityBar(): Promise<ComponentNode> {
    const node = component("Data/CapacityBar", 180, 24);
    node.fills = [];
    add(node, await text("420", 12, "SemiBold", "text/primary", { lh:16 }), 0, 4);
    const track = rect("Track", 118, 3, "border", 999);
    add(node, track, 48, 11);
    add(node, rect("Value", 72, 3, "accent", 999), 48, 11);
    return node;
  }

  async function makeAlert(severity: "ok"|"warning"|"danger"|"info"|"neutral"): Promise<ComponentNode> {
    const color = { ok:"accent", warning:"amber", danger:"red", info:"blue", neutral:"text/secondary" }[severity];
    const fillColor = { ok:"#00e5a0", warning:"#f59e0b", danger:"#ff6b6b", info:"#60a5fa", neutral:"#ffffff" }[severity];
    const node = component(`Feedback/Alert/${severity}`, 420, 76);
    node.cornerRadius = 10;
    node.fills = [paint(fillColor, severity === "neutral" ? 0.04 : 0.08)];
    node.strokes = [paint(fillColor, severity === "neutral" ? 0.10 : 0.25)];
    node.strokeWeight = 1;
    add(node, ellipse("Icon", 16, 16, color), 14, 16);
    add(node, await text(severity === "danger" ? "Помилка валідації" : "Системне повідомлення", 12, "SemiBold", "text/primary", { lh:16 }), 42, 14);
    add(node, await text("Перевірте дані та повторіть дію.", 12, "Regular", "text/secondary", { lh:16, width:330 }), 42, 36);
    return node;
  }

  async function makeProgress(): Promise<ComponentNode> {
    const node = component("Feedback/Progress", 280, 24);
    node.fills = [];
    add(node, rect("Track", 230, 6, "border", 999), 0, 9);
    add(node, rect("Value", 168, 6, "accent", 999), 0, 9);
    add(node, await text("73%", 11, "SemiBold", "accent", { lh:14 }), 244, 5);
    return node;
  }

  async function makeSkeleton(): Promise<ComponentNode> {
    const node = component("Feedback/SkeletonRow", 360, 54);
    node.fills = [];
    for (let i=0; i<4; i++) {
      add(node, rect(`Skeleton/${i}`, [80, 116, 64, 132][i], 12, "#ffffff", 6), [0, 100, 236, 304][i], 21);
      (node.children[node.children.length - 1] as RectangleNode).opacity = 0.06;
    }
    return node;
  }

  async function makeCoverageIndicator(): Promise<ComponentNode> {
    const node = component("Map/CoverageIndicator", 280, 58);
    node.fills = [];
    add(node, await text("Покриття населення", 12, "Medium", "text/primary", { lh:16 }), 0, 0);
    add(node, await text("82%", 12, "Bold", "accent", { lh:16 }), 248, 0);
    add(node, rect("Track", 280, 3, "border", 999), 0, 24);
    add(node, rect("Value", 230, 3, "accent", 999), 0, 24);
    add(node, await text("у радіусі нормативної доступності", 10, "Regular", "text/muted", { lh:14 }), 0, 36);
    return node;
  }

  async function makeSidebar(): Promise<ComponentNode> {
    const node = component("Layout/Sidebar", 224, 620, "bg/surface");
    node.strokes = [stroke("border")];
    node.strokeWeight = 1;
    const logoBox = frame("Logo mark", 32, 32, "accent");
    logoBox.cornerRadius = 8;
    add(node, logoBox, 16, 20);
    add(logoBox, await text("Р", 13, "Bold", "#051a12", { lh:16, align:"CENTER" }), 11, 8);
    add(node, await text("Облік укриттів", 13, "SemiBold", "text/primary", { lh:16 }), 58, 21);
    add(node, await text("ДСНС України · v2.4", 10, "Regular", "text/muted", { lh:12 }), 58, 39);
    divider(node, 0, 72, 224);
    add(node, await text("ОГЛЯД", 10, "SemiBold", "text/ghost", { lh:12 }), 16, 92);
    const nav: [string, boolean, string][] = [
      ["Дашборд", true, ""],
      ["Мапа", false, ""],
      ["Список укриттів", false, ""],
      ["Пропозиції", false, "4"],
      ["Звіти", false, ""],
    ];
    for (let i=0; i<nav.length; i++) {
      const y = 114 + i * 42;
      if (nav[i][1]) {
        const active = frame("Nav active", 192, 34, "accent/10");
        active.cornerRadius = 10;
        active.strokes = [token("accent/15")];
        active.strokeWeight = 1;
        add(node, active, 16, y);
      }
      add(node, await text(nav[i][0], 12, nav[i][1] ? "Medium" : "Regular", nav[i][1] ? "accent" : "text/secondary", { lh:16 }), 42, y + 9);
      add(node, ellipse("Nav icon", 14, 14, nav[i][1] ? "accent" : "text/muted"), 22, y + 10);
      if (nav[i][2]) add(node, await makeBadge("NavBadge", nav[i][2], "warning", false), 174, y + 6);
    }
    divider(node, 16, 520, 192);
    add(node, ellipse("Avatar", 32, 32, "purple"), 16, 548);
    add(node, await text("Олена Коваль", 12, "Medium", "text/primary", { lh:16 }), 58, 550);
    add(node, await text("Регіональний адмін", 10, "Regular", "text/muted", { lh:12 }), 58, 568);
    return node;
  }

  async function makeAppShell(): Promise<ComponentNode> {
    const node = component("Layout/AppShell", 960, 540, "bg/base");
    node.clipsContent = true;
    const sidebar = await makeSidebar();
    sidebar.resize(224, 540);
    add(node, sidebar, 0, 0);
    const header = frame("Header", 736, 56, "bg/overlay");
    header.strokes = [stroke("border")];
    header.strokeWeight = 1;
    add(node, header, 224, 0);
    add(header, await text("Дашборд", 13, "SemiBold", "text/primary", { lh:16 }), 24, 12);
    add(header, await text("Сесія активна", 10, "Regular", "text/muted", { lh:12 }), 24, 32);
    add(header, await makeButton("Вийти", "danger", "sm"), 632, 14);
    const pageHeader = await makePageHeader();
    pageHeader.resize(736, 74);
    add(node, pageHeader, 224, 56);
    add(node, await makeStatCard("Shelters", "1 248", "Фонд укриттів", "accent"), 248, 154);
    add(node, await makeStatCard("Ready", "82%", "Готовність", "blue"), 484, 154);
    add(node, await makeStatCard("Requests", "24", "Заявки", "amber"), 720, 154);
    const table = await makeTable();
    table.resize(688, 220);
    add(node, table, 248, 300);
    return node;
  }

  async function makeStepper(): Promise<ComponentNode> {
    const node = component("Wizard/Stepper", 720, 58);
    node.fills = [];
    const labels = ["Основне", "Координати", "Стан", "Документи", "Перевірка"];
    for (let i=0; i<labels.length; i++) {
      const active = i === 1;
      const done = i === 0;
      const x = i * 142;
      const bubble = frame(`Step/${i + 1}`, 32, 32, active || done ? "accent" : "bg/surface-2");
      bubble.cornerRadius = 10;
      bubble.strokes = [active || done ? token("accent/25") : stroke("border/strong")];
      bubble.strokeWeight = 1;
      add(node, bubble, x, 0);
      add(bubble, await text(done ? "✓" : String(i + 1), 13, "Bold", active || done ? "#051a12" : "text/secondary", { lh:16, align:"CENTER" }), done ? 10 : 12, 8);
      add(node, await text(labels[i], 11, active ? "SemiBold" : "Regular", active ? "text/primary" : "text/secondary", { lh:14 }), x, 40);
      if (i < labels.length - 1) add(node, rect("Connector", 78, 2, done ? "accent" : "border", 999), x + 42, 15);
    }
    return node;
  }

  async function makeModal(): Promise<ComponentNode> {
    const node = component("Overlay/Modal", 520, 280, "bg/surface");
    node.cornerRadius = 16;
    node.strokes = [stroke("border/strong")];
    node.strokeWeight = 1;
    node.effects = [{ type:"DROP_SHADOW", color:{ r:0, g:0, b:0, a:0.55 }, offset:{ x:0, y:24 }, radius:80, spread:0, visible:true, blendMode:"NORMAL" }];
    add(node, await text("Підтвердити верифікацію", 18, "SemiBold", "text/primary", { lh:24 }), 24, 24);
    add(node, await text("Заявка отримає статус “Схвалена” і буде додана до реєстру укриттів.", 13, "Regular", "text/secondary", { lh:20, width:430 }), 24, 60);
    divider(node, 0, 196, 520);
    add(node, await makeButton("Скасувати", "secondary", "md"), 236, 220);
    add(node, await makeButton("Підтвердити", "primary", "md"), 364, 220);
    return node;
  }

  async function makeDropzone(): Promise<ComponentNode> {
    const node = component("Form/Dropzone", 360, 124, "bg/surface");
    node.cornerRadius = 12;
    node.strokes = [paint("#60a5fa", 0.25)];
    node.strokeWeight = 1;
    node.dashPattern = [8, 5];
    add(node, await text("Перетягни файл акта або фото", 13, "SemiBold", "text/primary", { lh:18, align:"CENTER", width:300 }), 30, 34);
    add(node, await text("PDF, JPG, PNG · до 10 МБ", 11, "Regular", "text/secondary", { lh:14, align:"CENTER", width:300 }), 30, 58);
    add(node, await makeButton("Обрати файл", "outline", "sm"), 124, 82);
    return node;
  }

  async function makeFloatingButton(): Promise<ComponentNode> {
    const node = component("Tool/FigmaCaptureButton", 220, 56);
    node.fills = [];
    const bubble = frame("Clipboard button", 48, 48, "accent");
    bubble.cornerRadius = 10;
    bubble.strokes = [token("accent/25")];
    bubble.strokeWeight = 1;
    add(node, bubble, 0, 4);
    add(bubble, await text("⧉", 20, "Bold", "#051a12", { lh:24, align:"CENTER" }), 14, 12);
    const toast = frame("Status toast", 158, 40, "bg/overlay");
    toast.cornerRadius = 10;
    toast.strokes = [stroke("border/strong")];
    toast.strokeWeight = 1;
    add(node, toast, 62, 8);
    add(toast, await text("Скопійовано 842 шари", 12, "Medium", "text/primary", { lh:16 }), 12, 12);
    return node;
  }

  async function buildTokens(page: PageNode): Promise<void> {
    page.name = "🎨 Tokens";
    page.backgrounds = [paint("#0a0b0e")];
    await sectionTitle(page, "Shelter UI tokens", 40, 40, "Палітри для темної та світлої теми. Темна тема відповідає поточним CSS custom properties, світла підготовлена як парна тема.");

    async function renderThemePanel(
      title: string,
      subtitle: string,
      themeTokens: Record<string, ColorToken>,
      x: number,
      y: number,
    ): Promise<void> {
      const cols = 4;
      const sw = 126;
      const sh = 88;
      const gap = 14;
      const panelW = 600;
      const panelH = 720;
      const entries = Object.entries(themeTokens);
      const panel = frame(title, panelW, panelH, themeTokens["bg/base"].hex);
      panel.cornerRadius = 18;
      panel.strokes = [tokenPaint(themeTokens["border/strong"])];
      panel.strokeWeight = 1;
      add(page, panel, x, y);
      add(panel, await text(title, 16, "SemiBold", themeTokens["text/primary"].hex, { lh:22 }), 24, 22);
      add(panel, await text(subtitle, 11, "Regular", themeTokens["text/secondary"].hex, { lh:16, width:panelW - 48 }), 24, 48);
      for (let i=0; i<entries.length; i++) {
        const [name, data] = entries[i];
        const cardX = 24 + (i % cols) * (sw + gap);
        const cardY = 88 + Math.floor(i / cols) * (sh + gap);
        const card = frame(name, sw, sh, themeTokens["bg/surface"].hex);
        card.cornerRadius = 12;
        card.strokes = [tokenPaint(themeTokens["border"])];
        card.strokeWeight = 1;
        add(panel, card, cardX, cardY);
        add(card, rect("Swatch", sw - 24, 34, data.hex, 8), 12, 12);
        const swatch = card.children[0] as RectangleNode;
        swatch.opacity = data.opacity ?? 1;
        add(card, await text(name, 10, "SemiBold", themeTokens["text/primary"].hex, { lh:12, width:sw - 24 }), 12, 54);
        add(card, await text(`${data.hex}${data.opacity ? ` · ${Math.round(data.opacity * 100)}%` : ""}`, 9, "Regular", themeTokens["text/muted"].hex, { lh:12 }), 12, 70);
      }
    }

    await renderThemePanel("Темна тема", "Source: packages/ui/src/ui-1/globals.css · :root", TOKENS, 40, 112);
    await renderThemePanel("Світла тема", "Парні значення для light mode з тими самими token names.", LIGHT_TOKENS, 680, 112);

    const typoY = 900;
    await sectionTitle(page, "Typography", 40, typoY);
    const scale = [
      ["Page title", "Список укриттів", 15, "SemiBold", "text/primary"],
      ["Section label", "ОГЛЯД", 10, "SemiBold", "text/ghost"],
      ["Body / table", "Ліцей №4 · вул. Центральна, 12", 12, "Regular", "text/secondary"],
      ["Metric", "1 248", 28, "Bold", "text/primary"],
      ["Mono ID", "6c6e5b1a-b176-464a", 12, "Regular", "text/secondary"],
    ] as const;
    for (let i=0; i<scale.length; i++) {
      const [label, sample, size, style, color] = scale[i];
      add(page, await text(label, 10, "Regular", "text/muted", { lh:14 }), 40, typoY + 44 + i * 66);
      add(page, await text(sample, size, style, color, { lh:Math.max(size + 6, 18), mono:label === "Mono ID" }), 40, typoY + 62 + i * 66);
    }
    await sectionTitle(page, "Radius / spacing", 520, typoY);
    const radii = [["sm", 6], ["md", 8], ["lg", 10], ["xl", 12], ["2xl", 16]];
    for (let i=0; i<radii.length; i++) {
      const [name, radiusValue] = radii[i];
      add(page, rect(`Radius/${name}`, 74, 40, "bg/surface-2", radiusValue as number), 520 + i * 92, typoY + 52);
      add(page, await text(`${name} ${radiusValue}px`, 10, "Regular", "text/secondary", { lh:14 }), 520 + i * 92, typoY + 100);
    }
  }

  async function buildIcons(page: PageNode): Promise<void> {
    page.name = "🔣 Icons";
    page.backgrounds = [paint("#0a0b0e")];
    await sectionTitle(
      page,
      "Project icons",
      40,
      40,
      `${ICON_NAMES.length} lucide-react іконок, які реально імпортуються в apps/frontend та packages/ui. SVG-геометрія взята з встановленого lucide-react@0.539.0.`,
    );

    const spec = frame("Icon usage spec", 430, 104, "bg/surface");
    spec.cornerRadius = 12;
    spec.strokes = [stroke("border")];
    spec.strokeWeight = 1;
    add(page, spec, 848, 40);
    add(spec, await text("Usage spec", 12, "SemiBold", "text/primary", { lh:16 }), 16, 14);
    add(spec, await text("24px viewport · 2px stroke · round caps/joins · color via currentColor/token", 11, "Regular", "text/secondary", { lh:16, width:360 }), 16, 38);
    add(spec, makeLucideIcon("ShieldCheck", TOKENS["accent"].hex), 374, 18);
    add(spec, makeLucideIcon("AlertTriangle", TOKENS["amber"].hex), 374, 58);

    const cols = 8;
    const tileW = 132;
    const tileH = 104;
    const gapX = 16;
    const gapY = 18;
    const startX = 40;
    const startY = 174;

    for (let i=0; i<ICON_NAMES.length; i++) {
      const x = startX + (i % cols) * (tileW + gapX);
      const y = startY + Math.floor(i / cols) * (tileH + gapY);
      add(page, await makeIconTile(ICON_NAMES[i]), x, y);
    }
  }

  async function buildPrimitives(page: PageNode): Promise<void> {
    page.name = "🧩 Primitives";
    await sectionTitle(page, "Buttons", 40, 40, "Button variants з packages/ui/src/ui-1/Button.tsx");
    const variants: ("primary"|"secondary"|"outline"|"ghost"|"danger")[] = ["primary", "secondary", "outline", "ghost", "danger"];
    for (let i=0; i<variants.length; i++) {
      await caption(page, variants[i], 40 + i * 156, 104);
      add(page, await makeButton(variants[i] === "danger" ? "Видалити" : variants[i] === "primary" ? "Додати" : "Оновити", variants[i], "md"), 40 + i * 156, 124);
    }
    await sectionTitle(page, "Badges", 40, 190, "Severity badges і shelter-specific status badges.");
    const badges = [
      ["ShelterStatus/OPERATION", "Експлуатація", "ok"],
      ["ShelterStatus/NEED", "Потреба", "warning"],
      ["Application/APPROVED", "Схвалена", "ok"],
      ["Application/REJECTED", "Відхилена", "danger"],
      ["Type/MOBILE", "Мобільне", "info"],
      ["Neutral", "Новий", "neutral"],
    ] as const;
    let bx = 40;
    for (const [name, label, severity] of badges) {
      await caption(page, name, bx, 250);
      const badge = await makeBadge(name, label, severity, true);
      add(page, badge, bx, 270);
      bx += Math.max(150, badge.width + 28);
    }
    await sectionTitle(page, "Form controls", 40, 350, "Input, Select, Textarea, SearchInput, Checkbox, Toggle.");
    add(page, await makeField("Input", "Назва укриття", "Ліцей №4", "default"), 40, 420);
    add(page, await makeField("Input", "ЄДРПОУ", "Поле з помилкою", "error"), 350, 420);
    add(page, await makeField("Select", "Тип укриття", "Стаціонарне", "default"), 660, 420);
    add(page, await makeField("Search", "", "Пошук за адресою", "default"), 40, 514);
    add(page, await makeField("Textarea", "Опис", "Укриття на цокольному поверсі будівлі.", "focused"), 350, 514);
    add(page, await makeCheckbox(true), 40, 586);
    add(page, await makeCheckbox(false), 180, 586);
    add(page, await makeToggle(true), 350, 626);
    add(page, await makeToggle(false), 510, 626);
  }

  async function buildDataAndCards(page: PageNode): Promise<void> {
    page.name = "🗂 Data & Cards";
    await sectionTitle(page, "Cards", 40, 40, "Card, StatCard, PageHeader та Empty/Metric patterns.");
    add(page, await makeCard(), 40, 110);
    add(page, await makeStatCard("Shelters", "1 248", "Фонд укриттів", "accent"), 370, 110);
    add(page, await makeStatCard("Ready", "82%", "Готовність", "blue"), 610, 110);
    add(page, await makePageHeader(), 40, 292);
    await sectionTitle(page, "Table", 40, 410, "Table, Pagination і CapacityBar з packages/ui/src/ui-1/Table.tsx.");
    add(page, await makeTable(), 40, 470);
    add(page, await makePagination(), 40, 724);
    add(page, await makeCapacityBar(), 460, 728);
    await sectionTitle(page, "Feedback", 40, 790, "Alert, Progress, Skeleton, CoverageIndicator.");
    add(page, await makeAlert("info"), 40, 850);
    add(page, await makeAlert("danger"), 490, 850);
    add(page, await makeProgress(), 40, 950);
    add(page, await makeSkeleton(), 360, 936);
    add(page, await makeCoverageIndicator(), 40, 1000);
  }

  async function buildPatterns(page: PageNode): Promise<void> {
    page.name = "🏗 App Patterns";
    await sectionTitle(page, "Application shell", 40, 40, "Глобальний AppShell: Sidebar, Header, PageHeader, cards і таблиця.");
    add(page, await makeAppShell(), 40, 110);
    await sectionTitle(page, "Workflow patterns", 40, 700, "Форми заявок, модальні дії, dropzone і floating capture button.");
    add(page, await makeStepper(), 40, 770);
    add(page, await makeModal(), 40, 870);
    add(page, await makeDropzone(), 600, 870);
    add(page, await makeFloatingButton(), 600, 1024);
  }

  await preload();
  await ensureAllPagesLoaded();
  const builders: Array<{ name:string; build:(page: PageNode) => Promise<void>; preserveComponents?: boolean }> = [
    { name:"🎨 Tokens", build:buildTokens },
    { name:"🔣 Icons", build:buildIcons },
    { name:"🧱 Components", build:buildRegistryComponents, preserveComponents:true },
    { name:"🧩 Primitives", build:buildPrimitives },
    { name:"🗂 Data & Cards", build:buildDataAndCards },
    { name:"🏗 App Patterns", build:buildPatterns },
  ];

  function findPageByName(name: string): PageNode|null {
    return (figma.root.children.find((page) => page.name === name) as PageNode|undefined) ?? null;
  }

  function getOrCreateDesignSystemPage(name: string): PageNode {
    const existing = findPageByName(name);
    if (existing) return existing;
    const page = figma.createPage();
    page.name = name;
    return page;
  }

  const pages = builders.map(({ name }) => getOrCreateDesignSystemPage(name));
  const tokenIndex = await getTokenBindingIndex();
  let variableBindings = 0;
  let variableBindingFailed = false;

  for (let i=0; i<builders.length; i++) {
    await figma.setCurrentPageAsync(pages[i]);
    for (const child of [...pages[i].children]) {
      if (builders[i].preserveComponents && child.type === "COMPONENT") continue;
      child.remove();
    }
    await builders[i].build(pages[i]);
    for (const child of pages[i].children) {
      const result = await safeBindNodeToTokenVariables(child, tokenIndex);
      variableBindings += result.count;
      variableBindingFailed = variableBindingFailed || result.failed;
    }
  }

  await figma.setCurrentPageAsync(pages[2]);
  figma.viewport.scrollAndZoomIntoView(pages[2].children);
  figma.notify(`Shelter Design System — готово. Variables: ${variableBindings}${variableBindingFailed ? " · частково пропущено" : ""}`, { timeout:5000 });
  figma.closePlugin();
}

async function _runLegacyDesignSystem(): Promise<void> {

  const COLORS: Record<string, ColorToken> = {
    "brand/blue":        { hex:"#2b7fff", group:"Brand" },
    "brand/blue-light":  { hex:"#eff6ff", group:"Brand" },
    "brand/blue-mid":    { hex:"#bedbff", group:"Brand" },
    "brand/blue-dark":   { hex:"#457dcf", group:"Brand" },
    "text/primary":      { hex:"#0a0a0a", group:"Text" },
    "text/heading":      { hex:"#101828", group:"Text" },
    "text/secondary":    { hex:"#4a5565", group:"Text" },
    "text/muted":        { hex:"#6a7282", group:"Text" },
    "text/placeholder":  { hex:"#737373", group:"Text" },
    "text/disabled":     { hex:"#717182", group:"Text" },
    "neutral/border":    { hex:"#e5e7eb", group:"Neutral" },
    "neutral/divider":   { hex:"#e5e5e5", group:"Neutral" },
    "neutral/subtle":    { hex:"#bcbcbc", group:"Neutral" },
    "neutral/bg":        { hex:"#ececf0", group:"Neutral" },
    "neutral/input":     { hex:"#f3f3f5", group:"Neutral" },
    "neutral/surface":   { hex:"#f5f5f5", group:"Neutral" },
    "neutral/page":      { hex:"#f9fafb", group:"Neutral" },
    "neutral/white-off": { hex:"#fafafa", group:"Neutral" },
    "neutral/white":     { hex:"#ffffff", group:"Neutral" },
    "success/text":      { hex:"#00a63e", group:"Success" },
    "success/bg":        { hex:"#e6f9ef", group:"Success" },
    "success/green":     { hex:"#34c759", group:"Success" },
    "danger/red":        { hex:"#dc2626", group:"Danger" },
    "danger/red-deep":   { hex:"#fb2c36", group:"Danger" },
    "danger/red-brand":  { hex:"#d4183d", group:"Danger" },
    "warning/text":      { hex:"#d08700", group:"Warning" },
    "warning/bg":        { hex:"#fff3e0", group:"Warning" },
    "info/bg":           { hex:"#e3f2fd", group:"Info" },
    "purple/text":       { hex:"#ad46ff", group:"Purple" },
    "purple/bg":         { hex:"#faf5ff", group:"Purple" },
    "purple/border":     { hex:"#e9d4ff", group:"Purple" },
  };

  const loadedFontsDS = new Set<string>();

  async function loadFont(family: string, style: string): Promise<void> {
    const key = `${family}:${style}`;
    if (loadedFontsDS.has(key)) return;
    try { await figma.loadFontAsync({ family, style }); loadedFontsDS.add(key); }
    catch (_) { try { await figma.loadFontAsync({ family:"Inter", style:"Regular" }); } catch (__) {} }
  }

  async function preloadDS(): Promise<void> {
    const fonts: [string,string][] = [["Inter","Regular"],["Inter","Medium"],["Inter","SemiBold"],["Inter","Bold"],["Courier New","Regular"]];
    for (const [f,s] of fonts) { try { await figma.loadFontAsync({family:f,style:s}); loadedFontsDS.add(`${f}:${s}`); } catch(_){} }
  }

  function hexRGB(h: string): RGB {
    const c = h.replace("#","");
    return { r:parseInt(c.slice(0,2),16)/255, g:parseInt(c.slice(2,4),16)/255, b:parseInt(c.slice(4,6),16)/255 };
  }
  function fill(hex: string, opacity=1): SolidPaint { return { type:"SOLID", color:hexRGB(hex), opacity }; }
  function borderPaint(opacity=0.1): SolidPaint { return { type:"SOLID", color:{r:0,g:0,b:0}, opacity }; }

  function fr(name: string, w: number, h: number, fillHex=""): FrameNode {
    const f=figma.createFrame(); f.name=name; f.resize(w,h);
    f.fills=fillHex?[fill(fillHex)]:[];  f.clipsContent=false; return f;
  }
  function rc(w: number, h: number, fillHex: string, radius=0): RectangleNode {
    const r=figma.createRectangle(); r.resize(w,h); r.fills=[fill(fillHex)]; r.cornerRadius=radius; return r;
  }
  function div(parent: FrameNode, x: number, y: number, w: number, color="#e5e5e5"): void {
    const r=rc(w,1,color); r.x=x; r.y=y; parent.appendChild(r);
  }

  async function t(
    content: string, size: number, style: string, colorHex: string,
    opts: { family?:string; ls?:number; lh?:number; align?:"LEFT"|"RIGHT"|"CENTER" } = {}
  ): Promise<TextNode> {
    const family=opts.family||"Inter";
    await loadFont(family,style);
    const node=figma.createText();
    try { node.fontName={family,style}; } catch(_){ node.fontName={family:"Inter",style:"Regular"}; }
    node.fontSize=size; node.characters=content; node.fills=[fill(colorHex)];
    if (opts.ls!=null) node.letterSpacing={value:opts.ls,unit:"PIXELS"};
    if (opts.lh!=null) node.lineHeight={value:opts.lh,unit:"PIXELS"};
    if (opts.align) node.textAlignHorizontal=opts.align;
    return node;
  }

  async function cap(parent: FrameNode|PageNode, label: string, x: number, y: number): Promise<void> {
    const node=await t(label,10,"Regular","#999999"); node.x=x; node.y=y; parent.appendChild(node);
  }

  async function makeButton(label: string, bgHex: string, textHex: string, w=160): Promise<FrameNode> {
    const btn=fr("Button",w,40,bgHex); btn.cornerRadius=8;
    const lbl=await t(label,14,"Medium",textHex,{ls:-0.15,lh:20});
    lbl.x=Math.round((w-lbl.width)/2); lbl.y=10; btn.appendChild(lbl); return btn;
  }
  async function makeBadge(label: string, bgHex: string, textHex: string): Promise<FrameNode> {
    const badge=fr("Badge",10,28,bgHex); badge.cornerRadius=8;
    badge.strokes=[borderPaint(0.1)]; badge.strokeWeight=1;
    const lbl=await t(label,12,"Medium",textHex,{ls:-0.15,lh:16});
    lbl.x=10; lbl.y=6; badge.appendChild(lbl); badge.resize(lbl.width+20,28); return badge;
  }
  async function makeTag(label: string, bgHex: string, textHex: string): Promise<FrameNode> {
    const tag=fr("Tag",10,24,bgHex); tag.cornerRadius=6;
    const lbl=await t(label,12,"Medium",textHex,{ls:-0.15,lh:16});
    lbl.x=8; lbl.y=4; tag.appendChild(lbl); tag.resize(lbl.width+16,24); return tag;
  }
  async function makeInput(placeholder: string, w=280, withLabel=""): Promise<FrameNode> {
    const wrap=fr("Input",w,withLabel?60:44); wrap.fills=[];
    if (withLabel) {
      const lbl=await t(withLabel,11,"Regular","#4a5565",{ls:-0.15,lh:16}); lbl.x=0; lbl.y=0; wrap.appendChild(lbl);
      const field=fr("Field",w,40,"#f3f3f5"); field.cornerRadius=8; field.x=0; field.y=18;
      const ph=await t(placeholder,14,"Regular","#737373",{ls:-0.15,lh:20}); ph.x=12; ph.y=10; field.appendChild(ph); wrap.appendChild(field);
    } else {
      const field=fr("Field",w,44,"#f3f3f5"); field.cornerRadius=8;
      const ph=await t(placeholder,14,"Regular","#737373",{ls:-0.15,lh:20}); ph.x=12; ph.y=12; field.appendChild(ph); wrap.appendChild(field);
    }
    return wrap;
  }
  async function makeStepIndicator(num: number, state: "active"|"done"|"inactive"): Promise<FrameNode> {
    const colors={active:"#2b7fff",done:"#030213",inactive:"#ececf0"};
    const txtColors={active:"#ffffff",done:"#ffffff",inactive:"#717182"};
    const step=fr(`Step/${num}`,32,32,colors[state]); step.cornerRadius=10;
    const label=await t(String(num),14,state==="inactive"?"Medium":"SemiBold",txtColors[state]);
    label.x=num>=10?7:11; label.y=7; step.appendChild(label); return step;
  }
  async function makeTableRow(cells: string[], isHeader=false): Promise<FrameNode> {
    const colW=[40,120,100,80,80,80,100];
    const totalW=colW.reduce((a,b)=>a+b,0)+24;
    const row=fr(isHeader?"Table/Header":"Table/Row",totalW,isHeader?40:52,isHeader?"#f9fafb":"#ffffff");
    if (!isHeader) { row.strokes=[{type:"SOLID",color:hexRGB("#e5e7eb"),opacity:1}]; row.strokeAlign="INSIDE"; row.strokeWeight=1; }
    let x=16;
    for (let i=0;i<cells.length;i++) {
      const cell=await t(cells[i],isHeader?12:14,isHeader?"Medium":"Regular",isHeader?"#737373":"#0a0a0a",{ls:-0.15,lh:isHeader?16:20});
      cell.x=x; cell.y=isHeader?12:16; row.appendChild(cell); x+=colW[i]||100;
    }
    return row;
  }

  async function buildColors(page: PageNode): Promise<void> {
    page.name="🎨 Кольори";
    const entries=Object.entries(COLORS);
    const SW=72,SH=52,GAP=12,COLS=7;
    const rows=Math.ceil(entries.length/COLS);
    const W=COLS*(SW+GAP)+GAP+32, H=rows*(SH+44)+80;
    const canvas=fr("Color Palette",W,H,"#ffffff"); canvas.cornerRadius=14;
    canvas.strokes=[borderPaint(0.08)]; canvas.strokeWeight=1; canvas.x=40; canvas.y=40; page.appendChild(canvas);
    const heading=await t("Кольорова палітра",20,"SemiBold","#030213",{ls:-0.44,lh:28}); heading.x=24; heading.y=20; canvas.appendChild(heading);
    const sub=await t(`${entries.length} токенів · 8 груп`,12,"Regular","#717182"); sub.x=24; sub.y=52; canvas.appendChild(sub);
    for (let i=0;i<entries.length;i++) {
      const [name,token]=entries[i];
      const col=i%COLS, row=Math.floor(i/COLS);
      const gx=16+GAP+col*(SW+GAP), gy=76+row*(SH+44);
      const g=fr(name,SW,SH+36); g.x=gx; g.y=gy; canvas.appendChild(g);
      const s=rc(SW,SH,token.hex,8); s.strokes=[borderPaint(0.08)]; s.strokeWeight=1; g.appendChild(s);
      const nameNode=await t(name.split("/")[1],9,"Medium","#0a0a0a"); nameNode.x=0; nameNode.y=SH+4; nameNode.resize(SW,12); g.appendChild(nameNode);
      const hexNode=await t(token.hex,8,"Regular","#717182"); hexNode.x=0; hexNode.y=SH+18; hexNode.resize(SW,12); g.appendChild(hexNode);
    }
  }

  async function buildTypography(page: PageNode): Promise<void> {
    page.name="📝 Типографіка";
    const canvas=fr("Typography",960,1100,"#ffffff"); canvas.cornerRadius=14;
    canvas.strokes=[borderPaint(0.08)]; canvas.strokeWeight=1; canvas.x=40; canvas.y=40; page.appendChild(canvas);
    const heading=await t("Типографіка",20,"SemiBold","#030213",{ls:-0.44,lh:28}); heading.x=32; heading.y=28; canvas.appendChild(heading);
    const scale=[
      {label:"Display / SemiBold 24",sample:"Єдиний державний реєстр транспортних засобів",size:24,style:"SemiBold",color:"#0a0a0a",ls:-0.44,lh:32},
      {label:"Heading 1 / SemiBold 20",sample:"Список транспортних засобів",size:20,style:"SemiBold",color:"#101828",ls:-0.44,lh:28},
      {label:"Heading 2 / SemiBold 18",sample:"Постановка ТЗ на комісію",size:18,style:"SemiBold",color:"#0a0a0a",ls:-0.44,lh:27},
      {label:"Heading 3 / Medium 16",sample:"Загальна інформація про транспортний засіб",size:16,style:"Medium",color:"#0a0a0a",ls:-0.31,lh:24},
      {label:"Body / Medium 14",sample:"Toyota Camry · 2024 · Silver · $28 500",size:14,style:"Medium",color:"#0a0a0a",ls:-0.15,lh:20},
      {label:"Body / Regular 14",sample:"Марка: / Модель: / Рік: / Колір: / Пробіг:",size:14,style:"Regular",color:"#4a5565",ls:-0.15,lh:20},
      {label:"Body / Regular 16",sample:"Примітки до транспортного засобу",size:16,style:"Regular",color:"#6a7282",ls:-0.31,lh:24},
      {label:"Caption / Regular 12",sample:"Оновлено 01.04.2024 · №ТЗ-20240401-001",size:12,style:"Regular",color:"#737373",ls:-0.15,lh:16},
      {label:"Mono / VIN 14",sample:"1HGBH41JXMN109186",size:14,style:"Regular",color:"#0a0a0a",ls:0,lh:20,family:"Courier New"},
    ];
    let y=72;
    for (const item of scale) {
      const lbl=await t(item.label,10,"Regular","#999999"); lbl.x=32; lbl.y=y; canvas.appendChild(lbl);
      const opts: { family?:string; ls:number; lh:number }={ls:item.ls,lh:item.lh};
      if ((item as {family?:string}).family) opts.family=(item as {family?:string}).family;
      const sample=await t(item.sample,item.size,item.style,item.color,opts);
      sample.x=32; sample.y=y+16; canvas.appendChild(sample);
      div(canvas,32,y+item.lh+28,896); y+=item.lh+52;
    }
  }

  async function buildBasicComponents(page: PageNode): Promise<void> {
    page.name="🧩 Базові компоненти";
    let y=40;
    async function section(title: string): Promise<void> {
      const lbl=await t(title,13,"SemiBold","#030213",{ls:-0.15,lh:18}); lbl.x=40; lbl.y=y; page.appendChild(lbl); y+=28;
    }
    await section("Кнопки");
    const btnDefs:[string,string,string,string][]=[
      ["Primary","Підтвердити","#2b7fff","#ffffff"],["Dark","Зберегти","#030213","#ffffff"],
      ["Secondary","Скасувати","#f3f3f5","#0a0a0a"],["Danger","Видалити","#dc2626","#ffffff"],
      ["Ghost","Детальніше","#eff6ff","#2b7fff"],
    ];
    let bx=40;
    for (const [name,label,bg,fg] of btnDefs) {
      await cap(page,name,bx,y); const btn=await makeButton(label,bg,fg); btn.x=bx; btn.y=y+16; page.appendChild(btn); bx+=btn.width+16;
    }
    y+=76;
    await cap(page,"Розміри кнопок",40,y); y+=16;
    const sizes:[string,number,number][]=[["SM · h32",32,12],["MD · h40",40,14],["LG · h48",48,16]];
    let sx=40;
    for (const [label,h,fs] of sizes) {
      const btn=fr(`Btn/${label}`,120,h,"#2b7fff"); btn.cornerRadius=8; btn.x=sx; btn.y=y; page.appendChild(btn);
      const lbl=await t(label,fs,"Medium","#ffffff"); lbl.x=12; lbl.y=Math.round((h-fs*1.4)/2); btn.appendChild(lbl); sx+=136;
    }
    y+=72;
    await section("Бейджі / Статуси");
    const badgeDefs:[string,string,string,string][]=[
      ["Нереалізовано","#e6f9ef","#00a63e","Success"],["Реалізовано","#fde8ec","#d4183d","Danger"],
      ["В обробці","#fff3e0","#d08700","Warning"],["На перевірці","#eff6ff","#2b7fff","Info"],
      ["Документ","#faf5ff","#ad46ff","Purple"],["Новий","#e3f2fd","#457dcf","Blue"],
    ];
    let bdx=40;
    for (const [label,bg,fg,name] of badgeDefs) {
      await cap(page,name,bdx,y); const badge=await makeBadge(label,bg,fg); badge.x=bdx; badge.y=y+16; page.appendChild(badge); bdx+=badge.width+12;
    }
    y+=64;
    await section("Теги / Чіпси");
    const tagDefs:[string,string,string][]=[["Toyota","#eff6ff","#2b7fff"],["2024","#f3f3f5","#0a0a0a"],["Бензин","#e6f9ef","#00a63e"],["Фізична особа","#faf5ff","#ad46ff"]];
    let tx2=40;
    for (const [label,bg,fg] of tagDefs) { const tag=await makeTag(label,bg,fg); tag.x=tx2; tag.y=y; page.appendChild(tag); tx2+=tag.width+8; }
    y+=48;
    await section("Кроки (Step Indicator)");
    const stepLabels=["Пошук авто","Перевірка по базі","Стан ТЗ","Дані комітента"];
    let stx=40;
    for (let i=0;i<4;i++) {
      const state=i===0?"active":i===1?"done":"inactive";
      const step=await makeStepIndicator(i+1,state as "active"|"done"|"inactive");
      step.x=stx; step.y=y+16; page.appendChild(step); await cap(page,stepLabels[i],stx,y); stx+=120;
    }
    y+=80;
    await section("Поля вводу");
    await cap(page,"Default",40,y);
    const inp1=await makeInput("Введіть держ. номер..."); inp1.x=40; inp1.y=y+16; page.appendChild(inp1);
    await cap(page,"З підписом",360,y);
    const inp2=await makeInput("Напр. Toyota Camry",280,"Марка та модель"); inp2.x=360; inp2.y=y+16; page.appendChild(inp2);
    await cap(page,"VIN (моноширинний)",680,y);
    const vinWrap=fr("VIN Input",240,60); vinWrap.fills=[]; vinWrap.x=680; vinWrap.y=y+16; page.appendChild(vinWrap);
    const vinLbl=await t("VIN-код",11,"Regular","#4a5565",{ls:-0.15,lh:16}); vinLbl.x=0; vinLbl.y=0; vinWrap.appendChild(vinLbl);
    const vinField=fr("VIN/Field",240,40,"#f3f3f5"); vinField.cornerRadius=8; vinField.x=0; vinField.y=18; vinWrap.appendChild(vinField);
    const vinVal=await t("1HGBH41JXMN109186",14,"Regular","#0a0a0a",{family:"Courier New",lh:20}); vinVal.x=12; vinVal.y=10; vinField.appendChild(vinVal);
    y+=96;
    await cap(page,"Dropdown / Select",40,y);
    const select=fr("Select",280,44,"#f3f3f5"); select.cornerRadius=8; select.x=40; select.y=y+16; page.appendChild(select);
    const selTxt=await t("Оберіть тип документу",14,"Regular","#737373",{ls:-0.15,lh:20}); selTxt.x=12; selTxt.y=12; select.appendChild(selTxt);
    y+=80;
    await section("Вкладки (Tabs)");
    const tabContainer=fr("Tabs",520,44,"#ffffff"); tabContainer.cornerRadius=14;
    tabContainer.strokes=[borderPaint(0.1)]; tabContainer.strokeWeight=1; tabContainer.x=40; tabContainer.y=y; page.appendChild(tabContainer);
    const tabs=["Всі ТЗ","Активні","Архів","Документи"];
    let tabX=4;
    for (let i=0;i<tabs.length;i++) {
      const isActive=i===0; const tab=fr(`Tab/${tabs[i]}`,120,36,isActive?"#030213":"");
      if (!isActive) tab.fills=[]; tab.cornerRadius=10; tab.x=tabX; tab.y=4; tabContainer.appendChild(tab);
      const tabLbl=await t(tabs[i],13,isActive?"Medium":"Regular",isActive?"#ffffff":"#737373",{ls:-0.15,lh:18});
      tabLbl.x=Math.round((120-tabLbl.width)/2); tabLbl.y=9; tab.appendChild(tabLbl); tabX+=124;
    }
    y+=72;
    await section("Чекбокс / Перемикач");
    const cbOn=rc(20,20,"#2b7fff",4); cbOn.x=40; cbOn.y=y; page.appendChild(cbOn);
    const cbOnLbl=await t("Активний",14,"Regular","#0a0a0a",{ls:-0.15,lh:20}); cbOnLbl.x=68; cbOnLbl.y=y; page.appendChild(cbOnLbl);
    const cbOff=rc(20,20,"#ffffff",4); cbOff.strokes=[{type:"SOLID",color:hexRGB("#e5e7eb"),opacity:1}]; cbOff.strokeWeight=1.5;
    cbOff.x=200; cbOff.y=y; page.appendChild(cbOff);
    const cbOffLbl=await t("Неактивний",14,"Regular","#737373",{ls:-0.15,lh:20}); cbOffLbl.x=228; cbOffLbl.y=y; page.appendChild(cbOffLbl);
    const toggleOn=fr("Toggle/On",44,24,"#2b7fff"); toggleOn.cornerRadius=12; toggleOn.x=380; toggleOn.y=y-2; page.appendChild(toggleOn);
    const knob=rc(20,20,"#ffffff",10); knob.x=22; knob.y=2; toggleOn.appendChild(knob);
    const toggleOnLbl=await t("Увімкнено",14,"Regular","#0a0a0a",{ls:-0.15,lh:20}); toggleOnLbl.x=432; toggleOnLbl.y=y; page.appendChild(toggleOnLbl);
    y+=48;
  }

  async function buildComplexComponents(page: PageNode): Promise<void> {
    page.name="🗂 Складні компоненти";
    let y=40;
    async function section(title: string): Promise<void> {
      const lbl=await t(title,13,"SemiBold","#030213",{ls:-0.15,lh:18}); lbl.x=40; lbl.y=y; page.appendChild(lbl); y+=28;
    }
    await section("Картка транспортного засобу");
    const card=fr("Card / Vehicle",420,360,"#ffffff"); card.cornerRadius=14;
    card.strokes=[borderPaint(0.1)]; card.strokeWeight=1; card.x=40; card.y=y; page.appendChild(card);
    const imgPh=rc(372,160,"#f3f3f5",10); imgPh.x=24; imgPh.y=20; card.appendChild(imgPh);
    const imgLbl=await t("Фото ТЗ",12,"Regular","#bcbcbc"); imgLbl.x=186-imgLbl.width/2; imgLbl.y=92; card.appendChild(imgLbl);
    const cardTitle=await t("Загальна інформація",16,"Medium","#0a0a0a",{ls:-0.31,lh:24}); cardTitle.x=24; cardTitle.y=196; card.appendChild(cardTitle);
    div(card,24,228,372);
    const cardRows:[string,string][]=[["Марка / Модель:","Toyota Camry"],["Рік:","2024"],["VIN:","1HGBH41JXMN109186"],["Пробіг:","15 000 км"]];
    for (let i=0;i<cardRows.length;i++) {
      const lbl=await t(cardRows[i][0],13,"Regular","#4a5565",{ls:-0.15,lh:18}); lbl.x=24; lbl.y=240+i*26; card.appendChild(lbl);
      const val=await t(cardRows[i][1],13,"Medium","#0a0a0a",{ls:-0.15,lh:18,family:i===2?"Courier New":"Inter"});
      val.x=420-24-val.width; val.y=240+i*26; card.appendChild(val);
    }
    const cardBadge=await makeBadge("Нереалізовано","#e6f9ef","#00a63e"); cardBadge.x=24; cardBadge.y=320; card.appendChild(cardBadge);
    y+=380;
    await section("Таблиця транспортних засобів");
    const tableW=680;
    const headerCells=["№","Держ. номер","Марка/Модель","Рік","Статус","Ціна","Дії"];
    const headerRow=await makeTableRow(headerCells,true); headerRow.resize(tableW,40); headerRow.cornerRadius=10; headerRow.x=40; headerRow.y=y; page.appendChild(headerRow);
    const dataRows=[["1","АА1234ВВ","Toyota Camry","2024","Активний","$28 500","→"],["2","КА5678СС","BMW 3 Series","2022","Архів","$32 000","→"],["3","ВА9012ТТ","Volkswagen","2023","Новий","$24 900","→"]];
    for (let i=0;i<dataRows.length;i++) {
      const row=await makeTableRow(dataRows[i]); row.resize(tableW,52); row.cornerRadius=i===dataRows.length-1?10:0;
      row.fills=[fill(i%2===0?"#ffffff":"#fafafa")]; row.x=40; row.y=y+40+i*52; page.appendChild(row);
    }
    y+=216;
    await section("Бічна панель навігації");
    const sidebar=fr("Sidebar",240,480,"#ffffff"); sidebar.cornerRadius=14;
    sidebar.strokes=[borderPaint(0.08)]; sidebar.strokeWeight=1; sidebar.x=40; sidebar.y=y; page.appendChild(sidebar);
    const logo=await t("ЄДРТЗВ",16,"Bold","#030213",{ls:-0.31,lh:22}); logo.x=24; logo.y=20; sidebar.appendChild(logo);
    div(sidebar,16,52,208);
    const navItems:[string,boolean][]=[["Список ТЗ",true],["Документи",false],["Пошук",false],["Звіти",false],["Налаштування",false]];
    for (let i=0;i<navItems.length;i++) {
      const [label,isActive]=navItems[i];
      if (isActive) { const ab=rc(240,40,"#eff6ff",8); ab.x=0; ab.y=68+i*48; sidebar.appendChild(ab); }
      const navLbl=await t(label,14,isActive?"Medium":"Regular",isActive?"#2b7fff":"#6a7282",{ls:-0.15,lh:20}); navLbl.x=24; navLbl.y=78+i*48; sidebar.appendChild(navLbl);
    }
    div(sidebar,16,316,208);
    const statsTitle=await t("Статистика",12,"Medium","#737373",{ls:-0.15,lh:16}); statsTitle.x=24; statsTitle.y=328; sidebar.appendChild(statsTitle);
    const stats:[string,string][]=[["142","Активних ТЗ"],["38","Документів"]];
    for (let i=0;i<stats.length;i++) {
      const statCard=fr(`Stat/${i}`,96,64,"#f9fafb"); statCard.cornerRadius=10; statCard.x=16+i*112; statCard.y=352; sidebar.appendChild(statCard);
      const num=await t(stats[i][0],20,"SemiBold","#0a0a0a",{ls:-0.44,lh:28}); num.x=12; num.y=10; statCard.appendChild(num);
      const lbl=await t(stats[i][1],10,"Regular","#737373",{ls:-0.15,lh:14}); lbl.x=12; lbl.y=40; statCard.appendChild(lbl);
    }
    y+=500;
    await section("Модальне вікно");
    const modal=fr("Modal",520,280,"#ffffff"); modal.cornerRadius=14;
    modal.effects=[{type:"DROP_SHADOW",color:{r:0,g:0,b:0,a:0.15},offset:{x:0,y:8},radius:32,spread:0,visible:true,blendMode:"NORMAL"}];
    modal.x=40; modal.y=y; page.appendChild(modal);
    const modalH=await t("Постановка ТЗ на комісію",18,"SemiBold","#0a0a0a",{ls:-0.44,lh:27}); modalH.x=24; modalH.y=24; modal.appendChild(modalH);
    div(modal,0,63,520);
    const modalSub=await t("Заповніть всі обов'язкові поля форми.",14,"Regular","#6a7282",{ls:-0.15,lh:20}); modalSub.x=24; modalSub.y=80; modal.appendChild(modalSub);
    const closeRect=rc(24,24,"#f3f3f5",6); closeRect.x=480; closeRect.y=20; modal.appendChild(closeRect);
    div(modal,0,220,520);
    const btnCancel=await makeButton("Скасувати","#f3f3f5","#0a0a0a",120); btnCancel.x=24; btnCancel.y=232; modal.appendChild(btnCancel);
    const btnOk=await makeButton("Підтвердити","#2b7fff","#ffffff",140); btnOk.x=356; btnOk.y=232; modal.appendChild(btnOk);
    y+=300;
    await section("Завантаження файлу");
    const dropzone=fr("Dropzone",360,120,"#fafafa"); dropzone.cornerRadius=10;
    dropzone.strokes=[{type:"SOLID",color:hexRGB("#bedbff"),opacity:1}]; dropzone.strokeWeight=1.5;
    (dropzone as FrameNode).dashPattern=[8,4]; dropzone.x=40; dropzone.y=y; page.appendChild(dropzone);
    const uploadTitle=await t("Перетягніть файл або",14,"Medium","#2b7fff",{ls:-0.15,lh:20}); uploadTitle.x=180-uploadTitle.width/2; uploadTitle.y=32; dropzone.appendChild(uploadTitle);
    const uploadSub=await t("PDF, JPG, PNG — до 10 МБ",12,"Regular","#737373",{ls:-0.15,lh:16}); uploadSub.x=180-uploadSub.width/2; uploadSub.y=56; dropzone.appendChild(uploadSub);
    const browseBtn=fr("Browse",120,32,"#eff6ff"); browseBtn.cornerRadius=8; browseBtn.x=120; browseBtn.y=80; dropzone.appendChild(browseBtn);
    const browseLbl=await t("Обрати файл",12,"Medium","#2b7fff",{ls:-0.15,lh:16}); browseLbl.x=60-browseLbl.width/2; browseLbl.y=8; browseBtn.appendChild(browseLbl);
    y+=140;
  }

  await preloadDS();
  figma.root.name="ЄДРТЗВ — Design System v2";
  while (figma.root.children.length < 4) figma.createPage();
  const pages=figma.root.children.slice(0,4) as PageNode[];
  await figma.setCurrentPageAsync(pages[0]); for (const c of [...pages[0].children]) c.remove(); await buildColors(pages[0]);
  await figma.setCurrentPageAsync(pages[1]); for (const c of [...pages[1].children]) c.remove(); await buildTypography(pages[1]);
  await figma.setCurrentPageAsync(pages[2]); for (const c of [...pages[2].children]) c.remove(); await buildBasicComponents(pages[2]);
  await figma.setCurrentPageAsync(pages[3]); for (const c of [...pages[3].children]) c.remove(); await buildComplexComponents(pages[3]);
  await figma.setCurrentPageAsync(pages[0]);
  figma.viewport.scrollAndZoomIntoView(pages[0].children);
  figma.notify("Design System v2 — готово!", { timeout:4000 });
  figma.closePlugin();
}

// ═══════════════════════════════════════════════════════════════
// REBUILD SELECTION
// ═══════════════════════════════════════════════════════════════

async function runRebuildSelection(): Promise<void> {
  figma.notify("Перезбірка запущена...", { timeout:1200 });
  await ensureCurrentPageLoaded();
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("Виділіть макет або його частину для перезбірки", { error:true, timeout:4000 });
    figma.closePlugin();
    return;
  }

  let targets: SceneNode[] = [];
  const seen = new Set<string>();

  function visit(node: SceneNode): void {
    if (!seen.has(node.id)) {
      seen.add(node.id);
      const key = inferComponentKeyFromNode(node);
      const canReplaceNode = node.type !== "COMPONENT" && (node.type !== "INSTANCE" || key?.startsWith("Data/Table"));
      if (canReplaceNode && key) {
        targets.push(node);
        if (key.startsWith("Data/Table")) return;
      }
    }
    if ("children" in node) {
      for (const child of node.children) visit(child);
    }
  }

  function depth(node: BaseNode): number {
    let value = 0;
    let parent = node.parent;
    while (parent) {
      value++;
      parent = parent.parent;
    }
    return value;
  }

  for (const node of selection) visit(node);
  targets.sort((a, b) => depth(b) - depth(a));
  const tableTargets = targets
    .filter((node) => inferComponentKeyFromNode(node)?.startsWith("Data/Table"))
    .map((node) => ({ node, bounds:absoluteBounds(node) }))
    .filter((entry): entry is { node: SceneNode; bounds: NodeBounds } => !!entry.bounds);
  targets = targets.filter((node) => {
    if (inferComponentKeyFromNode(node)?.startsWith("Data/Table")) return true;
    return !tableTargets.some(({ node: tableNode, bounds }) => tableNode.id !== node.id && centerInsideBounds(node, bounds, 4));
  });

  if (targets.length === 0) {
    figma.notify("Не знайшов елементів, які можна перезібрати. Виділіть імпортований frame або table wrapper.", { error:true, timeout:5000 });
    figma.closePlugin();
    return;
  }

  let rebuilt = 0;
  let missing = 0;
  let variableBindings = 0;
  let variableBindingFailed = false;
  const tokenIndex = await getTokenBindingIndex();

  for (const node of selection) {
    const bindingResult = await safeBindNodeToTokenVariables(node, tokenIndex);
    variableBindings += bindingResult.count;
    variableBindingFailed = variableBindingFailed || bindingResult.failed;
  }

  for (const node of targets) {
    let key = inferComponentKeyFromNode(node);
    if (!key) continue;
    const props = readStoredComponentProps(node) ?? inferComponentPropsFromNode(node, key);
    if (key === "Data/Table" && isShelterTableProps(props)) key = "Data/Table/Shelters";
    const opacity = "opacity" in node ? node.opacity : 1;
    const instance = await createRegistryInstance(key, props, node.width, node.height, opacity);
    if (!instance) {
      missing++;
      continue;
    }
    const bindingResult = await safeBindNodeToTokenVariables(instance, tokenIndex);
    variableBindings += bindingResult.count;
    variableBindingFailed = variableBindingFailed || bindingResult.failed;

    const parent = node.parent;
    if (!parent || !("children" in parent) || !("insertChild" in parent)) {
      instance.remove();
      continue;
    }

    const index = Math.max(0, Array.from(parent.children).indexOf(node));
    parent.insertChild(index, instance);
    instance.x = node.x;
    instance.y = node.y;
    if ("rotation" in node && "rotation" in instance) instance.rotation = node.rotation;
    if (key.startsWith("Data/Table")) removeTableFragmentsAround(node, instance);
    node.remove();
    rebuilt++;
  }

  const summary = `Перезбірка завершилась: ${rebuilt} елементів${variableBindings ? `, прив'язок Variables: ${variableBindings}` : ""}${variableBindingFailed ? ", Variables частково пропущено" : ""}${missing ? `, без компонента: ${missing}` : ""}`;
  figma.notify(summary, { timeout:5000 });
  figma.closePlugin(summary);
}

// ═══════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════

async function runScreens(): Promise<void> {

  const _loaded = new Set<string>();
  async function lf(family: string, style: string): Promise<void> {
    const k=`${family}:${style}`; if (_loaded.has(k)) return;
    try { await figma.loadFontAsync({family,style}); _loaded.add(k); }
    catch(_){ try { await figma.loadFontAsync({family:"Inter",style:"Regular"}); } catch(__){} }
  }
  async function preloadSC(): Promise<void> {
    const list:[string,string][]=[["Inter","Regular"],["Inter","Medium"],["Inter","SemiBold"],["Inter","Bold"],["Courier New","Regular"]];
    for (const [f,s] of list) { try { await figma.loadFontAsync({family:f,style:s}); _loaded.add(`${f}:${s}`); } catch(_){} }
  }

  function h2r(hex: string): RGB { const c=hex.replace("#",""); return {r:parseInt(c.slice(0,2),16)/255,g:parseInt(c.slice(2,4),16)/255,b:parseInt(c.slice(4,6),16)/255}; }
  function sf(hex: string, opacity=1): SolidPaint { return {type:"SOLID",color:h2r(hex),opacity}; }
  function bp(o=0.1): SolidPaint { return {type:"SOLID",color:{r:0,g:0,b:0},opacity:o}; }
  function frS(name:string,w:number,h:number,bg=""): FrameNode { const f=figma.createFrame(); f.name=name; f.resize(w,h); f.fills=bg?[sf(bg)]:[]; f.clipsContent=false; return f; }
  function rcS(w:number,h:number,bg:string,r=0): RectangleNode { const n=figma.createRectangle(); n.resize(w,h); n.fills=[sf(bg)]; n.cornerRadius=r; return n; }
  function el(w:number,h:number,bg:string): EllipseNode { const n=figma.createEllipse(); n.resize(w,h); n.fills=[sf(bg)]; return n; }
  async function tx(s:string,size:number,style:string,color:string,opts:{fam?:string;ls?:number;lh?:number}={}): Promise<TextNode> {
    const fam=opts.fam||"Inter"; await lf(fam,style);
    const n=figma.createText(); try { n.fontName={family:fam,style}; } catch(_){ n.fontName={family:"Inter",style:"Regular"}; }
    n.fontSize=size; n.characters=s; n.fills=[sf(color)];
    if (opts.ls!=null) n.letterSpacing={value:opts.ls,unit:"PIXELS"};
    if (opts.lh!=null) n.lineHeight={value:opts.lh,unit:"PIXELS"}; return n;
  }
  function ln(parent:FrameNode,x:number,y:number,w:number,color="#e5e7eb"): void { const r=rcS(w,1,color); r.x=x; r.y=y; parent.appendChild(r); }

  async function buildSidebar(parent: FrameNode): Promise<void> {
    const sb=frS("Sidebar",180,900,"#ffffff");
    sb.strokes=[{type:"SOLID",color:h2r("#e5e7eb"),opacity:1}]; sb.strokeAlign="OUTSIDE"; sb.strokeWeight=1; parent.appendChild(sb);
    const logo=await tx("ЄДРТЗВ",16,"SemiBold","#101828",{ls:-0.3,lh:22}); logo.x=20; logo.y=20; sb.appendChild(logo); ln(sb,0,52,180);
    const navItems:[string,boolean,string][]=[["Список ТЗ",false,"#6a7282"],["Документи",false,"#6a7282"],["Пошук",true,"#2b7fff"],["Звіти",false,"#6a7282"],["Налаштування",false,"#6a7282"]];
    for (let i=0;i<navItems.length;i++) {
      const [label,active,color]=navItems[i];
      if (active) { const bar=rcS(180,40,"#eff6ff"); bar.x=0; bar.y=64+i*48; sb.appendChild(bar); }
      const lbl=await tx(label,14,active?"Medium":"Regular",color,{ls:-0.15,lh:20}); lbl.x=20; lbl.y=74+i*48; sb.appendChild(lbl);
    }
    ln(sb,16,316,148);
    const statsLabel=await tx("Статистика",12,"Medium","#737373",{ls:-0.15,lh:16}); statsLabel.x=20; statsLabel.y=326; sb.appendChild(statsLabel);
    const stats:[string,string,string][]=[["63","Всього документів","#101828"],["22","Акт тех. стану","#00a63e"],["5","Договір комісії","#457dcf"]];
    for (let i=0;i<stats.length;i++) {
      const card=frS(`Stat/${i}`,148,60,"#f9fafb"); card.cornerRadius=10; card.x=16; card.y=348+i*72; sb.appendChild(card);
      const num=await tx(stats[i][0],20,"SemiBold",stats[i][2],{ls:-0.44,lh:28}); num.x=12; num.y=8; card.appendChild(num);
      const lbl=await tx(stats[i][1],11,"Regular","#6a7282",{ls:-0.15,lh:14}); lbl.x=12; lbl.y=36; card.appendChild(lbl);
    }
    ln(sb,16,800,148);
    const avatar=el(32,32,"#2b7fff"); avatar.x=20; avatar.y=820; sb.appendChild(avatar);
    const initials=await tx("JS",12,"Medium","#ffffff"); initials.x=31; initials.y=828; sb.appendChild(initials);
    const uname=await tx("John Smith",13,"Medium","#101828",{ls:-0.15,lh:18}); uname.x=60; uname.y=820; sb.appendChild(uname);
    const urole=await tx("Адміністратор",11,"Regular","#6a7282",{ls:-0.15,lh:14}); urole.x=60; urole.y=840; sb.appendChild(urole);
  }

  async function buildTable(parent:FrameNode,x:number,y:number,w:number,headers:string[],rows:string[][],colWidths:number[]): Promise<number> {
    const hRow=frS("Table/Header",w,40,"#f9fafb"); hRow.cornerRadius=10; hRow.x=x; hRow.y=y; parent.appendChild(hRow);
    let cx=16;
    for (let i=0;i<headers.length;i++) { const h=await tx(headers[i].toUpperCase(),11,"Medium","#6a7282",{ls:0.6,lh:16}); h.x=cx; h.y=12; hRow.appendChild(h); cx+=colWidths[i]; }
    ln(parent,x,y+40,w);
    for (let r=0;r<rows.length;r++) {
      const row=frS(`Row/${r}`,w,52,r%2===0?"#ffffff":"#fafafa"); row.x=x; row.y=y+40+r*52; parent.appendChild(row); ln(row,0,51,w);
      let dx=16;
      for (let c=0;c<rows[r].length;c++) { const cell=await tx(rows[r][c],13,"Regular","#101828",{ls:-0.15,lh:18,fam:c===3?"Courier New":"Inter"}); cell.x=dx; cell.y=17; row.appendChild(cell); dx+=colWidths[c]; }
    }
    return y+40+rows.length*52+24;
  }

  function buildProgressBar(parent:FrameNode,x:number,y:number,w:number,activeStep:number): void {
    const total=4, segW=Math.floor((w-8)/total);
    for (let i=0;i<total;i++) { const seg=rcS(segW,4,i<activeStep?"#2b7fff":"#e5e7eb",9999); seg.x=x+i*(segW+2); seg.y=y; parent.appendChild(seg); }
  }

  async function buildWizardHeader(parent:FrameNode,title:string,step:number,stepLabel:string): Promise<void> {
    const hdr=await tx(title,18,"SemiBold","#0a0a0a",{ls:-0.44,lh:27}); hdr.x=24; hdr.y=20; parent.appendChild(hdr);
    const close=rcS(24,24,"#f3f3f5",6); close.x=parent.width-48; close.y=18; parent.appendChild(close);
    buildProgressBar(parent,24,60,parent.width-48,step);
    const stepCircle=frS(`Step/${step}`,32,32,"#2b7fff"); stepCircle.cornerRadius=10; stepCircle.x=24; stepCircle.y=80; parent.appendChild(stepCircle);
    const stepNum=await tx(String(step),14,"SemiBold","#ffffff"); stepNum.x=11; stepNum.y=8; stepCircle.appendChild(stepNum);
    const stepLbl=await tx(stepLabel,18,"SemiBold","#101828",{ls:-0.44,lh:27}); stepLbl.x=64; stepLbl.y=82; parent.appendChild(stepLbl);
    ln(parent,24,122,parent.width-48);
  }

  async function buildScreenVehicleList(page: PageNode): Promise<void> {
    page.name="01 · Список ТЗ";
    const root=frS("Головний екран — Список ТЗ",1440,900,"#ffffff"); root.x=0; root.y=0; page.appendChild(root);
    await buildSidebar(root);
    const main=frS("Main",1260,900,"#ffffff"); main.x=180; main.y=0; root.appendChild(main);
    const back=rcS(36,36,"#f3f3f5",8); back.x=24; back.y=20; main.appendChild(back);
    const backArr=await tx("←",16,"Regular","#6a7282"); backArr.x=30; backArr.y=22; main.appendChild(backArr);
    const title=await tx("Список транспортних засобів",24,"SemiBold","#101828",{ls:-0.44,lh:32}); title.x=72; title.y=22; main.appendChild(title);
    const tabs=frS("Tabs",480,40,"#ececf0"); tabs.cornerRadius=14; tabs.x=24; tabs.y=72; main.appendChild(tabs);
    const tabLabels=["Всі ТЗ","Активні","Архів"];
    for (let i=0;i<tabLabels.length;i++) {
      const active=i===0; const tab=frS(`Tab/${i}`,152,34,active?"#ffffff":""); tab.fills=active?[sf("#ffffff")]:[];
      tab.cornerRadius=10; tab.x=4+i*156; tab.y=3; tabs.appendChild(tab);
      const lbl=await tx(tabLabels[i],14,active?"Medium":"Regular",active?"#0a0a0a":"#737373",{ls:-0.15,lh:20}); lbl.x=Math.round((152-lbl.width)/2); lbl.y=7; tab.appendChild(lbl);
    }
    const addBtn=frS("Btn/Add",100,40,"#2b7fff"); addBtn.cornerRadius=8; addBtn.x=1116; addBtn.y=72; main.appendChild(addBtn);
    const addLbl=await tx("+ Додати",14,"Medium","#ffffff",{ls:-0.15,lh:20}); addLbl.x=18; addLbl.y=10; addBtn.appendChild(addLbl);
    ln(main,0,124,1260);
    const headers=["ТРАНСПОРТНИЙ ЗАСІБ","РІК","КОЛІР","VIN","ЦІНА","СТАТУС"];
    const colW=[280,80,120,220,100,180];
    const rows=[["Toyota Camry","2024","Silver","1HGBH41JXMN109186","$28 500","Нереалізовано"],["BMW 3 Series","2022","Black","WBAJB91040B297625","$32 000","В обробці"],["Volkswagen Passat","2023","White","WVWZZZ3CZPE123456","$24 900","Нереалізовано"],["Audi A4","2021","Gray","WAUZZZ8K9BA012345","$27 800","Реалізовано"],["Mercedes C200","2023","Blue","WDD2050422R123456","$38 500","Нереалізовано"]];
    await buildTable(main,24,124,1212,headers,rows,colW);
  }

  async function buildScreenVehicleDetail(page: PageNode): Promise<void> {
    page.name="02 · Деталі ТЗ";
    const root=frS("АрмТоргуючі — Деталі ТЗ",1440,900,"#ffffff"); root.x=0; root.y=0; page.appendChild(root);
    await buildSidebar(root);
    const main=frS("Main",1260,900,"#ffffff"); main.x=180; main.y=0; root.appendChild(main);
    const back=rcS(36,36,"#f3f3f5",8); back.x=24; back.y=20; main.appendChild(back);
    const backArr=await tx("←",16,"Regular","#6a7282"); backArr.x=30; backArr.y=22; main.appendChild(backArr);
    const title=await tx("Toyota Camry (2024)",24,"SemiBold","#101828",{ls:-0.44,lh:32}); title.x=72; title.y=16; main.appendChild(title);
    const vin=await tx("1HGBH41JXMN109186",13,"Regular","#6a7282",{fam:"Courier New",lh:18}); vin.x=72; vin.y=50; main.appendChild(vin);
    const badge=frS("Badge",100,26,"#e6f9ef"); badge.cornerRadius=8; badge.strokes=[bp(0.1)]; badge.strokeWeight=1; badge.x=380; badge.y=23; main.appendChild(badge);
    const badgeLbl=await tx("Доступно",12,"Medium","#00a63e",{ls:-0.15,lh:16}); badgeLbl.x=12; badgeLbl.y=5; badge.appendChild(badgeLbl);
    const tabNav=frS("TabNav",400,36,"#ececf0"); tabNav.cornerRadius=14; tabNav.x=24; tabNav.y=76; main.appendChild(tabNav);
    const tabNavItems=["Інформація","Документи (3)","Перевірки (2)"];
    for (let i=0;i<tabNavItems.length;i++) {
      const active=i===1; const tab=frS(`T/${i}`,126,30,active?"#ffffff":""); tab.fills=active?[sf("#ffffff")]:[];
      tab.cornerRadius=10; tab.x=3+i*130; tab.y=3; tabNav.appendChild(tab);
      const lbl=await tx(tabNavItems[i],13,active?"Medium":"Regular",active?"#0a0a0a":"#737373",{ls:-0.15,lh:18}); lbl.x=Math.round((126-lbl.width)/2); lbl.y=6; tab.appendChild(lbl);
    }
    ln(main,0,124,1260);
    const filterRow=frS("Filters",1212,44); filterRow.fills=[]; filterRow.x=24; filterRow.y=136; main.appendChild(filterRow);
    const filterInputs=["Тип документу","Статус документу","Період"];
    for (let i=0;i<filterInputs.length;i++) {
      const inp=frS(`F/${i}`,180,40,"#f3f3f5"); inp.cornerRadius=10; inp.x=i*196; inp.y=2; filterRow.appendChild(inp);
      const ph=await tx(filterInputs[i],13,"Regular","#717182",{ls:-0.15,lh:18}); ph.x=12; ph.y=11; inp.appendChild(ph);
    }
    ln(main,0,192,1260);
    const docHeaders=["ТИП ДОКУМЕНТУ","№ ДОГОВОРУ","СТАТУС","VIN","ДАТА","ТЕХПАСПОРТ"];
    const docColW=[220,160,140,200,100,130];
    const docRows=[["Акт технічного стану","VIDI-62813","згенеровано","1HGBH41JXMN109186","16.01.2024","КРТ №274865"],["Договір купівлі-продажу","Договір №4827","підписано","1HGBH41JXMN109186","18.01.2024","КРТ №274865"],["Акт огляду ТЗ","VIDI-62814","чернетка","1HGBH41JXMN109186","20.01.2024","—"]];
    await buildTable(main,24,204,1212,docHeaders,docRows,docColW);
  }

  async function buildScreenDocList(page: PageNode): Promise<void> {
    page.name="03 · Список документів";
    const root=frS("Головний екран — Документи",1440,900,"#f9fafb"); root.x=0; root.y=0; page.appendChild(root);
    await buildSidebar(root);
    const main=frS("Main",1260,900,"#f9fafb"); main.x=180; main.y=0; root.appendChild(main);
    const title=await tx("Документи",24,"SemiBold","#101828",{ls:-0.44,lh:32}); title.x=24; title.y=24; main.appendChild(title);
    const search=frS("Search",360,40,"#ffffff"); search.cornerRadius=10;
    search.strokes=[{type:"SOLID",color:h2r("#e5e7eb"),opacity:1}]; search.strokeWeight=1; search.x=24; search.y=76; main.appendChild(search);
    const ph=await tx("Пошук документів...",13,"Regular","#737373",{ls:-0.15,lh:18}); ph.x=12; ph.y=11; search.appendChild(ph);
    const addBtn=frS("Add",120,40,"#2b7fff"); addBtn.cornerRadius=8; addBtn.x=1116; addBtn.y=76; main.appendChild(addBtn);
    const addLbl=await tx("+ Додати",14,"Medium","#ffffff",{ls:-0.15,lh:20}); addLbl.x=16; addLbl.y=10; addBtn.appendChild(addLbl);
    ln(main,0,128,1260,"#e5e7eb");
    const headers=["ТИП ДОКУМЕНТУ","№ ДОГОВОРУ","СТАТУС","VIN","ДАТА","МАРКА/МОДЕЛЬ"];
    const colW=[220,160,140,200,100,200];
    const rows=[["Акт технічного стану","VIDI-62813","згенеровано","1HGBH41JXMN109186","16.01.2024","Toyota Camry"],["Договір купівлі-продажу","Договір №4827","підписано","WBAJB91040B297625","18.01.2024","BMW 3 Series"],["Акт огляду ТЗ","VIDI-62814","чернетка","WVWZZZ3CZPE123456","20.01.2024","Volkswagen Passat"],["Угода з третіми особами","УГД-00312","підписано","WAUZZZ8K9BA012345","22.01.2024","Audi A4"],["Акт технічного стану","VIDI-62820","згенеровано","WDD2050422R123456","24.01.2024","Mercedes C200"]];
    await buildTable(main,24,140,1212,headers,rows,colW);
  }

  async function buildScreenSearch(page: PageNode): Promise<void> {
    page.name="04 · Wizard — Пошук авто";
    const root=frS("Screen/Пошук",1440,900,"#f9fafb"); root.x=0; root.y=0; page.appendChild(root);
    const overlay=rcS(1440,900,"#0a0a0a",0); overlay.fills=[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0.4}]; overlay.x=0; overlay.y=0; root.appendChild(overlay);
    const modal=frS("Modal/PoshukAvto",600,680,"#ffffff"); modal.cornerRadius=14;
    modal.effects=[{type:"DROP_SHADOW",color:{r:0,g:0,b:0,a:0.18},offset:{x:0,y:8},radius:32,spread:0,visible:true,blendMode:"NORMAL"}];
    modal.x=420; modal.y=110; root.appendChild(modal);
    await buildWizardHeader(modal,"Постановка ТЗ на комісію",1,"Пошук авто");
    const fieldDefs:[string,string][]=[["VIN (номер кузова)","H7TX98234L0012345"],["Держ. номер","АА1234ВВ"]];
    for (let i=0;i<fieldDefs.length;i++) {
      const [label,placeholder]=fieldDefs[i];
      const lbl=await tx(label,13,"Medium","#0a0a0a",{ls:-0.15,lh:18}); lbl.x=24; lbl.y=140+i*80; modal.appendChild(lbl);
      const field=frS(`Field/${i}`,552,44,"#f3f3f5"); field.cornerRadius=10; field.x=24; field.y=162+i*80; modal.appendChild(field);
      const ph=await tx(placeholder,14,"Regular","#737373",{ls:-0.15,lh:20}); ph.x=12; ph.y=12; field.appendChild(ph);
    }
    const searchBtn=frS("Search",552,48,"#2b7fff"); searchBtn.cornerRadius=10; searchBtn.x=24; searchBtn.y=312; modal.appendChild(searchBtn);
    const searchLbl=await tx("Шукати",15,"SemiBold","#ffffff",{ls:-0.15,lh:22}); searchLbl.x=Math.round((552-searchLbl.width)/2); searchLbl.y=13; searchBtn.appendChild(searchLbl);
    ln(modal,24,376,552);
    const resTitle=await tx("Результати пошуку",14,"Medium","#0a0a0a",{ls:-0.15,lh:20}); resTitle.x=24; resTitle.y=388; modal.appendChild(resTitle);
    await buildTable(modal,24,412,552,["МАРКА","МОДЕЛЬ","НОМЕР КУЗОВА","ДЕРЖ. НОМЕР"],[["Toyota","Camry","H7TX98234L0012345","АА1234ВВ"],["Toyota","Corolla","H7TX98234L0099999","АА9999СС"]],[100,100,200,120]);
    ln(modal,0,620,600);
    const nextBtn=frS("Next",552,44,"#2b7fff"); nextBtn.cornerRadius=10; nextBtn.x=24; nextBtn.y=628; modal.appendChild(nextBtn);
    const nextLbl=await tx("Далі →",14,"SemiBold","#ffffff",{ls:-0.15,lh:20}); nextLbl.x=Math.round((552-nextLbl.width)/2); nextLbl.y=12; nextBtn.appendChild(nextLbl);
  }

  async function buildScreenVerification(page: PageNode): Promise<void> {
    page.name="05 · Wizard — Перевірка по базі";
    const root=frS("Screen/Перевірка",1440,900,"#f9fafb"); root.x=0; root.y=0; page.appendChild(root);
    const overlay=rcS(1440,900,"#0a0a0a",0); overlay.fills=[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0.4}]; overlay.x=0; overlay.y=0; root.appendChild(overlay);
    const modal=frS("Modal/Verification",640,760,"#ffffff"); modal.cornerRadius=14;
    modal.effects=[{type:"DROP_SHADOW",color:{r:0,g:0,b:0,a:0.18},offset:{x:0,y:8},radius:32,spread:0,visible:true,blendMode:"NORMAL"}];
    modal.x=400; modal.y=70; root.appendChild(modal);
    await buildWizardHeader(modal,"Постановка ТЗ на комісію",2,"Перевірка по базі");
    const checks:[string,string,string][]=[["Реєстрація ТЗ в Україні","#00a63e","✓"],["Перевірка обтяжень","#00a63e","✓"],["Перевірка на викрадення","#00a63e","✓"],["Заборона відчуження","#dc2626","✗"],["Митні обмеження","#00a63e","✓"],["Перевірка страхування","#d08700","~"]];
    const checkListFrame=frS("Checklist",592,320); checkListFrame.fills=[]; checkListFrame.x=24; checkListFrame.y=140; modal.appendChild(checkListFrame);
    for (let i=0;i<checks.length;i++) {
      const row=frS(`Check/${i}`,592,48,"#ffffff"); row.cornerRadius=8; row.strokes=[{type:"SOLID",color:h2r("#e5e7eb"),opacity:1}]; row.strokeWeight=1; row.x=0; row.y=i*52; checkListFrame.appendChild(row);
      const circle=el(24,24,checks[i][1]+"22"); circle.x=12; circle.y=12; row.appendChild(circle);
      const icon=await tx(checks[i][2],13,"Medium","#ffffff"); icon.x=16; icon.y=14; row.appendChild(icon);
      const lbl=await tx(checks[i][0],14,"Regular","#101828",{ls:-0.15,lh:20}); lbl.x=48; lbl.y=14; row.appendChild(lbl);
    }
    ln(modal,0,480,640);
    const prevBtn=frS("Prev",280,44,"#f3f3f5"); prevBtn.cornerRadius=10; prevBtn.x=24; prevBtn.y=492; modal.appendChild(prevBtn);
    const prevLbl=await tx("← Назад",14,"Medium","#6a7282",{ls:-0.15,lh:20}); prevLbl.x=Math.round((280-prevLbl.width)/2); prevLbl.y=12; prevBtn.appendChild(prevLbl);
    const nextBtn=frS("Next",280,44,"#2b7fff"); nextBtn.cornerRadius=10; nextBtn.x=336; nextBtn.y=492; modal.appendChild(nextBtn);
    const nextLbl=await tx("Далі →",14,"SemiBold","#ffffff",{ls:-0.15,lh:20}); nextLbl.x=Math.round((280-nextLbl.width)/2); nextLbl.y=12; nextBtn.appendChild(nextLbl);
  }

  async function buildScreenCondition(page: PageNode): Promise<void> {
    page.name="06 · Wizard — Стан ТЗ";
    const root=frS("Screen/СтанТЗ",1440,900,"#f9fafb"); root.x=0; root.y=0; page.appendChild(root);
    const overlay=rcS(1440,900,"#0a0a0a",0); overlay.fills=[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0.4}]; overlay.x=0; overlay.y=0; root.appendChild(overlay);
    const modal=frS("Modal/Condition",640,780,"#ffffff"); modal.cornerRadius=14;
    modal.effects=[{type:"DROP_SHADOW",color:{r:0,g:0,b:0,a:0.18},offset:{x:0,y:8},radius:32,spread:0,visible:true,blendMode:"NORMAL"}];
    modal.x=400; modal.y=60; root.appendChild(modal);
    await buildWizardHeader(modal,"Постановка ТЗ на комісію",3,"Стан ТЗ");
    const fields:[string,string][]=[["Стан кузову","Відмінний"],["Стан салону","Добрий"],["Двигун","Справний, без зауважень"],["Коробка передач","Автоматична, справна"],["Пробіг (км)","15 000"],["Ціна продажу (₴)","1 140 000"]];
    for (let i=0;i<fields.length;i++) {
      const col=i%2, row=Math.floor(i/2);
      const lbl=await tx(fields[i][0],13,"Medium","#0a0a0a",{ls:-0.15,lh:18}); lbl.x=24+col*308; lbl.y=140+row*88; modal.appendChild(lbl);
      const field=frS(`F/${i}`,280,44,"#f3f3f5"); field.cornerRadius=10; field.x=24+col*308; field.y=162+row*88; modal.appendChild(field);
      const val=await tx(fields[i][1],14,"Regular","#0a0a0a",{ls:-0.15,lh:20}); val.x=12; val.y=12; field.appendChild(val);
    }
    const notesLbl=await tx("Примітки",13,"Medium","#0a0a0a",{ls:-0.15,lh:18}); notesLbl.x=24; notesLbl.y=404; modal.appendChild(notesLbl);
    const notes=frS("Notes",592,80,"#f3f3f5"); notes.cornerRadius=10; notes.x=24; notes.y=426; modal.appendChild(notes);
    const notesVal=await tx("Відмінний стан, один власник, всі документи в порядку.",14,"Regular","#0a0a0a",{ls:-0.15,lh:20}); notesVal.x=12; notesVal.y=12; notes.appendChild(notesVal);
    ln(modal,0,524,640);
    const prevBtn=frS("Prev",280,44,"#f3f3f5"); prevBtn.cornerRadius=10; prevBtn.x=24; prevBtn.y=540; modal.appendChild(prevBtn);
    const prevLbl=await tx("← Назад",14,"Medium","#6a7282",{ls:-0.15,lh:20}); prevLbl.x=Math.round((280-prevLbl.width)/2); prevLbl.y=12; prevBtn.appendChild(prevLbl);
    const nextBtn=frS("Next",280,44,"#2b7fff"); nextBtn.cornerRadius=10; nextBtn.x=336; nextBtn.y=540; modal.appendChild(nextBtn);
    const nextLbl=await tx("Далі →",14,"SemiBold","#ffffff",{ls:-0.15,lh:20}); nextLbl.x=Math.round((280-nextLbl.width)/2); nextLbl.y=12; nextBtn.appendChild(nextLbl);
  }

  async function buildScreenCommittent(page: PageNode): Promise<void> {
    page.name="07 · Wizard — Дані комітента";
    const root=frS("Screen/Комітент",1440,900,"#f9fafb"); root.x=0; root.y=0; page.appendChild(root);
    const overlay=rcS(1440,900,"#0a0a0a",0); overlay.fills=[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0.4}]; overlay.x=0; overlay.y=0; root.appendChild(overlay);
    const modal=frS("Modal/Committent",640,820,"#ffffff"); modal.cornerRadius=14;
    modal.effects=[{type:"DROP_SHADOW",color:{r:0,g:0,b:0,a:0.18},offset:{x:0,y:8},radius:32,spread:0,visible:true,blendMode:"NORMAL"}];
    modal.x=400; modal.y=40; root.appendChild(modal);
    await buildWizardHeader(modal,"Постановка ТЗ на комісію",4,"Дані про комітента");
    const types=["Фізична особа","Юридична особа","ФОП"];
    for (let i=0;i<types.length;i++) {
      const active=i===0; const btn=frS(`Type/${i}`,182,36,active?"#eff6ff":"#f3f3f5");
      btn.cornerRadius=8; if (active) { btn.strokes=[{type:"SOLID",color:h2r("#2b7fff"),opacity:1}]; btn.strokeWeight=1.5; }
      btn.x=24+i*192; btn.y=140; modal.appendChild(btn);
      const lbl=await tx(types[i],13,active?"Medium":"Regular",active?"#2b7fff":"#737373",{ls:-0.15,lh:18}); lbl.x=Math.round((182-lbl.width)/2); lbl.y=9; btn.appendChild(lbl);
    }
    const personFields:[string,string][]=[["Прізвище","Іванов"],["Ім'я","Іван"],["По батькові","Іванович"],["ІПН","1234567890"],["Серія та номер паспорту","АА123456"],["Дата видачі","15.01.2010"],["Адреса реєстрації","м. Київ, вул. Хрещатик, 1"],["Телефон","+380501234567"]];
    for (let i=0;i<personFields.length;i++) {
      const col=i%2, row=Math.floor(i/2);
      const lbl=await tx(personFields[i][0],13,"Medium","#0a0a0a",{ls:-0.15,lh:18}); lbl.x=24+col*308; lbl.y=192+row*80; modal.appendChild(lbl);
      const field=frS(`F/${i}`,280,40,"#f3f3f5"); field.cornerRadius=10; field.x=24+col*308; field.y=214+row*80; modal.appendChild(field);
      const val=await tx(personFields[i][1],14,"Regular","#0a0a0a",{ls:-0.15,lh:20}); val.x=12; val.y=10; field.appendChild(val);
    }
    ln(modal,0,540,640);
    const prevBtn=frS("Prev",280,44,"#f3f3f5"); prevBtn.cornerRadius=10; prevBtn.x=24; prevBtn.y=556; modal.appendChild(prevBtn);
    const prevLbl=await tx("← Назад",14,"Medium","#6a7282",{ls:-0.15,lh:20}); prevLbl.x=Math.round((280-prevLbl.width)/2); prevLbl.y=12; prevBtn.appendChild(prevLbl);
    const submitBtn=frS("Submit",280,44,"#030213"); submitBtn.cornerRadius=10; submitBtn.x=336; submitBtn.y=556; modal.appendChild(submitBtn);
    const submitLbl=await tx("Поставити на комісію",14,"SemiBold","#ffffff",{ls:-0.15,lh:20}); submitLbl.x=Math.round((280-submitLbl.width)/2); submitLbl.y=12; submitBtn.appendChild(submitLbl);
  }

  async function buildScreenDocuments(page: PageNode): Promise<void> {
    page.name="08 · Успішна постановка";
    const root=frS("Screen/Документи",1440,900,"#f9fafb"); root.x=0; root.y=0; page.appendChild(root);
    const overlay=rcS(1440,900,"#0a0a0a",0); overlay.fills=[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0.4}]; overlay.x=0; overlay.y=0; root.appendChild(overlay);
    const modal=frS("Modal/Documents",560,780,"#ffffff"); modal.cornerRadius=14;
    modal.effects=[{type:"DROP_SHADOW",color:{r:0,g:0,b:0,a:0.18},offset:{x:0,y:8},radius:32,spread:0,visible:true,blendMode:"NORMAL"}];
    modal.x=440; modal.y=60; root.appendChild(modal);
    const hdr=await tx("Постановка ТЗ на комісію",18,"SemiBold","#0a0a0a",{ls:-0.44,lh:27}); hdr.x=24; hdr.y=20; modal.appendChild(hdr);
    ln(modal,0,56,560);
    const successBlock=frS("Success",512,100,"#faf5ff"); successBlock.cornerRadius=10;
    successBlock.strokes=[{type:"SOLID",color:h2r("#e9d4ff"),opacity:1}]; successBlock.strokeWeight=1; successBlock.x=24; successBlock.y=68; modal.appendChild(successBlock);
    const successIcon=el(40,40,"#ad46ff"); successIcon.x=16; successIcon.y=30; successBlock.appendChild(successIcon);
    const checkMark=await tx("✓",18,"Bold","#ffffff"); checkMark.x=24; checkMark.y=38; successBlock.appendChild(checkMark);
    const successTitle=await tx("Авто поставлено на комісію",16,"SemiBold","#101828",{ls:-0.31,lh:24}); successTitle.x=68; successTitle.y=30; successBlock.appendChild(successTitle);
    const successSub=await tx("Ви можете роздрукувати документи нижче",14,"Regular","#4a5565",{ls:-0.15,lh:20}); successSub.x=68; successSub.y=58; successBlock.appendChild(successSub);
    const docs:[string,string][]=[["Угода","Про купівлю-продаж із третіми особами"],["Акт","Приймання-передачі від продавця комісіонеру"],["Акт","Технічного стану ТЗ"],["Акт","Огляду ТЗ"],["Договір","Купівлі-продажу комісійного ТЗ"],["Договір","Купівлі-продажу (з актом приймання-передачі)"]];
    for (let i=0;i<docs.length;i++) {
      const card=frS(`Doc/${i}`,512,60,"#ffffff"); card.cornerRadius=10;
      card.strokes=[{type:"SOLID",color:h2r("#e5e5e5"),opacity:1}]; card.strokeWeight=1;
      card.effects=[{type:"DROP_SHADOW",color:{r:0,g:0,b:0,a:0.08},offset:{x:0,y:1},radius:4,spread:0,visible:true,blendMode:"NORMAL"}];
      card.x=24; card.y=180+i*68; modal.appendChild(card);
      const docType=await tx(docs[i][0],14,"Medium","#0a0a0a",{ls:-0.15,lh:20}); docType.x=16; docType.y=10; card.appendChild(docType);
      const docName=await tx(docs[i][1],13,"Regular","#737373",{ls:-0.15,lh:18}); docName.x=16; docName.y=32; card.appendChild(docName);
      const printBtn=frS(`Print/${i}`,90,28,"#2b7fff"); printBtn.cornerRadius=8; printBtn.x=406; printBtn.y=16; card.appendChild(printBtn);
      const printLbl=await tx("Друкувати",11,"Regular","#ffffff"); printLbl.x=8; printLbl.y=7; printBtn.appendChild(printLbl);
    }
    ln(modal,0,596,560);
    const closeBtn=frS("Close",512,44,"#2b7fff"); closeBtn.cornerRadius=10; closeBtn.x=24; closeBtn.y=608; modal.appendChild(closeBtn);
    const closeLbl=await tx("Закрити",14,"Medium","#ffffff",{ls:-0.15,lh:20}); closeLbl.x=Math.round((512-closeLbl.width)/2); closeLbl.y=12; closeBtn.appendChild(closeLbl);
  }

  async function buildScreenSearchResults(page: PageNode): Promise<void> {
    page.name="09 · Результати пошуку ТЗ";
    const root=frS("РезультатиПошуку",1440,900,"#ffffff"); root.x=0; root.y=0; page.appendChild(root);
    await buildSidebar(root);
    const main=frS("Main",1260,900,"#ffffff"); main.x=180; main.y=0; root.appendChild(main);
    const back=rcS(36,36,"#f3f3f5",8); back.x=24; back.y=20; main.appendChild(back);
    const backArr=await tx("←",16,"Regular","#6a7282"); backArr.x=30; backArr.y=22; main.appendChild(backArr);
    const title=await tx("Результати пошуку",24,"SemiBold","#101828",{ls:-0.44,lh:32}); title.x=72; title.y=22; main.appendChild(title);
    const query=await tx("VIN: H7TX98234L0012345",14,"Regular","#6a7282",{fam:"Courier New",lh:20}); query.x=72; query.y=58; main.appendChild(query);
    ln(main,0,88,1260);
    const vehicles:[string,string,string,string,string][]=[["Toyota Camry","2024","Silver","$28 500","Нереалізовано"],["Toyota Camry","2022","White","$22 000","Реалізовано"],["Toyota Corolla","2023","Black","$21 900","Нереалізовано"],["Toyota RAV4","2024","Gray","$35 800","В обробці"]];
    for (let i=0;i<vehicles.length;i++) {
      const col=i%3, row=Math.floor(i/3);
      const card=frS(`VehCard/${i}`,380,280,"#ffffff"); card.cornerRadius=14; card.strokes=[bp(0.1)]; card.strokeWeight=1; card.x=24+col*396; card.y=104+row*296; main.appendChild(card);
      const img=rcS(332,140,"#f3f3f5",10); img.x=24; img.y=16; card.appendChild(img);
      const imgLbl=await tx("Фото ТЗ",12,"Regular","#bcbcbc"); imgLbl.x=140; imgLbl.y=70; card.appendChild(imgLbl);
      const vName=await tx(vehicles[i][0],16,"Medium","#0a0a0a",{ls:-0.31,lh:24}); vName.x=24; vName.y=168; card.appendChild(vName);
      const yr=await tx(vehicles[i][1]+" · "+vehicles[i][2],13,"Regular","#6a7282",{ls:-0.15,lh:18}); yr.x=24; yr.y=196; card.appendChild(yr);
      const price=await tx(vehicles[i][3],16,"SemiBold","#101828",{ls:-0.31,lh:24}); price.x=24; price.y=220; card.appendChild(price);
      const badgeColor=vehicles[i][4]==="Реалізовано"?"#fde8ec":vehicles[i][4]==="В обробці"?"#fff3e0":"#e6f9ef";
      const badgeTxt=vehicles[i][4]==="Реалізовано"?"#d4183d":vehicles[i][4]==="В обробці"?"#d08700":"#00a63e";
      const badge=frS(`Badge/${i}`,140,26,badgeColor); badge.cornerRadius=8; badge.x=24; badge.y=248; card.appendChild(badge);
      const bLbl=await tx(vehicles[i][4],11,"Medium",badgeTxt,{ls:-0.15,lh:16}); bLbl.x=10; bLbl.y=5; badge.appendChild(bLbl);
    }
  }

  await preloadSC();
  figma.root.name="ЄДРТЗВ — Screens";
  const screenBuilders: ((p: PageNode)=>Promise<void>)[]=[
    buildScreenVehicleList, buildScreenVehicleDetail, buildScreenDocList,
    buildScreenSearch, buildScreenVerification, buildScreenCondition,
    buildScreenCommittent, buildScreenDocuments, buildScreenSearchResults,
  ];
  while (figma.root.children.length < screenBuilders.length) figma.createPage();
  const pages=figma.root.children.slice(0,screenBuilders.length) as PageNode[];
  const errors: string[]=[];
  for (let i=0;i<screenBuilders.length;i++) {
    await figma.setCurrentPageAsync(pages[i]); for (const c of [...pages[i].children]) c.remove();
    try { await screenBuilders[i](pages[i]); } catch(err) { errors.push(`Сторінка ${i+1}: ${String(err)}`); console.error(`Screen ${i+1} error:`,err); }
  }
  await figma.setCurrentPageAsync(pages[0]);
  figma.viewport.scrollAndZoomIntoView(pages[0].children);
  if (errors.length > 0) { figma.notify(`Готово з ${errors.length} помилками — перевір консоль`, {timeout:6000}); }
  else { figma.notify(`Міграцію завершено — ${screenBuilders.length} екранів`, {timeout:5000}); }
  figma.closePlugin();
}
