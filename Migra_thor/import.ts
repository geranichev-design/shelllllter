// ЄДРТЗВ → Figma Importer
// Reads the DOM-serialized JSON and creates real Figma nodes.

figma.showUI(__html__, { width: 356, height: 640, title: "Migra Thor → Figma Import" });

// ── Types (mirror of domToFigma.ts) ──────────────────────────

interface FigmaFill  { type: "SOLID"; color: { r:number;g:number;b:number }; opacity: number }
interface FigmaStroke{ type: "SOLID"; color: { r:number;g:number;b:number }; opacity: number }

interface Layer {
  type: "FRAME" | "RECTANGLE" | "TEXT" | "IMAGE" | "SVG";
  name: string;
  x: number; y: number;
  width: number; height: number;
  fills: FigmaFill[];
  strokes: FigmaStroke[];
  strokeWeight: number;
  cornerRadius: number;
  opacity: number;
  // TEXT
  characters?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textColor?: { r:number;g:number;b:number };
  imageData?: string;
  svg?: string;
  overflow?: boolean;
  // children
  children?: Layer[];
}

interface ExportData {
  version: 1;
  title: string;
  viewport: { width:number; height:number };
  root: Layer;
}

// ── Font cache ────────────────────────────────────────────────

const loadedFonts = new Set<string>();

async function loadFont(family: string, weight: number): Promise<FontName> {
  const style =
    weight >= 700 ? "Bold" :
    weight >= 600 ? "SemiBold" :
    weight >= 500 ? "Medium" : "Regular";

  const candidates: FontName[] = [
    { family, style },
    { family: "Inter", style },
    { family: "Inter", style: "Regular" },
  ];

  for (const font of candidates) {
    const key = `${font.family}:${font.style}`;
    if (loadedFonts.has(key)) return font;
    try {
      await figma.loadFontAsync(font);
      loadedFonts.add(key);
      return font;
    } catch (_) {}
  }
  return { family: "Inter", style: "Regular" };
}

// ── Node builders ─────────────────────────────────────────────

function applyFills(node: GeometryMixin, fills: FigmaFill[]) {
  node.fills = fills.map(f => ({
    type: "SOLID" as const,
    color: f.color,
    opacity: f.opacity,
  }));
}

function applyStrokes(node: GeometryMixin & MinimalStrokesMixin, strokes: FigmaStroke[], weight: number) {
  if (strokes.length > 0) {
    node.strokes = strokes.map(s => ({
      type: "SOLID" as const,
      color: s.color,
      opacity: s.opacity,
    }));
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

function makeFallbackFill(): FigmaFill[] {
  return [{ type: "SOLID", color: { r: 0.95, g: 0.96, b: 0.98 }, opacity: 1 }];
}

async function buildNode(layer: Layer): Promise<SceneNode | null> {
  if (layer.width < 1 || layer.height < 1) return null;

  if (layer.type === "TEXT") {
    const node = figma.createText();
    node.name = layer.name;

    const fontName = await loadFont(layer.fontFamily || "Inter", layer.fontWeight || 400);
    node.fontName = fontName;
    node.fontSize = layer.fontSize || 14;
    node.characters = layer.characters || "";

    if (layer.letterSpacing != null)
      node.letterSpacing = { value: layer.letterSpacing, unit: "PIXELS" };
    if (layer.lineHeight != null && layer.lineHeight > 0)
      node.lineHeight = { value: layer.lineHeight, unit: "PIXELS" };

    if (layer.textColor) {
      node.fills = [{ type: "SOLID", color: layer.textColor, opacity: 1 }];
    }

    node.opacity = layer.opacity;
    node.textAutoResize = "HEIGHT";
    node.resize(Math.max(layer.width, 1), Math.max(layer.height, 1));
    return node;
  }

  if (layer.type === "RECTANGLE") {
    const node = figma.createRectangle();
    node.name = layer.name;
    node.resize(layer.width, layer.height);
    node.cornerRadius = layer.cornerRadius;
    node.opacity = layer.opacity;
    applyFills(node, layer.fills);
    applyStrokes(node, layer.strokes, layer.strokeWeight);
    return node;
  }

  if (layer.type === "IMAGE") {
    const node = figma.createRectangle();
    node.name = layer.name;
    node.resize(layer.width, layer.height);
    node.cornerRadius = layer.cornerRadius;
    node.opacity = layer.opacity;
    if (layer.imageData) {
      try {
        const image = figma.createImage(imageBytesFromDataUrl(layer.imageData));
        node.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
      } catch (_) {
        applyFills(node, layer.fills.length > 0 ? layer.fills : makeFallbackFill());
      }
    } else {
      applyFills(node, layer.fills.length > 0 ? layer.fills : makeFallbackFill());
    }
    applyStrokes(node, layer.strokes, layer.strokeWeight);
    return node;
  }

  if (layer.type === "SVG" && layer.svg) {
    try {
      const node = figma.createNodeFromSvg(layer.svg);
      node.name = layer.name;
      node.resize(layer.width, layer.height);
      node.opacity = layer.opacity;
      return node;
    } catch (_) {
      const fallback = figma.createRectangle();
      fallback.name = layer.name;
      fallback.resize(layer.width, layer.height);
      fallback.cornerRadius = layer.cornerRadius;
      fallback.opacity = layer.opacity;
      applyFills(fallback, layer.fills.length > 0 ? layer.fills : makeFallbackFill());
      applyStrokes(fallback, layer.strokes, layer.strokeWeight);
      return fallback;
    }
  }

  // FRAME
  const node = figma.createFrame();
  node.name = layer.name;
  node.resize(layer.width, layer.height);
  node.cornerRadius = layer.cornerRadius;
  node.opacity = layer.opacity;
  node.clipsContent = layer.fills.some(f => f.opacity > 0) || !!layer.overflow;
  applyFills(node, layer.fills.length > 0 ? layer.fills : [{ type: "SOLID", color: { r:1, g:1, b:1 }, opacity: 0 }]);
  applyStrokes(node, layer.strokes, layer.strokeWeight);

  if (layer.children) {
    for (const child of layer.children) {
      const childNode = await buildNode(child);
      if (childNode) {
        node.appendChild(childNode);
        childNode.x = child.x;
        childNode.y = child.y;
      }
    }
  }

  return node;
}

// ── Main import ───────────────────────────────────────────────

async function importLayers(data: ExportData): Promise<void> {
  const page = figma.currentPage;

  // Pre-load common fonts
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  try { await figma.loadFontAsync({ family: "Inter", style: "SemiBold" }); } catch(_){}

  const root = await buildNode(data.root);
  if (!root) throw new Error("Failed to build root node");

  root.name = data.title || "Imported Screen";
  // Place to the right of existing content
  const existing = page.children;
  const maxX = existing.reduce((m, n) => Math.max(m, n.x + ("width" in n ? (n as { width: number }).width : 0)), 0);
  root.x = maxX > 0 ? maxX + 80 : 0;
  root.y = 0;

  page.appendChild(root);
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
}

// ── Message handler ───────────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  if (msg.type !== "import") return;

  try {
    await importLayers(msg.data as ExportData);
    const count = countLayers(msg.data.root);
    figma.ui.postMessage({ type: "done", count });
    figma.notify(`✅ Імпортовано — ${count} шарів`, { timeout: 4000 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    figma.ui.postMessage({ type: "error", message });
    figma.notify(`❌ ${message}`, { error: true });
  }
};

function countLayers(layer: Layer): number {
  return 1 + (layer.children?.reduce((s, c) => s + countLayers(c), 0) ?? 0);
}
