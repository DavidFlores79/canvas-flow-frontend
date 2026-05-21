# Session: UI Design Overhaul
**Date:** 2026-05-21
**Branch:** `feat/ui-design-overhaul`
**Base branch:** `develop`
**Target branch:** `develop`

---

## Goal
Transform the current bland gray/white UI into a professional, modern SaaS design tool aesthetic — dark sidebars, polished typography, cohesive design tokens — using Tailwind CSS v3 only (no new UI component libraries). Full dark mode toggle is baked in from the start.

---

## User Decisions
| Question | Answer |
|---|---|
| Color theme | Dark blue-gray (Figma-like): slate/panel palette |
| Toolbar style | Icons + tooltips — install `lucide-angular` |
| Priority pages | All: Editor, Dashboard, Login, AI Modal |
| Dark mode | Bake in full dark mode now (`darkMode: 'class'` + toggle) |

---

## Current State Assessment

### Stack
- Angular 20, standalone components, Fabric.js canvas
- Tailwind CSS v3 (default config, zero extensions)
- Angular Signals for state (EditorStore, AuthStore)
- No icon library — text labels only on toolbar

### UI Problems Identified
| Area | Problem |
|---|---|
| Color palette | All gray/white — `bg-gray-100`, `bg-white`, `border-gray-200` everywhere, no visual hierarchy |
| Toolbar | Text-only labels, no icons, items crowded, no visual grouping |
| Left sidebar | Same `bg-white` as everything, no depth |
| Right inspector | Too narrow (`w-52`), plain form inputs |
| Layers panel | Shows raw UUID slices, not layer names |
| Dashboard | Minimal workspace cards with just text |
| Login | Bare white card on gray — no brand presence |
| Tailwind config | Empty `extend: {}` — zero custom design tokens |

---

## Design Direction

### Color Palette (derived from logo gradient)
The logo gradient runs **violet `#8b5cf6` → indigo-navy `#312e81`**. The panel dark is pulled directly from the logo's bottom-right shadow tone, making the sidebars feel like an extension of the brand.

Custom token block for `tailwind.config.js`:

```js
colors: {
  panel: {
    DEFAULT: '#1e1b4b',   // indigo-950 — matches logo bottom-right dark
    hover:   '#2d2a6e',   // slightly lighter indigo
    active:  '#3730a3',   // indigo-700 — selected/active state
    border:  '#312e81',   // indigo-900 — dividers
    header:  '#13113a',   // deepest header, below logo dark
  },
  surface: {
    DEFAULT: '#0f0e2a',   // near-black indigo — page bg in dark mode
    muted:   '#1a1847',
  },
  ink: {
    primary:   '#ede9fe', // violet-100 — warm white, matches logo light tones
    secondary: '#a5b4fc', // indigo-300 — muted text
    disabled:  '#6366f1', // indigo-500 — placeholders
  },
  accent: {
    DEFAULT: '#8b5cf6',   // violet-500 — matches logo top-left
    hover:   '#7c3aed',   // violet-600
    muted:   '#4c1d95',   // violet-900 — active bg
    light:   '#c4b5fd',   // violet-300 — text on dark accent bg
  },
  brand: {
    from: '#8b5cf6',      // gradient start (logo top-left violet)
    to:   '#312e81',      // gradient end (logo bottom-right navy)
  },
  canvas: {
    desk:    '#e2e8f0',   // slate-200 — light mode workspace bg
    surface: '#ffffff',   // the white canvas page
  },
  danger:  '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
}
```

**Logo files cropped** (80px transparent padding removed, 4px safety margin kept):
- `public/logo.png` — 512×512 → 357×365
- `src/assets/logo.png` — same
- `public/favicon.png` — same crop
- `src/favicon.png` — same crop

### Dark Mode Strategy
- `darkMode: 'class'` in `tailwind.config.js`
- Sidebars/toolbar are **always dark** (no `dark:` needed there)
- Light surfaces (canvas desk, login, dashboard bg, modals) get `dark:` variants
- A `ThemeToggleComponent` in the header flips `dark` class on `<html>` and persists to `localStorage`

### Typography
- **Inter** via Google Fonts (preconnect + link in `src/index.html`)
- `fontFamily.sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']`
- `font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11'` on `html` for professional Inter rendering
- `-webkit-font-smoothing: antialiased` on `html`

### Icon Library
- Install: `yarn add lucide-angular`
- Icons: `MousePointer2`, `Type`, `Square`, `Minus`, `Undo2`, `Redo2`, `Copy2`, `Save`, `Download`, `Sparkles`, `ChevronDown`, `X`, `Plus`, `GripVertical`, `Sun`, `Moon`
- Convention: `w-4 h-4` icon inside `w-8 h-8` button target

---

## Implementation Plan

