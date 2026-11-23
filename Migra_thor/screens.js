"use strict";
// ЄДРТЗВ — Screen Migration Tool
// Відтворює всі 15 екранів проєкту у Figma
// 1440×900px desktop frames
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// ── Font cache ────────────────────────────────────────────────
const _loaded = new Set();
function lf(family, style) {
    return __awaiter(this, void 0, void 0, function* () {
        const k = `${family}:${style}`;
        if (_loaded.has(k))
            return;
        try {
            yield figma.loadFontAsync({ family, style });
            _loaded.add(k);
        }
        catch (_) {
            try {
                yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
            }
            catch (__) { }
        }
    });
}
function preload() {
    return __awaiter(this, void 0, void 0, function* () {
        const list = [
            ["Inter", "Regular"], ["Inter", "Medium"], ["Inter", "SemiBold"], ["Inter", "Bold"],
            ["Courier New", "Regular"],
        ];
        for (const [f, s] of list) {
            try {
                yield figma.loadFontAsync({ family: f, style: s });
                _loaded.add(`${f}:${s}`);
            }
            catch (_) { }
        }
    });
}
// ── Helpers ───────────────────────────────────────────────────
function h2r(hex) {
    const c = hex.replace("#", "");
    return { r: parseInt(c.slice(0, 2), 16) / 255, g: parseInt(c.slice(2, 4), 16) / 255, b: parseInt(c.slice(4, 6), 16) / 255 };
}
function sf(hex, opacity = 1) { return { type: "SOLID", color: h2r(hex), opacity }; }
function bp(o = 0.1) { return { type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: o }; }
function fr(name, w, h, bg = "") {
    const f = figma.createFrame();
    f.name = name;
    f.resize(w, h);
    f.fills = bg ? [sf(bg)] : [];
    f.clipsContent = false;
    return f;
}
function rc(w, h, bg, r = 0) {
    const n = figma.createRectangle();
    n.resize(w, h);
    n.fills = [sf(bg)];
    n.cornerRadius = r;
    return n;
}
function el(w, h, bg) {
    const n = figma.createEllipse();
    n.resize(w, h);
    n.fills = [sf(bg)];
    return n;
}
function tx(s_1, size_1, style_1, color_1) {
    return __awaiter(this, arguments, void 0, function* (s, size, style, color, opts = {}) {
        const fam = opts.fam || "Inter";
        yield lf(fam, style);
        const n = figma.createText();
        try {
            n.fontName = { family: fam, style };
        }
        catch (_) {
            n.fontName = { family: "Inter", style: "Regular" };
        }
        n.fontSize = size;
        n.characters = s;
        n.fills = [sf(color)];
        if (opts.ls != null)
            n.letterSpacing = { value: opts.ls, unit: "PIXELS" };
        if (opts.lh != null)
            n.lineHeight = { value: opts.lh, unit: "PIXELS" };
        return n;
    });
}
function ln(parent, x, y, w, color = "#e5e7eb") {
    const r = rc(w, 1, color);
    r.x = x;
    r.y = y;
    parent.appendChild(r);
}
// ── Shared: Sidebar ───────────────────────────────────────────
function buildSidebar(parent) {
    return __awaiter(this, void 0, void 0, function* () {
        const sb = fr("Sidebar", 180, 900, "#ffffff");
        sb.strokes = [{ type: "SOLID", color: h2r("#e5e7eb"), opacity: 1 }];
        sb.strokeAlign = "OUTSIDE";
        sb.strokeWeight = 1;
        parent.appendChild(sb);
        // Logo
        const logo = yield tx("ЄДРТЗВ", 16, "SemiBold", "#101828", { ls: -0.3, lh: 22 });
        logo.x = 20;
        logo.y = 20;
        sb.appendChild(logo);
        ln(sb, 0, 52, 180);
        // Nav items
        const navItems = [
            ["Список ТЗ", false, "#6a7282"],
            ["Документи", false, "#6a7282"],
            ["Пошук", true, "#2b7fff"],
            ["Звіти", false, "#6a7282"],
            ["Налаштування", false, "#6a7282"],
        ];
        for (let i = 0; i < navItems.length; i++) {
            const [label, active, color] = navItems[i];
            if (active) {
                const bar = rc(180, 40, "#eff6ff");
                bar.x = 0;
                bar.y = 64 + i * 48;
                sb.appendChild(bar);
            }
            const lbl = yield tx(label, 14, active ? "Medium" : "Regular", color, { ls: -0.15, lh: 20 });
            lbl.x = 20;
            lbl.y = 74 + i * 48;
            sb.appendChild(lbl);
        }
        ln(sb, 16, 316, 148);
        // Stats cards
        const statsLabel = yield tx("Статистика", 12, "Medium", "#737373", { ls: -0.15, lh: 16 });
        statsLabel.x = 20;
        statsLabel.y = 326;
        sb.appendChild(statsLabel);
        const stats = [
            ["63", "Всього документів", "#101828"],
            ["22", "Акт тех. стану", "#00a63e"],
            ["5", "Договір комісії", "#457dcf"],
        ];
        for (let i = 0; i < stats.length; i++) {
            const card = fr(`Stat/${i}`, 148, 60, "#f9fafb");
            card.cornerRadius = 10;
            card.x = 16;
            card.y = 348 + i * 72;
            sb.appendChild(card);
            const num = yield tx(stats[i][0], 20, "SemiBold", stats[i][2], { ls: -0.44, lh: 28 });
            num.x = 12;
            num.y = 8;
            card.appendChild(num);
            const lbl = yield tx(stats[i][1], 11, "Regular", "#6a7282", { ls: -0.15, lh: 14 });
            lbl.x = 12;
            lbl.y = 36;
            card.appendChild(lbl);
        }
        ln(sb, 16, 800, 148);
        // User
        const avatar = el(32, 32, "#2b7fff");
        avatar.x = 20;
        avatar.y = 820;
        sb.appendChild(avatar);
        const initials = yield tx("JS", 12, "Medium", "#ffffff");
        initials.x = 31;
        initials.y = 828;
        sb.appendChild(initials);
        const uname = yield tx("John Smith", 13, "Medium", "#101828", { ls: -0.15, lh: 18 });
        uname.x = 60;
        uname.y = 820;
        sb.appendChild(uname);
        const urole = yield tx("Адміністратор", 11, "Regular", "#6a7282", { ls: -0.15, lh: 14 });
        urole.x = 60;
        urole.y = 840;
        sb.appendChild(urole);
    });
}
// ── Shared: Table ─────────────────────────────────────────────
function buildTable(parent, x, y, w, headers, rows, colWidths) {
    return __awaiter(this, void 0, void 0, function* () {
        const hRow = fr("Table/Header", w, 40, "#f9fafb");
        hRow.cornerRadius = 10;
        hRow.x = x;
        hRow.y = y;
        parent.appendChild(hRow);
        let cx = 16;
        for (let i = 0; i < headers.length; i++) {
            const h = yield tx(headers[i].toUpperCase(), 11, "Medium", "#6a7282", { ls: 0.6, lh: 16 });
            h.x = cx;
            h.y = 12;
            hRow.appendChild(h);
            cx += colWidths[i];
        }
        ln(parent, x, y + 40, w);
        for (let r = 0; r < rows.length; r++) {
            const row = fr(`Row/${r}`, w, 52, r % 2 === 0 ? "#ffffff" : "#fafafa");
            row.x = x;
            row.y = y + 40 + r * 52;
            parent.appendChild(row);
            ln(row, 0, 51, w);
            let dx = 16;
            for (let c = 0; c < rows[r].length; c++) {
                const cell = yield tx(rows[r][c], 13, "Regular", "#101828", { ls: -0.15, lh: 18, fam: c === 3 ? "Courier New" : "Inter" });
                cell.x = dx;
                cell.y = 17;
                row.appendChild(cell);
                dx += colWidths[c];
            }
        }
        return y + 40 + rows.length * 52 + 24;
    });
}
// ── Shared: Progress Bar ──────────────────────────────────────
function buildProgressBar(parent, x, y, w, activeStep) {
    const total = 4;
    const segW = Math.floor((w - 8) / total);
    for (let i = 0; i < total; i++) {
        const seg = rc(segW, 4, i < activeStep ? "#2b7fff" : "#e5e7eb", 9999);
        seg.x = x + i * (segW + 2);
        seg.y = y;
        parent.appendChild(seg);
    }
}
// ── Shared: Wizard Header ─────────────────────────────────────
function buildWizardHeader(parent, title, step, stepLabel) {
    return __awaiter(this, void 0, void 0, function* () {
        const hdr = yield tx(title, 18, "SemiBold", "#0a0a0a", { ls: -0.44, lh: 27 });
        hdr.x = 24;
        hdr.y = 20;
        parent.appendChild(hdr);
        const close = rc(24, 24, "#f3f3f5", 6);
        close.x = parent.width - 48;
        close.y = 18;
        parent.appendChild(close);
        const x = rc(10, 10, "#525252", 2);
        x.x = parent.width - 43;
        x.y = 25;
        parent.appendChild(x);
        buildProgressBar(parent, 24, 60, parent.width - 48, step);
        const stepCircle = fr(`Step/${step}`, 32, 32, "#2b7fff");
        stepCircle.cornerRadius = 10;
        stepCircle.x = 24;
        stepCircle.y = 80;
        parent.appendChild(stepCircle);
        const stepNum = yield tx(String(step), 14, "SemiBold", "#ffffff");
        stepNum.x = 11;
        stepNum.y = 8;
        stepCircle.appendChild(stepNum);
        const stepLbl = yield tx(stepLabel, 18, "SemiBold", "#101828", { ls: -0.44, lh: 27 });
        stepLbl.x = 64;
        stepLbl.y = 82;
        parent.appendChild(stepLbl);
        ln(parent, 24, 122, parent.width - 48);
    });
}
// ── Screen builders ───────────────────────────────────────────
// 1 — Головний екран: Список ТЗ
function buildScreenVehicleList(page) {
    return __awaiter(this, void 0, void 0, function* () {
        page.name = "01 · Список ТЗ";
        const root = fr("Головний екран — Список ТЗ", 1440, 900, "#ffffff");
        root.x = 0;
        root.y = 0;
        page.appendChild(root);
        yield buildSidebar(root);
        const main = fr("Main", 1260, 900, "#ffffff");
        main.x = 180;
        main.y = 0;
        root.appendChild(main);
        // Header
        const back = rc(36, 36, "#f3f3f5", 8);
        back.x = 24;
        back.y = 20;
        main.appendChild(back);
        const backArr = yield tx("←", 16, "Regular", "#6a7282");
        backArr.x = 30;
        backArr.y = 22;
        main.appendChild(backArr);
        const title = yield tx("Список транспортних засобів", 24, "SemiBold", "#101828", { ls: -0.44, lh: 32 });
        title.x = 72;
        title.y = 22;
        main.appendChild(title);
        // Tabs + actions row
        const tabs = fr("Tabs", 480, 40, "#ececf0");
        tabs.cornerRadius = 14;
        tabs.x = 24;
        tabs.y = 72;
        main.appendChild(tabs);
        const tabLabels = ["Всі ТЗ", "Активні", "Архів"];
        for (let i = 0; i < tabLabels.length; i++) {
            const active = i === 0;
            const tab = fr(`Tab/${i}`, 152, 34, active ? "#ffffff" : "");
            tab.fills = active ? [sf("#ffffff")] : [];
            tab.cornerRadius = 10;
            tab.x = 4 + i * 156;
            tab.y = 3;
            tabs.appendChild(tab);
            const lbl = yield tx(tabLabels[i], 14, active ? "Medium" : "Regular", active ? "#0a0a0a" : "#737373", { ls: -0.15, lh: 20 });
            lbl.x = Math.round((152 - lbl.width) / 2);
            lbl.y = 7;
            tab.appendChild(lbl);
        }
        const addBtn = fr("Btn/Add", 100, 40, "#2b7fff");
        addBtn.cornerRadius = 8;
        addBtn.x = 1116;
        addBtn.y = 72;
        main.appendChild(addBtn);
        const addLbl = yield tx("+ Додати", 14, "Medium", "#ffffff", { ls: -0.15, lh: 20 });
        addLbl.x = 18;
        addLbl.y = 10;
        addBtn.appendChild(addLbl);
        const filterBtn = fr("Btn/Filter", 100, 40, "#ffffff");
        filterBtn.cornerRadius = 8;
        filterBtn.strokes = [{ type: "SOLID", color: h2r("#bcbcbc"), opacity: 1 }];
        filterBtn.strokeWeight = 1;
        filterBtn.x = 1008;
        filterBtn.y = 72;
        main.appendChild(filterBtn);
        const filterLbl = yield tx("Фільтр", 14, "Regular", "#bcbcbc", { ls: -0.15, lh: 20 });
        filterLbl.x = 22;
        filterLbl.y = 10;
        filterBtn.appendChild(filterLbl);
        ln(main, 0, 124, 1260);
        // Table
        const headers = ["ТРАНСПОРТНИЙ ЗАСІБ", "РІК", "КОЛІР", "VIN", "ЦІНА", "СТАТУС"];
        const colW = [280, 80, 120, 220, 100, 180];
        const rows = [
            ["Toyota Camry", "2024", "Silver", "1HGBH41JXMN109186", "$28 500", "Нереалізовано"],
            ["BMW 3 Series", "2022", "Black", "WBAJB91040B297625", "$32 000", "В обробці"],
            ["Volkswagen Passat", "2023", "White", "WVWZZZ3CZPE123456", "$24 900", "Нереалізовано"],
            ["Audi A4", "2021", "Gray", "WAUZZZ8K9BA012345", "$27 800", "Реалізовано"],
            ["Mercedes C200", "2023", "Blue", "WDD2050422R123456", "$38 500", "Нереалізовано"],
        ];
        yield buildTable(main, 24, 124, 1212, headers, rows, colW);
    });
}
// 2 — АрмТоргуючі: Деталі ТЗ з документами
function buildScreenVehicleDetail(page) {
    return __awaiter(this, void 0, void 0, function* () {
        page.name = "02 · Деталі ТЗ";
        const root = fr("АрмТоргуючі — Деталі ТЗ", 1440, 900, "#ffffff");
        root.x = 0;
        root.y = 0;
        page.appendChild(root);
        yield buildSidebar(root);
        const main = fr("Main", 1260, 900, "#ffffff");
        main.x = 180;
        main.y = 0;
        root.appendChild(main);
        // Header
        const back = rc(36, 36, "#f3f3f5", 8);
        back.x = 24;
        back.y = 20;
        main.appendChild(back);
        const backArr = yield tx("←", 16, "Regular", "#6a7282");
        backArr.x = 30;
        backArr.y = 22;
        main.appendChild(backArr);
        const title = yield tx("Toyota Camry (2024)", 24, "SemiBold", "#101828", { ls: -0.44, lh: 32 });
        title.x = 72;
        title.y = 16;
        main.appendChild(title);
        const vin = yield tx("1HGBH41JXMN109186", 13, "Regular", "#6a7282", { fam: "Courier New", lh: 18 });
        vin.x = 72;
        vin.y = 50;
        main.appendChild(vin);
        // Status badge
        const badge = fr("Badge", 100, 26, "#e6f9ef");
        badge.cornerRadius = 8;
        badge.strokes = [bp(0.1)];
        badge.strokeWeight = 1;
        badge.x = 380;
        badge.y = 23;
        main.appendChild(badge);
        const badgeLbl = yield tx("Доступно", 12, "Medium", "#00a63e", { ls: -0.15, lh: 16 });
        badgeLbl.x = 12;
        badgeLbl.y = 5;
        badge.appendChild(badgeLbl);
        // Tab navigation
        const tabNav = fr("TabNav", 400, 36, "#ececf0");
        tabNav.cornerRadius = 14;
        tabNav.x = 24;
        tabNav.y = 76;
        main.appendChild(tabNav);
        const tabNavItems = ["Інформація", "Документи (3)", "Перевірки (2)"];
        for (let i = 0; i < tabNavItems.length; i++) {
            const active = i === 1;
            const tab = fr(`T/${i}`, 126, 30, active ? "#ffffff" : "");
            tab.fills = active ? [sf("#ffffff")] : [];
            tab.cornerRadius = 10;
            tab.x = 3 + i * 130;
            tab.y = 3;
            tabNav.appendChild(tab);
            const lbl = yield tx(tabNavItems[i], 13, active ? "Medium" : "Regular", active ? "#0a0a0a" : "#737373", { ls: -0.15, lh: 18 });
            lbl.x = Math.round((126 - lbl.width) / 2);
            lbl.y = 6;
            tab.appendChild(lbl);
        }
        ln(main, 0, 124, 1260);
        // Filter row
        const filterRow = fr("Filters", 1212, 44);
        filterRow.fills = [];
        filterRow.x = 24;
        filterRow.y = 136;
        main.appendChild(filterRow);
        const filterInputs = ["Тип документу", "Статус документу", "Період"];
        for (let i = 0; i < filterInputs.length; i++) {
            const inp = fr(`F/${i}`, 180, 40, "#f3f3f5");
            inp.cornerRadius = 10;
            inp.x = i * 196;
            inp.y = 2;
            filterRow.appendChild(inp);
            const ph = yield tx(filterInputs[i], 13, "Regular", "#717182", { ls: -0.15, lh: 18 });
            ph.x = 12;
            ph.y = 11;
            inp.appendChild(ph);
        }
        const resetBtn = fr("Reset", 100, 40);
        resetBtn.fills = [];
        resetBtn.strokes = [{ type: "SOLID", color: h2r("#2b7fff"), opacity: 1 }];
        resetBtn.strokeWeight = 1.5;
        resetBtn.cornerRadius = 8;
        resetBtn.x = 600;
        resetBtn.y = 2;
        filterRow.appendChild(resetBtn);
        const resetLbl = yield tx("Скинути", 13, "Medium", "#2b7fff", { ls: -0.15, lh: 18 });
        resetLbl.x = 18;
        resetLbl.y = 11;
        resetBtn.appendChild(resetLbl);
        ln(main, 0, 192, 1260);
        // Documents table
        const docHeaders = ["ТИП ДОКУМЕНТУ", "№ ДОГОВОРУ", "СТАТУС", "VIN", "ДАТА", "ТЕХПАСПОРТ"];
        const docColW = [220, 160, 140, 200, 100, 130];
        const docRows = [
            ["Акт технічного стану", "VIDI-62813", "згенеровано", "1HGBH41JXMN109186", "16.01.2024", "КРТ №274865"],
            ["Договір купівлі-продажу", "Договір №4827", "підписано", "1HGBH41JXMN109186", "18.01.2024", "КРТ №274865"],
            ["Акт огляду ТЗ", "VIDI-62814", "чернетка", "1HGBH41JXMN109186", "20.01.2024", "—"],
        ];
        yield buildTable(main, 24, 204, 1212, docHeaders, docRows, docColW);
    });
}
// 3 — Головний екран: Список Документів
function buildScreenDocList(page) {
    return __awaiter(this, void 0, void 0, function* () {
        page.name = "03 · Список документів";
        const root = fr("Головний екран — Документи", 1440, 900, "#f9fafb");
        root.x = 0;
        root.y = 0;
        page.appendChild(root);
        yield buildSidebar(root);
        const main = fr("Main", 1260, 900, "#f9fafb");
        main.x = 180;
        main.y = 0;
        root.appendChild(main);
        // Header
        const title = yield tx("Документи", 24, "SemiBold", "#101828", { ls: -0.44, lh: 32 });
        title.x = 24;
        title.y = 24;
        main.appendChild(title);
        // Search + filter
        const search = fr("Search", 360, 40, "#ffffff");
        search.cornerRadius = 10;
        search.strokes = [{ type: "SOLID", color: h2r("#e5e7eb"), opacity: 1 }];
        search.strokeWeight = 1;
        search.x = 24;
        search.y = 76;
        main.appendChild(search);
        const ph = yield tx("Пошук документів...", 13, "Regular", "#737373", { ls: -0.15, lh: 18 });
        ph.x = 12;
        ph.y = 11;
        search.appendChild(ph);
        const addBtn = fr("Add", 120, 40, "#2b7fff");
        addBtn.cornerRadius = 8;
        addBtn.x = 1116;
        addBtn.y = 76;
        main.appendChild(addBtn);
        const addLbl = yield tx("+ Додати", 14, "Medium", "#ffffff", { ls: -0.15, lh: 20 });
        addLbl.x = 16;
        addLbl.y = 10;
        addBtn.appendChild(addLbl);
        ln(main, 0, 128, 1260, "#e5e7eb");
        // Table
        const headers = ["ТИП ДОКУМЕНТУ", "№ ДОГОВОРУ", "СТАТУС", "VIN", "ДАТА", "МАРКА/МОДЕЛЬ"];
        const colW = [220, 160, 140, 200, 100, 200];
        const rows = [
            ["Акт технічного стану", "VIDI-62813", "згенеровано", "1HGBH41JXMN109186", "16.01.2024", "Toyota Camry"],
            ["Договір купівлі-продажу", "Договір №4827", "підписано", "WBAJB91040B297625", "18.01.2024", "BMW 3 Series"],
            ["Акт огляду ТЗ", "VIDI-62814", "чернетка", "WVWZZZ3CZPE123456", "20.01.2024", "Volkswagen Passat"],
            ["Угода з третіми особами", "УГД-00312", "підписано", "WAUZZZ8K9BA012345", "22.01.2024", "Audi A4"],
            ["Акт технічного стану", "VIDI-62820", "згенеровано", "WDD2050422R123456", "24.01.2024", "Mercedes C200"],
        ];
        yield buildTable(main, 24, 140, 1212, headers, rows, colW);
    });
}
// 4 — Wizard Step 1: Пошук авто
function buildScreenSearch(page) {
    return __awaiter(this, void 0, void 0, function* () {
        page.name = "04 · Wizard — Пошук авто";
        const root = fr("Screen/Пошук", 1440, 900, "#f9fafb");
        root.x = 0;
        root.y = 0;
        page.appendChild(root);
        // Modal overlay bg
        const overlay = rc(1440, 900, "#0a0a0a", 0);
        overlay.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.4 }];
        overlay.x = 0;
        overlay.y = 0;
        root.appendChild(overlay);
        // Modal
        const modal = fr("Modal/PoshukAvto", 600, 680, "#ffffff");
        modal.cornerRadius = 14;
        modal.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.18 }, offset: { x: 0, y: 8 }, radius: 32, spread: 0, visible: true, blendMode: "NORMAL" }];
        modal.x = 420;
        modal.y = 110;
        root.appendChild(modal);
        yield buildWizardHeader(modal, "Постановка ТЗ на комісію", 1, "Пошук авто");
        // Form
        const fieldDefs = [
            ["VIN (номер кузова)", "H7TX98234L0012345", "text"],
            ["Держ. номер", "АА1234ВВ", "text"],
        ];
        for (let i = 0; i < fieldDefs.length; i++) {
            const [label, placeholder] = fieldDefs[i];
            const lbl = yield tx(label, 13, "Medium", "#0a0a0a", { ls: -0.15, lh: 18 });
            lbl.x = 24;
            lbl.y = 140 + i * 80;
            modal.appendChild(lbl);
            const field = fr(`Field/${i}`, 552, 44, "#f3f3f5");
            field.cornerRadius = 10;
            field.x = 24;
            field.y = 162 + i * 80;
            modal.appendChild(field);
            const ph = yield tx(placeholder, 14, "Regular", "#737373", { ls: -0.15, lh: 20 });
            ph.x = 12;
            ph.y = 12;
            field.appendChild(ph);
        }
        const searchBtn = fr("Search", 552, 48, "#2b7fff");
        searchBtn.cornerRadius = 10;
        searchBtn.x = 24;
        searchBtn.y = 312;
        modal.appendChild(searchBtn);
        const searchLbl = yield tx("Шукати", 15, "SemiBold", "#ffffff", { ls: -0.15, lh: 22 });
        searchLbl.x = Math.round((552 - searchLbl.width) / 2);
        searchLbl.y = 13;
        searchBtn.appendChild(searchLbl);
        ln(modal, 24, 376, 552);
        // Results preview table
        const resTitle = yield tx("Результати пошуку", 14, "Medium", "#0a0a0a", { ls: -0.15, lh: 20 });
        resTitle.x = 24;
        resTitle.y = 388;
        modal.appendChild(resTitle);
        const resHeaders = ["МАРКА", "МОДЕЛЬ", "НОМЕР КУЗОВА", "ДЕРЖ. НОМЕР"];
        const resColW = [100, 100, 200, 120];
        const resRows = [
            ["Toyota", "Camry", "H7TX98234L0012345", "АА1234ВВ"],
            ["Toyota", "Corolla", "H7TX98234L0099999", "АА9999СС"],
        ];
        yield buildTable(modal, 24, 412, 552, resHeaders, resRows, resColW);
        // Footer
        ln(modal, 0, 620, 600);
        const nextBtn = fr("Next", 552, 44, "#2b7fff");
        nextBtn.cornerRadius = 10;
        nextBtn.x = 24;
        nextBtn.y = 628;
        modal.appendChild(nextBtn);
        const nextLbl = yield tx("Далі →", 14, "SemiBold", "#ffffff", { ls: -0.15, lh: 20 });
        nextLbl.x = Math.round((552 - nextLbl.width) / 2);
        nextLbl.y = 12;
        nextBtn.appendChild(nextLbl);
    });
}
// 5 — Wizard Step 2: Перевірка по базі
function buildScreenVerification(page) {
    return __awaiter(this, void 0, void 0, function* () {
        page.name = "05 · Wizard — Перевірка по базі";
        const root = fr("Screen/Перевірка", 1440, 900, "#f9fafb");
        root.x = 0;
        root.y = 0;
        page.appendChild(root);
        const overlay = rc(1440, 900, "#0a0a0a", 0);
        overlay.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.4 }];
        overlay.x = 0;
        overlay.y = 0;
        root.appendChild(overlay);
        const modal = fr("Modal/Verification", 640, 760, "#ffffff");
        modal.cornerRadius = 14;
        modal.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.18 }, offset: { x: 0, y: 8 }, radius: 32, spread: 0, visible: true, blendMode: "NORMAL" }];
        modal.x = 400;
        modal.y = 70;
        root.appendChild(modal);
        yield buildWizardHeader(modal, "Постановка ТЗ на комісію", 2, "Перевірка по базі");
        const checks = [
            ["Реєстрація ТЗ в Україні", "#00a63e", "✓"],
            ["Перевірка обтяжень", "#00a63e", "✓"],
            ["Перевірка на викрадення", "#00a63e", "✓"],
            ["Заборона відчуження", "#dc2626", "✗"],
            ["Митні обмеження", "#00a63e", "✓"],
            ["Перевірка страхування", "#d08700", "~"],
        ];
        const checkListFrame = fr("Checklist", 592, 320);
        checkListFrame.fills = [];
        checkListFrame.x = 24;
        checkListFrame.y = 140;
        modal.appendChild(checkListFrame);
        for (let i = 0; i < checks.length; i++) {
            const row = fr(`Check/${i}`, 592, 48, "#ffffff");
            row.cornerRadius = 8;
            row.strokes = [{ type: "SOLID", color: h2r("#e5e7eb"), opacity: 1 }];
            row.strokeWeight = 1;
            row.x = 0;
            row.y = i * 52;
            checkListFrame.appendChild(row);
            const circle = el(24, 24, checks[i][1] + ("22"));
            circle.x = 12;
            circle.y = 12;
            row.appendChild(circle);
            const icon = yield tx(checks[i][2], 13, "Medium", "#ffffff");
            icon.x = 16;
            icon.y = 14;
            row.appendChild(icon);
            const lbl = yield tx(checks[i][0], 14, "Regular", "#101828", { ls: -0.15, lh: 20 });
            lbl.x = 48;
            lbl.y = 14;
            row.appendChild(lbl);
        }
        ln(modal, 0, 480, 640);
        const prevBtn = fr("Prev", 280, 44, "#f3f3f5");
        prevBtn.cornerRadius = 10;
        prevBtn.x = 24;
        prevBtn.y = 492;
        modal.appendChild(prevBtn);
        const prevLbl = yield tx("← Назад", 14, "Medium", "#6a7282", { ls: -0.15, lh: 20 });
        prevLbl.x = Math.round((280 - prevLbl.width) / 2);
        prevLbl.y = 12;
        prevBtn.appendChild(prevLbl);
        const nextBtn = fr("Next", 280, 44, "#2b7fff");
        nextBtn.cornerRadius = 10;
        nextBtn.x = 336;
        nextBtn.y = 492;
        modal.appendChild(nextBtn);
        const nextLbl = yield tx("Далі →", 14, "SemiBold", "#ffffff", { ls: -0.15, lh: 20 });
        nextLbl.x = Math.round((280 - nextLbl.width) / 2);
        nextLbl.y = 12;
        nextBtn.appendChild(nextLbl);
    });
}
// 6 — Wizard Step 3: Стан ТЗ
function buildScreenCondition(page) {
    return __awaiter(this, void 0, void 0, function* () {
        page.name = "06 · Wizard — Стан ТЗ";
        const root = fr("Screen/СтанТЗ", 1440, 900, "#f9fafb");
        root.x = 0;
        root.y = 0;
        page.appendChild(root);
        const overlay = rc(1440, 900, "#0a0a0a", 0);
        overlay.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.4 }];
        overlay.x = 0;
        overlay.y = 0;
        root.appendChild(overlay);
        const modal = fr("Modal/Condition", 640, 780, "#ffffff");
        modal.cornerRadius = 14;
        modal.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.18 }, offset: { x: 0, y: 8 }, radius: 32, spread: 0, visible: true, blendMode: "NORMAL" }];
        modal.x = 400;
        modal.y = 60;
        root.appendChild(modal);
        yield buildWizardHeader(modal, "Постановка ТЗ на комісію", 3, "Стан ТЗ");
        const fields = [
            ["Стан кузову", "Відмінний"],
            ["Стан салону", "Добрий"],
            ["Двигун", "Справний, без зауважень"],
            ["Коробка передач", "Автоматична, справна"],
            ["Пробіг (км)", "15 000"],
            ["Ціна продажу (₴)", "1 140 000"],
        ];
        for (let i = 0; i < fields.length; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const lbl = yield tx(fields[i][0], 13, "Medium", "#0a0a0a", { ls: -0.15, lh: 18 });
            lbl.x = 24 + col * 308;
            lbl.y = 140 + row * 88;
            modal.appendChild(lbl);
            const field = fr(`F/${i}`, 280, 44, "#f3f3f5");
            field.cornerRadius = 10;
            field.x = 24 + col * 308;
            field.y = 162 + row * 88;
            modal.appendChild(field);
            const val = yield tx(fields[i][1], 14, "Regular", "#0a0a0a", { ls: -0.15, lh: 20 });
            val.x = 12;
            val.y = 12;
            field.appendChild(val);
        }
        const notesLbl = yield tx("Примітки", 13, "Medium", "#0a0a0a", { ls: -0.15, lh: 18 });
        notesLbl.x = 24;
        notesLbl.y = 404;
        modal.appendChild(notesLbl);
        const notes = fr("Notes", 592, 80, "#f3f3f5");
        notes.cornerRadius = 10;
        notes.x = 24;
        notes.y = 426;
        modal.appendChild(notes);
        const notesVal = yield tx("Відмінний стан, один власник, всі документи в порядку.", 14, "Regular", "#0a0a0a", { ls: -0.15, lh: 20 });
        notesVal.x = 12;
        notesVal.y = 12;
        notes.appendChild(notesVal);
        ln(modal, 0, 524, 640);
        const prevBtn = fr("Prev", 280, 44, "#f3f3f5");
        prevBtn.cornerRadius = 10;
        prevBtn.x = 24;
        prevBtn.y = 540;
        modal.appendChild(prevBtn);
        const prevLbl = yield tx("← Назад", 14, "Medium", "#6a7282", { ls: -0.15, lh: 20 });
        prevLbl.x = Math.round((280 - prevLbl.width) / 2);
        prevLbl.y = 12;
        prevBtn.appendChild(prevLbl);
        const nextBtn = fr("Next", 280, 44, "#2b7fff");
        nextBtn.cornerRadius = 10;
        nextBtn.x = 336;
        nextBtn.y = 540;
        modal.appendChild(nextBtn);
        const nextLbl = yield tx("Далі →", 14, "SemiBold", "#ffffff", { ls: -0.15, lh: 20 });
        nextLbl.x = Math.round((280 - nextLbl.width) / 2);
        nextLbl.y = 12;
        nextBtn.appendChild(nextLbl);
    });
}
// 7 — Wizard Step 4: Дані комітента
function buildScreenCommittent(page) {
    return __awaiter(this, void 0, void 0, function* () {
        page.name = "07 · Wizard — Дані комітента";
        const root = fr("Screen/Комітент", 1440, 900, "#f9fafb");
        root.x = 0;
        root.y = 0;
        page.appendChild(root);
        const overlay = rc(1440, 900, "#0a0a0a", 0);
        overlay.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.4 }];
        overlay.x = 0;
        overlay.y = 0;
        root.appendChild(overlay);
        const modal = fr("Modal/Committent", 640, 820, "#ffffff");
        modal.cornerRadius = 14;
        modal.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.18 }, offset: { x: 0, y: 8 }, radius: 32, spread: 0, visible: true, blendMode: "NORMAL" }];
        modal.x = 400;
        modal.y = 40;
        root.appendChild(modal);
        yield buildWizardHeader(modal, "Постановка ТЗ на комісію", 4, "Дані про комітента");
        // Type selector
        const types = ["Фізична особа", "Юридична особа", "ФОП"];
        for (let i = 0; i < types.length; i++) {
            const active = i === 0;
            const btn = fr(`Type/${i}`, 182, 36, active ? "#eff6ff" : "#f3f3f5");
            btn.cornerRadius = 8;
            if (active) {
                btn.strokes = [{ type: "SOLID", color: h2r("#2b7fff"), opacity: 1 }];
                btn.strokeWeight = 1.5;
            }
            btn.x = 24 + i * 192;
            btn.y = 140;
            modal.appendChild(btn);
            const lbl = yield tx(types[i], 13, active ? "Medium" : "Regular", active ? "#2b7fff" : "#737373", { ls: -0.15, lh: 18 });
            lbl.x = Math.round((182 - lbl.width) / 2);
            lbl.y = 9;
            btn.appendChild(lbl);
        }
        const personFields = [
            ["Прізвище", "Іванов"], ["Ім'я", "Іван"],
            ["По батькові", "Іванович"], ["ІПН", "1234567890"],
            ["Серія та номер паспорту", "АА123456"], ["Дата видачі", "15.01.2010"],
            ["Адреса реєстрації", "м. Київ, вул. Хрещатик, 1"], ["Телефон", "+380501234567"],
        ];
        for (let i = 0; i < personFields.length; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const lbl = yield tx(personFields[i][0], 13, "Medium", "#0a0a0a", { ls: -0.15, lh: 18 });
            lbl.x = 24 + col * 308;
            lbl.y = 192 + row * 80;
            modal.appendChild(lbl);
            const field = fr(`F/${i}`, 280, 40, "#f3f3f5");
            field.cornerRadius = 10;
            field.x = 24 + col * 308;
            field.y = 214 + row * 80;
            modal.appendChild(field);
            const val = yield tx(personFields[i][1], 14, "Regular", "#0a0a0a", { ls: -0.15, lh: 20 });
            val.x = 12;
            val.y = 10;
            field.appendChild(val);
        }
        ln(modal, 0, 540, 640);
        const prevBtn = fr("Prev", 280, 44, "#f3f3f5");
        prevBtn.cornerRadius = 10;
        prevBtn.x = 24;
        prevBtn.y = 556;
        modal.appendChild(prevBtn);
        const prevLbl = yield tx("← Назад", 14, "Medium", "#6a7282", { ls: -0.15, lh: 20 });
        prevLbl.x = Math.round((280 - prevLbl.width) / 2);
        prevLbl.y = 12;
        prevBtn.appendChild(prevLbl);
        const submitBtn = fr("Submit", 280, 44, "#030213");
        submitBtn.cornerRadius = 10;
        submitBtn.x = 336;
        submitBtn.y = 556;
        modal.appendChild(submitBtn);
        const submitLbl = yield tx("Поставити на комісію", 14, "SemiBold", "#ffffff", { ls: -0.15, lh: 20 });
        submitLbl.x = Math.round((280 - submitLbl.width) / 2);
        submitLbl.y = 12;
        submitBtn.appendChild(submitLbl);
    });
}
// 8 — Документи: Успішне завершення
function buildScreenDocuments(page) {
    return __awaiter(this, void 0, void 0, function* () {
        page.name = "08 · Успішна постановка";
        const root = fr("Screen/Документи", 1440, 900, "#f9fafb");
        root.x = 0;
        root.y = 0;
        page.appendChild(root);
        const overlay = rc(1440, 900, "#0a0a0a", 0);
        overlay.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.4 }];
        overlay.x = 0;
        overlay.y = 0;
        root.appendChild(overlay);
        const modal = fr("Modal/Documents", 560, 780, "#ffffff");
        modal.cornerRadius = 14;
        modal.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.18 }, offset: { x: 0, y: 8 }, radius: 32, spread: 0, visible: true, blendMode: "NORMAL" }];
        modal.x = 440;
        modal.y = 60;
        root.appendChild(modal);
        // Header
        const hdr = yield tx("Постановка ТЗ на комісію", 18, "SemiBold", "#0a0a0a", { ls: -0.44, lh: 27 });
        hdr.x = 24;
        hdr.y = 20;
        modal.appendChild(hdr);
        ln(modal, 0, 56, 560);
        // Success block
        const successBlock = fr("Success", 512, 100, "#faf5ff");
        successBlock.cornerRadius = 10;
        successBlock.strokes = [{ type: "SOLID", color: h2r("#e9d4ff"), opacity: 1 }];
        successBlock.strokeWeight = 1;
        successBlock.x = 24;
        successBlock.y = 68;
        modal.appendChild(successBlock);
        const successIcon = el(40, 40, "#ad46ff");
        successIcon.x = 16;
        successIcon.y = 30;
        successBlock.appendChild(successIcon);
        const checkMark = yield tx("✓", 18, "Bold", "#ffffff");
        checkMark.x = 24;
        checkMark.y = 38;
        successBlock.appendChild(checkMark);
        const successTitle = yield tx("Авто поставлено на комісію", 16, "SemiBold", "#101828", { ls: -0.31, lh: 24 });
        successTitle.x = 68;
        successTitle.y = 30;
        successBlock.appendChild(successTitle);
        const successSub = yield tx("Ви можете роздрукувати документи нижче", 14, "Regular", "#4a5565", { ls: -0.15, lh: 20 });
        successSub.x = 68;
        successSub.y = 58;
        successBlock.appendChild(successSub);
        // Document cards
        const docs = [
            ["Угода", "Про купівлю-продаж із третіми особами"],
            ["Акт", "Приймання-передачі від продавця комісіонеру"],
            ["Акт", "Технічного стану ТЗ"],
            ["Акт", "Огляду ТЗ"],
            ["Договір", "Купівлі-продажу комісійного ТЗ"],
            ["Договір", "Купівлі-продажу (з актом приймання-передачі)"],
        ];
        for (let i = 0; i < docs.length; i++) {
            const card = fr(`Doc/${i}`, 512, 60, "#ffffff");
            card.cornerRadius = 10;
            card.strokes = [{ type: "SOLID", color: h2r("#e5e5e5"), opacity: 1 }];
            card.strokeWeight = 1;
            card.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 1 }, radius: 4, spread: 0, visible: true, blendMode: "NORMAL" }];
            card.x = 24;
            card.y = 180 + i * 68;
            modal.appendChild(card);
            const docType = yield tx(docs[i][0], 14, "Medium", "#0a0a0a", { ls: -0.15, lh: 20 });
            docType.x = 16;
            docType.y = 10;
            card.appendChild(docType);
            const docName = yield tx(docs[i][1], 13, "Regular", "#737373", { ls: -0.15, lh: 18 });
            docName.x = 16;
            docName.y = 32;
            card.appendChild(docName);
            const printBtn = fr(`Print/${i}`, 90, 28, "#2b7fff");
            printBtn.cornerRadius = 8;
            printBtn.x = 406;
            printBtn.y = 16;
            card.appendChild(printBtn);
            const printLbl = yield tx("Друкувати", 11, "Regular", "#ffffff");
            printLbl.x = 8;
            printLbl.y = 7;
            printBtn.appendChild(printLbl);
        }
        ln(modal, 0, 596, 560);
        const closeBtn = fr("Close", 512, 44, "#2b7fff");
        closeBtn.cornerRadius = 10;
        closeBtn.x = 24;
        closeBtn.y = 608;
        modal.appendChild(closeBtn);
        const closeLbl = yield tx("Закрити", 14, "Medium", "#ffffff", { ls: -0.15, lh: 20 });
        closeLbl.x = Math.round((512 - closeLbl.width) / 2);
        closeLbl.y = 12;
        closeBtn.appendChild(closeLbl);
    });
}
// 9 — Результати пошуку
function buildScreenSearchResults(page) {
    return __awaiter(this, void 0, void 0, function* () {
        page.name = "09 · Результати пошуку ТЗ";
        const root = fr("РезультатиПошуку", 1440, 900, "#ffffff");
        root.x = 0;
        root.y = 0;
        page.appendChild(root);
        yield buildSidebar(root);
        const main = fr("Main", 1260, 900, "#ffffff");
        main.x = 180;
        main.y = 0;
        root.appendChild(main);
        const back = rc(36, 36, "#f3f3f5", 8);
        back.x = 24;
        back.y = 20;
        main.appendChild(back);
        const backArr = yield tx("←", 16, "Regular", "#6a7282");
        backArr.x = 30;
        backArr.y = 22;
        main.appendChild(backArr);
        const title = yield tx("Результати пошуку", 24, "SemiBold", "#101828", { ls: -0.44, lh: 32 });
        title.x = 72;
        title.y = 22;
        main.appendChild(title);
        const query = yield tx("VIN: H7TX98234L0012345", 14, "Regular", "#6a7282", { fam: "Courier New", lh: 20 });
        query.x = 72;
        query.y = 58;
        main.appendChild(query);
        ln(main, 0, 88, 1260);
        // Vehicle cards grid
        const vehicles = [
            ["Toyota Camry", "2024", "Silver", "$28 500", "Нереалізовано"],
            ["Toyota Camry", "2022", "White", "$22 000", "Реалізовано"],
            ["Toyota Corolla", "2023", "Black", "$21 900", "Нереалізовано"],
            ["Toyota RAV4", "2024", "Gray", "$35 800", "В обробці"],
        ];
        for (let i = 0; i < vehicles.length; i++) {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const card = fr(`VehCard/${i}`, 380, 280, "#ffffff");
            card.cornerRadius = 14;
            card.strokes = [bp(0.1)];
            card.strokeWeight = 1;
            card.x = 24 + col * 396;
            card.y = 104 + row * 296;
            main.appendChild(card);
            // Image placeholder
            const img = rc(332, 140, "#f3f3f5", 10);
            img.x = 24;
            img.y = 16;
            card.appendChild(img);
            const imgLbl = yield tx("Фото ТЗ", 12, "Regular", "#bcbcbc");
            imgLbl.x = 140;
            imgLbl.y = 70;
            card.appendChild(imgLbl);
            const vName = yield tx(vehicles[i][0], 16, "Medium", "#0a0a0a", { ls: -0.31, lh: 24 });
            vName.x = 24;
            vName.y = 168;
            card.appendChild(vName);
            const yr = yield tx(vehicles[i][1] + " · " + vehicles[i][2], 13, "Regular", "#6a7282", { ls: -0.15, lh: 18 });
            yr.x = 24;
            yr.y = 196;
            card.appendChild(yr);
            const price = yield tx(vehicles[i][3], 16, "SemiBold", "#101828", { ls: -0.31, lh: 24 });
            price.x = 24;
            price.y = 220;
            card.appendChild(price);
            const badgeColor = vehicles[i][4] === "Реалізовано" ? "#fde8ec" : vehicles[i][4] === "В обробці" ? "#fff3e0" : "#e6f9ef";
            const badgeTxt = vehicles[i][4] === "Реалізовано" ? "#d4183d" : vehicles[i][4] === "В обробці" ? "#d08700" : "#00a63e";
            const badge = fr(`Badge/${i}`, 140, 26, badgeColor);
            badge.cornerRadius = 8;
            badge.x = 24;
            badge.y = 248;
            card.appendChild(badge);
            const bLbl = yield tx(vehicles[i][4], 11, "Medium", badgeTxt, { ls: -0.15, lh: 16 });
            bLbl.x = 10;
            bLbl.y = 5;
            badge.appendChild(bLbl);
        }
    });
}
// ── Main ──────────────────────────────────────────────────────
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield preload();
        figma.root.name = "ЄДРТЗВ — Screens";
        const screenBuilders = [
            buildScreenVehicleList,
            buildScreenVehicleDetail,
            buildScreenDocList,
            buildScreenSearch,
            buildScreenVerification,
            buildScreenCondition,
            buildScreenCommittent,
            buildScreenDocuments,
            buildScreenSearchResults,
        ];
        while (figma.root.children.length < screenBuilders.length)
            figma.createPage();
        const pages = figma.root.children.slice(0, screenBuilders.length);
        const errors = [];
        for (let i = 0; i < screenBuilders.length; i++) {
            yield figma.setCurrentPageAsync(pages[i]);
            for (const c of [...pages[i].children])
                c.remove();
            try {
                yield screenBuilders[i](pages[i]);
            }
            catch (err) {
                // One broken screen must not stop the rest
                errors.push(`Сторінка ${i + 1}: ${String(err)}`);
                console.error(`Screen ${i + 1} error:`, err);
            }
        }
        yield figma.setCurrentPageAsync(pages[0]);
        figma.viewport.scrollAndZoomIntoView(pages[0].children);
        if (errors.length > 0) {
            console.error("Errors:", errors.join("\n"));
            figma.notify(`⚠️ Готово з ${errors.length} помилками — перевір консоль`, { timeout: 6000 });
        }
        else {
            figma.notify(`✅ Міграцію завершено — ${screenBuilders.length} екранів`, { timeout: 5000 });
        }
        figma.closePlugin();
    });
}
main().catch((err) => {
    console.error(err);
    figma.notify("❌ Помилка: " + String(err), { error: true });
    figma.closePlugin();
});
