"use strict";
// ЄДРТЗВ → Figma Importer
// Reads the DOM-serialized JSON and creates real Figma nodes.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 356, height: 640, title: "Migra Thor → Figma Import" });
// ── Font cache ────────────────────────────────────────────────
const loadedFonts = new Set();
function loadFont(family, weight) {
    return __awaiter(this, void 0, void 0, function* () {
        const style = weight >= 700 ? "Bold" :
            weight >= 600 ? "SemiBold" :
                weight >= 500 ? "Medium" : "Regular";
        const candidates = [
            { family, style },
            { family: "Inter", style },
            { family: "Inter", style: "Regular" },
        ];
        for (const font of candidates) {
            const key = `${font.family}:${font.style}`;
            if (loadedFonts.has(key))
                return font;
            try {
                yield figma.loadFontAsync(font);
                loadedFonts.add(key);
                return font;
            }
            catch (_) { }
        }
        return { family: "Inter", style: "Regular" };
    });
}
// ── Node builders ─────────────────────────────────────────────
function applyFills(node, fills) {
    node.fills = fills.map(f => ({
        type: "SOLID",
        color: f.color,
        opacity: f.opacity,
    }));
}
function applyStrokes(node, strokes, weight) {
    if (strokes.length > 0) {
        node.strokes = strokes.map(s => ({
            type: "SOLID",
            color: s.color,
            opacity: s.opacity,
        }));
        node.strokeWeight = weight;
        node.strokeAlign = "INSIDE";
    }
}
function decodeBase64(base64) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const cleaned = base64.replace(/[\r\n\s=]/g, "");
    const bytes = [];
    let buffer = 0;
    let bits = 0;
    for (const char of cleaned) {
        const value = alphabet.indexOf(char);
        if (value < 0)
            continue;
        buffer = (buffer << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
        }
    }
    return new Uint8Array(bytes);
}
function imageBytesFromDataUrl(dataUrl) {
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return decodeBase64(base64);
}
function makeFallbackFill() {
    return [{ type: "SOLID", color: { r: 0.95, g: 0.96, b: 0.98 }, opacity: 1 }];
}
function buildNode(layer) {
    return __awaiter(this, void 0, void 0, function* () {
        if (layer.width < 1 || layer.height < 1)
            return null;
        if (layer.type === "TEXT") {
            const node = figma.createText();
            node.name = layer.name;
            const fontName = yield loadFont(layer.fontFamily || "Inter", layer.fontWeight || 400);
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
                }
                catch (_) {
                    applyFills(node, layer.fills.length > 0 ? layer.fills : makeFallbackFill());
                }
            }
            else {
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
            }
            catch (_) {
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
        applyFills(node, layer.fills.length > 0 ? layer.fills : [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0 }]);
        applyStrokes(node, layer.strokes, layer.strokeWeight);
        if (layer.children) {
            for (const child of layer.children) {
                const childNode = yield buildNode(child);
                if (childNode) {
                    node.appendChild(childNode);
                    childNode.x = child.x;
                    childNode.y = child.y;
                }
            }
        }
        return node;
    });
}
// ── Main import ───────────────────────────────────────────────
function importLayers(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = figma.currentPage;
        // Pre-load common fonts
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
        yield figma.loadFontAsync({ family: "Inter", style: "Medium" });
        try {
            yield figma.loadFontAsync({ family: "Inter", style: "SemiBold" });
        }
        catch (_) { }
        const root = yield buildNode(data.root);
        if (!root)
            throw new Error("Failed to build root node");
        root.name = data.title || "Imported Screen";
        // Place to the right of existing content
        const existing = page.children;
        const maxX = existing.reduce((m, n) => Math.max(m, n.x + ("width" in n ? n.width : 0)), 0);
        root.x = maxX > 0 ? maxX + 80 : 0;
        root.y = 0;
        page.appendChild(root);
        figma.currentPage.selection = [root];
        figma.viewport.scrollAndZoomIntoView([root]);
    });
}
// ── Message handler ───────────────────────────────────────────
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type !== "import")
        return;
    try {
        yield importLayers(msg.data);
        const count = countLayers(msg.data.root);
        figma.ui.postMessage({ type: "done", count });
        figma.notify(`✅ Імпортовано — ${count} шарів`, { timeout: 4000 });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        figma.ui.postMessage({ type: "error", message });
        figma.notify(`❌ ${message}`, { error: true });
    }
});
function countLayers(layer) {
    var _a, _b;
    return 1 + ((_b = (_a = layer.children) === null || _a === void 0 ? void 0 : _a.reduce((s, c) => s + countLayers(c), 0)) !== null && _b !== void 0 ? _b : 0);
}