### Phase 1 — Foundation
1. **`tailwind.config.js`** — Add `darkMode: 'class'`, full color token block, Inter font family, `boxShadow.panel` and `boxShadow.float`
2. **`src/index.html`** — Add Google Fonts Inter preconnect + stylesheet link
3. **`src/styles.css`** — Full replacement with `@apply` component classes:
   - `panel-section-label`, `panel-card`
   - `inspector-input`, `inspector-row`, `inspector-row-key`, `inspector-value`, `inspector-label`
   - `tool-btn`, `tool-btn-active`, `tool-divider`
   - `dropdown-menu`, `dropdown-item`, `dropdown-item-active`
   - `layer-item`, `layer-item-selected`
   - `sidebar-tab`, `sidebar-tab-active`
   - `btn-primary`, `btn-ghost`, `btn-danger`
   - `workspace-card`
   - `animate-dirty-pulse` (keyframe animation for unsaved changes)
   - `panel-scroll` (thin 4px webkit scrollbar for dark panels)

### Phase 2 — Editor Shell
4. **`editor.component.html`**
   - Root wrapper: `bg-gray-100` → `bg-surface`
   - Header: `bg-white border-gray-200` → `bg-panel-header border-panel-border`; text → `ink-*` colors
   - Project select, new-project input, add/cancel buttons → dark styled
   - Left sidebar: `bg-white border-gray-200` → `bg-panel border-panel-border panel-scroll`
   - Sidebar tabs → `sidebar-tab` / `sidebar-tab-active`
   - Canvas `<main>`: add `bg-slate-200 dark:bg-zinc-900` (desk background)
   - Zoom bar: `bg-gray-100 border-gray-200` → `bg-surface border-panel-border`
   - Zoom pill: `bg-white border-gray-200` → `bg-panel-hover border-panel-border shadow-panel`
   - Right inspector: `w-52 bg-white` → `w-60 bg-panel border-panel-border panel-scroll`
5. **NEW: `theme-toggle.component.ts` + `.html`**
   - Standalone component
   - Reads `localStorage('theme')` on init, applies `dark` class to `<html>`
   - Toggles on click, persists to `localStorage`
   - Shows `Sun` icon in dark mode, `Moon` icon in light mode
   - Uses `tool-btn` class — fits header context

### Phase 3 — Toolbar
6. **`toolbar.component.html`** — Dark bg, icon-only `tool-btn` buttons with `title` tooltips, `tool-divider` separators, Save/Export right-aligned, dirty-state `animate-dirty-pulse` on Save
7. **`toolbar.component.ts`** — Import `LucideAngularModule` + icon constants

### Phase 4 — Inspector & Panels
8. **`inspector.component.html`** — `panel-section-label` headers, `inspector-input` fields, `inspector-row` property rows, dark B/I/U toggle buttons
9. **`image-transform-panel.component.html`** — `inspector-input` pattern, `accent-violet-500` on ranges/checkboxes, warning/error colors updated
10. **`layers-panel.component.html`** — `layer-item` / `layer-item-selected` classes, drag handle + delete button dark colors
11. **`assets-panel.component.html`** — `panel-section-label`, asset grid dark border + hover scale, upload button dark `file::` styles

### Phase 5 — Dashboard & Login
12. **`dashboard.component.html`** — Dark sticky header (`bg-panel-header`), dark page bg (`bg-surface dark:bg-surface`), theme toggle in header
13. **`workspace-card.component.html`** — Full redesign: gradient thumbnail placeholder, `workspace-card` class, hover lift + chevron arrow
14. **`login.component.html`** — Dark card (`bg-panel border-panel-border rounded-2xl`), radial purple glow via inline `style`, gradient submit button, Inter-polished typography

### Phase 6 — Remaining
15. **`ai-modal.component.html`** — Card `bg-white` → `bg-panel`, textarea dark-styled, labels/errors updated (gradient header stays as-is)
16. **`org-switcher.component.html`** — Select dark-styled for header context

---

## New File: ThemeToggleComponent

```
src/app/presentation/components/theme-toggle/
  theme-toggle.component.ts
  theme-toggle.component.html
```

---

## File Change Map

| File | Change |
|---|---|
| `tailwind.config.js` | Full replacement |
| `src/index.html` | Add Inter font links |
| `src/styles.css` | Full replacement with `@apply` component classes |
| `editor.component.html` | Class edits throughout |
| `toolbar.component.html` | Dark + icon-only + grouping |
| `toolbar.component.ts` | Add lucide-angular imports |
| `inspector.component.html` | Dark inputs + section labels |
| `image-transform-panel.component.html` | Dark styles throughout |
| `layers-panel.component.html` | Dark styles + states |
| `assets-panel.component.html` | Dark section header + grid |
| `dashboard.component.html` | Dark header + bg + theme toggle |
| `workspace-card.component.html` | Full redesign |
| `login.component.html` | Dark card + glow + gradient button |
| `ai-modal.component.html` | Dark card update |
| `org-switcher.component.html` | Dark select |
| `theme-toggle.component.ts` (**NEW**) | Standalone toggle component |
| `theme-toggle.component.html` (**NEW**) | Sun/Moon icon button |

---

## Branch Strategy
- **Branch name:** `feat/ui-design-overhaul`
- **Base:** `develop`
- **PR target:** `develop`
- **1 reviewer required**

---

## Dependencies to Install
```bash
yarn add lucide-angular
```

---

