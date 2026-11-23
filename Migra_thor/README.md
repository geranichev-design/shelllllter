# Migra Thor

Figma plugin for moving a live web page into Figma as editable layers.

## Build

```bash
npm run build
```

Load `manifest.json` in Figma via **Plugins → Development → Import plugin from manifest...**.

## Import any open web page

1. Run plugin command **Імпорт сторінки / clipboard**.
2. Click **Скопіювати capture-скрипт**.
3. Open the target web page in the browser and run the copied script in DevTools Console.
4. Return to Figma and click **Імпортувати з clipboard**.

The browser script serializes visible DOM layout, text, fills, borders, inline SVG, and same-origin/canvas-readable images into JSON. Figma then creates real editable nodes from that JSON.

If browser clipboard access is blocked, paste the JSON manually into the textarea shown by the plugin and click **Імпортувати з поля**.

## Design-system import

1. Run **🎨 Дизайн система** first. It creates tokens, icons, visual documentation, and the `🧱 Components` registry page with real Figma Components.
2. Open the web app and use the floating Figma button to copy the current page.
3. Run **⬇️ Імпорт сторінки / clipboard** and import from clipboard.

When copied from the floating button, the JSON includes component hints such as `Button/primary/md`, `Form/Input/default`, `Badge/ok`, and `Icon/Shield`. The importer tries to create Figma component instances from `🧱 Components`; if a component is missing, it falls back to editable raw layers and stores metadata for later rebuild.

Use **♻️ Перезібрати виділений макет** after selecting an imported frame or raw section. It replaces recognized nodes with matching registry components.

## Legacy import

The old flows still work:

- Fetch `http://localhost:3000/figma-export.json` if the app exposes that JSON route
- Drop or choose a `figma-layers-*.json` file