## Implementation Order
1. `tailwind.config.js`
2. `src/index.html`
3. `src/styles.css` — verify `ng serve` has no compile errors
4. Editor shell (`editor.component.html`)
5. `theme-toggle` component
6. Toolbar
7. Left panels (layers, assets)
8. Right inspector + image-transform-panel
9. Dashboard + workspace card
10. Login
11. AI modal + org switcher

---

## Tailwind v3 Compatibility Notes
- `accent-violet-500` requires Tailwind v3.1+. Use inline `style="accent-color: #7c3aed"` on checkboxes/ranges if on v3.0.x.
- `bg-gradient-radial` does not exist in Tailwind v3 core — login background glow uses inline `style` with `radial-gradient(...)`.
- Opacity modifiers (`bg-accent/10`) require hex color tokens — all tokens above are hex, this works.
- `hover:` inside `@apply` is supported in `@layer components` in Tailwind v3.
- `tabular-nums` is a Tailwind v3 core utility — safe to `@apply` in `styles.css`.

---

## Testing Strategy
- Visual: manual browser review at `http://localhost:4200`
- Test flows: login → dashboard → editor → toolbar → inspector → AI modal → theme toggle (light ↔ dark)
- Unit tests: `yarn test` — no logic changes, must pass unchanged
- Contrast: `ink-secondary` (#9090aa) on `panel` (#1e1e2e) = 4.6:1 — passes WCAG AA

---

## Acceptance Criteria
- [ ] Dark panel sidebars with readable ink text, no contrast failures
- [ ] Toolbar has icon-only buttons (lucide-angular) with `title` tooltips
- [ ] Canvas viewport background differentiates desk from white canvas page
- [ ] Theme toggle switches full app dark/light and persists to `localStorage`
- [ ] Workspace cards have thumbnail placeholder, hover lift, no raw IDs shown
- [ ] Login has radial glow, dark card, gradient submit button
- [ ] All existing editor functionality preserved (undo/redo, save, export, AI modal)
- [ ] `yarn test` passes with no failures

---

## Gaps Fixed in v3

### Gap 1 — `app.html` default placeholder (missed entirely)
`src/app/app.html` still contains the Angular scaffolding template (logo, pill links, inline `<style>`) rendered above `<router-outlet>` on every page. **Add to Phase 1:** replace entire file with just `<router-outlet />`.

### Gap 2 — `canvas.component.ts` inline template (not a .html file — easy to miss)
Uses hardcoded `bg-white`, `bg-white border-gray-200`, `hover:bg-red-50 hover:text-red-600` in an inline `template:` string. **Add to Phase 4:** update inline template classes to `dark:bg-panel dark:border-panel-border dark:hover:bg-danger/10 dark:text-ink-primary` on the context menu.

### Gap 3 — `accent-brand-600` / `text-brand-600` in image-transform-panel (undefined token)
Template uses `accent-brand-600` on range inputs, checkboxes, and the Apply button. `brand` is not a Tailwind token — it silently produces nothing. **Add to token block:** either add `brand` as an alias for `accent` (`brand: '#7c3aed'`), or explicitly replace all `accent-brand-600` → `accent-violet-500` and `text-brand-600` → `text-accent` during Phase 4.

### Gap 4 — Layer names: no `name` field on the domain model
`SlicePipe` + `layer.id | slice:0:8` is used because layers have no `name` property — only `type`, `id`, `content`. Decision: **show `layer.type` + 1-based index** (e.g., "image 1", "text 2"). Computed in the template using `$index` from `@for`. Remove `SlicePipe` from `LayersPanelComponent` imports.

### Gap 5 — Dark mode FOUC (flash of wrong theme on first paint)
`ThemeToggleComponent` applies the `dark` class on Angular init — after the browser first paints. This causes a white flash in dark mode. **Add to Phase 1 (`index.html`):** inline `<script>` before `<app-root>`:
```html
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  })();
</script>
```

### Gap 6 — `canvas-desk` token missing from color block
Plan references `bg-canvas-desk` / `bg-canvas-surface` in the editor layout but the token block doesn't define a `canvas` group. **Add to token block:**
```js
canvas: {
  desk:    '#e2e8f0',  // slate-200 — scrollable workspace background (light)
  surface: '#ffffff',  // the actual white page
}
```
Dark mode desk: `dark:bg-zinc-800` (use built-in Tailwind token, no custom needed).

### Gap 7 — `lucide-angular` needs importing per standalone component
Every standalone component using lucide icons needs `LucideAngularModule` in its own `imports: []`. **Affected components:** `toolbar.component.ts` AND `theme-toggle.component.ts`. Add to plan: both must import `LucideAngularModule` and their specific icon constants individually.

---

## Iteration Log
- **v1 (2026-05-21):** Initial plan after full codebase exploration + web research + Angular agent advice
- **v2 (2026-05-21):** Added full dark mode (`darkMode: 'class'` + ThemeToggleComponent) per user decision
- **v3 (2026-05-21):** Gap analysis — fixed 7 missing items: app.html cleanup, canvas inline template, brand token, layer names, FOUC prevention, canvas-desk token, lucide-angular per-component imports
