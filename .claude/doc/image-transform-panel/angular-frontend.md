# ImageTransformPanelComponent — Implementation Plan

## Overview

Two files are created and two files are modified:

| Action | Path |
|--------|------|
| Create | `src/app/presentation/components/image-transform-panel/image-transform-panel.component.ts` |
| Create | `src/app/presentation/components/image-transform-panel/image-transform-panel.component.html` |
| Modify | `src/app/presentation/components/inspector/inspector.component.ts` |
| Modify | `src/app/presentation/components/inspector/inspector.component.html` |

---

## 1. `image-transform-panel.component.ts`

### Imports

```ts
import { Component, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AssetApiService } from '../../../data/services/asset-api.service';
import { EditorStore } from '../../../application/stores/editor.store';
import { TransformPayload } from '../../../domain/models/asset.model';
```

No `CommonModule`, no `NgIf`. The template uses only built-in `@if`/`@let` control flow (Angular 17+ block syntax, available in Angular 20). No `imports` array entry needed beyond the component itself being standalone.

### Component decorator

```ts
@Component({
  selector: 'app-image-transform-panel',
  standalone: true,
  imports: [],            // no Angular modules needed — plain HTML + signal bindings
  templateUrl: './image-transform-panel.component.html',
})
```

### Field injections (Angular 20 field-injection style)

```ts
private readonly assetApi = inject(AssetApiService);
protected readonly editorStore = inject(EditorStore);
```

### Derived signal for the active layer

```ts
protected readonly layer = computed(() => {
  const layers = this.editorStore.selectedLayers();
  return layers.length === 1 && layers[0].type === 'image' ? layers[0] : null;
});
```

`computed()` re-runs whenever `selectedLayers` changes, so the panel reactively shows/hides through the parent template's `@if`.

### Mutable form-state signals

All signals hold the raw UI value (what the slider/input shows):

```ts
protected readonly removeBackground = signal(false);
protected readonly brightness       = signal(0);          // -100..100
protected readonly contrast         = signal(0);          // -100..100
protected readonly blurUi           = signal(0);          // 0..100 (UI)
protected readonly grayscale        = signal(false);
protected readonly format           = signal<'original' | 'jpg' | 'png' | 'webp' | 'avif'>('original');
protected readonly crop             = signal<'none' | 'fill' | 'crop' | 'scale' | 'fit' | 'thumb'>('none');
protected readonly widthInput       = signal(0);
protected readonly heightInput      = signal(0);
```

`blurUi` is 0–100 on screen; it maps to 0–2000 for the API (`blurUi * 20`).

### Status signals

```ts
protected readonly isApplying = signal(false);
protected readonly successMsg = signal<string | null>(null);
protected readonly errorMsg   = signal<string | null>(null);
```

### `reset()` method

Sets all form signals back to their defaults. Does not call the API.

```ts
reset(): void {
  this.removeBackground.set(false);
  this.brightness.set(0);
  this.contrast.set(0);
  this.blurUi.set(0);
  this.grayscale.set(false);
  this.format.set('original');
  this.crop.set('none');
  this.widthInput.set(0);
  this.heightInput.set(0);
  this.successMsg.set(null);
  this.errorMsg.set(null);
}
```

### `apply()` method

```ts
async apply(): Promise<void> {
  const l = this.layer();
  if (!l?.assetId) return;

  const workspaceId = this.editorStore.activeProject()?.workspaceId;
  if (!workspaceId) return;

  const payload: TransformPayload = { workspaceId };

  if (this.removeBackground()) payload.removeBackground = true;
  if (this.brightness() !== 0)  payload.brightness = this.brightness();
  if (this.contrast()   !== 0)  payload.contrast   = this.contrast();
  if (this.blurUi()     !== 0)  payload.blur        = this.blurUi() * 20;
  if (this.grayscale())         payload.grayscale   = true;
  if (this.format()  !== 'original') payload.format = this.format() as TransformPayload['format'];
  if (this.crop()    !== 'none')     payload.crop   = this.crop()   as TransformPayload['crop'];
  if (this.widthInput()  > 0) payload.width  = this.widthInput();
  if (this.heightInput() > 0) payload.height = this.heightInput();

  this.isApplying.set(true);
  this.successMsg.set(null);
  this.errorMsg.set(null);

  try {
    const newAsset = await firstValueFrom(this.assetApi.transform(l.assetId, payload));
    this.editorStore.updateLayer(l.id, { content: newAsset.url });
    this.successMsg.set('Transform applied');
    setTimeout(() => this.successMsg.set(null), 3000);
  } catch {
    this.errorMsg.set('Transform failed. Please try again.');
  } finally {
    this.isApplying.set(false);
  }
}
```

Key notes:
- Only fields that differ from their "identity" value are included in the payload so the backend is not given unnecessary no-op transforms.
- `firstValueFrom` matches the pattern already used in `AiPanelComponent` and `EditorStore`.
- The catch block uses a bare `catch` (no binding) to satisfy strict TypeScript — the error type from `firstValueFrom` is `unknown`, so binding it would require a type guard. The existing codebase uses bare `catch` in the same situation (see `auth.store.ts` line 37, `ai-panel.component.ts` line 47).
- `setTimeout` for clearing the success message is intentional UI feedback; no memory-leak risk because `signal.set(null)` is a no-op if the component is already destroyed.

### Event handlers for range/number inputs

Because Angular template event binding for `input` on a range gives a `Event`, typed handlers are needed:

```ts
onRangeInput(setter: (v: number) => void, event: Event): void {
  setter(Number((event.target as HTMLInputElement).value));
}

onNumberInput(setter: (v: number) => void, event: Event): void {
  const v = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(v)) setter(v);
}
```

These are reused for brightness, contrast, blur, width, height. The pattern mirrors `InspectorComponent.onWidthInput`.

---

## 2. `image-transform-panel.component.html`

### Top-level structure

```html
@let l = layer();

@if (!l) {
  <!-- nothing rendered; parent already guards with @if layer.type === 'image' -->
} @else if (!l.assetId) {
  <p class="text-xs text-amber-600 mt-2">
    This image was not uploaded via Assets — transform unavailable.
  </p>
} @else {
  <!-- full panel -->
}
```

The outer `@if (!l)` guard is defensive; the real guard lives in `inspector.component.html`. The `@let` syntax is Angular 17+ and available in Angular 20.

### Section pattern (copy from inspector style)

Each section uses:
```html
<div class="mt-3 border-t border-gray-100 pt-3">
  <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Section Name</p>
  <!-- controls -->
</div>
```

### Sections and controls

**Adjustments** (brightness, contrast, blur, grayscale)

Sliders use `type="range"` with `[value]` binding and `(input)` handler. Label shows live value next to the name.

```html
<label class="block text-xs text-gray-500">
  Brightness <span class="float-right font-medium">{{ brightness() }}</span>
  <input type="range" min="-100" max="100" step="1"
    class="w-full mt-1 accent-blue-500"
    [value]="brightness()"
    (input)="onRangeInput(brightness.set.bind(brightness), $event)" />
</label>
```

Important: `brightness.set.bind(brightness)` passes a bound setter reference that matches the `(v: number) => void` signature. Same pattern for contrast and blur (blur uses `min="0" max="100"`).

Grayscale and Remove Background use `<input type="checkbox">` with `[checked]` and `(change)` bindings:
```html
<label class="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
  <input type="checkbox" class="accent-blue-500"
    [checked]="grayscale()"
    (change)="grayscale.set(($event.target as HTMLInputElement).checked)" />
  Grayscale
</label>
```

**Background** (remove background toggle — same checkbox pattern as grayscale)

**Format & Crop** (two `<select>` elements)

```html
<select class="w-full border border-gray-200 rounded px-2 py-1 text-xs"
  [value]="format()"
  (change)="format.set(($event.target as HTMLSelectElement).value as 'original' | 'jpg' | 'png' | 'webp' | 'avif')">
  <option value="original">Original</option>
  <option value="jpg">JPG</option>
  <option value="png">PNG</option>
  <option value="webp">WebP</option>
  <option value="avif">AVIF</option>
</select>
```

Crop select uses the same pattern with `'none' | 'fill' | 'crop' | 'scale' | 'fit' | 'thumb'` union.

**Resize** (width + height number inputs)

```html
<div class="grid grid-cols-2 gap-2">
  <label class="text-xs text-gray-500">
    Width
    <input type="number" min="0" class="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-sm"
      [value]="widthInput()"
      (input)="onNumberInput(widthInput.set.bind(widthInput), $event)" />
  </label>
  <label class="text-xs text-gray-500">
    Height
    <input type="number" min="0" class="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-sm"
      [value]="heightInput()"
      (input)="onNumberInput(heightInput.set.bind(heightInput), $event)" />
  </label>
</div>
```

**Action buttons + status**

```html
<div class="mt-3 flex gap-2">
  <button
    class="flex-1 text-xs bg-blue-50 text-blue-700 rounded px-2 py-1 hover:bg-blue-100 disabled:opacity-50"
    [disabled]="isApplying()"
    (click)="apply()">
    @if (isApplying()) {
      <span class="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-1"></span>
      Applying…
    } @else {
      Apply
    }
  </button>
  <button
    class="flex-1 text-xs bg-gray-100 text-gray-700 rounded px-2 py-1 hover:bg-gray-200"
    [disabled]="isApplying()"
    (click)="reset()">
    Reset
  </button>
</div>

@if (successMsg()) {
  <p class="text-xs text-green-600 mt-2">{{ successMsg() }}</p>
}
@if (errorMsg()) {
  <p class="text-xs text-red-500 mt-2">{{ errorMsg() }}</p>
}
```

The spinner is a pure Tailwind CSS `animate-spin` div — no icon library needed.

---

## 3. Modify `inspector.component.ts`

### What changes

Add `ImageTransformPanelComponent` to the `imports` array and to the import statement.

```ts
// Add to existing imports block:
import { ImageTransformPanelComponent } from '../image-transform-panel/image-transform-panel.component';

// Add to @Component decorator:
@Component({
  selector: 'app-inspector',
  standalone: true,
  imports: [ImageTransformPanelComponent],   // add alongside any existing imports
  templateUrl: './inspector.component.html',
})
```

Currently the `imports` array is absent from the decorator (the existing file has no `imports` key). Add it with only `ImageTransformPanelComponent` in it.

---

## 4. Modify `inspector.component.html`

### What changes

Inside the `@if (editorStore.selectedLayers().length === 1)` block, after the existing `<div class="space-y-2 text-sm">` properties block, add the transform panel conditionally for image layers.

The final structure of that block becomes:

```html
@if (editorStore.selectedLayers().length === 1) {
  @let layer = editorStore.selectedLayers()[0];
  <div class="space-y-2 text-sm">
    <!-- existing property rows unchanged -->
  </div>

  @if (layer.type === 'image') {
    <app-image-transform-panel />
  }
} @else {
  <p class="text-xs text-gray-400">Select a layer to inspect</p>
}
```

The `@let layer` re-binding already exists in the template (line 44 in current file). No new variable needed.

The `<app-image-transform-panel />` component reads `editorStore.selectedLayers()` internally via its own injected `EditorStore`, so no `@Input` is required. This keeps the component self-contained and avoids coupling through Input bindings.

---

## TypeScript Strict-Mode Notes

- All `signal()` types are inferred except the union types (`format`, `crop`) which require explicit generic parameters.
- The `apply()` catch block uses a bare `catch` — do not add a binding parameter, matching the project convention.
- `TransformPayload['format']` and `TransformPayload['crop']` are used as cast targets in the payload building to avoid repeating the union literal types.
- The `onRangeInput` / `onNumberInput` helpers use `HTMLInputElement` cast and `Number.isFinite` guard, which is the same pattern as `inspector.component.ts:onWidthInput`.
- `signal.set.bind(signal)` produces a `(value: T) => void` callable that TypeScript infers correctly. No `any` is needed.

---

## Post-Implementation Verification

Run from the project root:
```
npx tsc --noEmit -p tsconfig.app.json
```

Expected: zero errors. Common issues to watch for:
- If `@let` syntax causes a parser error, confirm Angular version is 17+. The project uses Angular 20, so this is safe.
- If `signal.set.bind(signal)` is flagged, the alternative is an arrow wrapper: `(v) => this.brightness.set(v)`. Both are valid but the bound reference is more concise.
- The `imports: []` on `ImageTransformPanelComponent` requires no Angular directives because `@if`, `@let`, `@for` are compiler-level control flow, not directives that need importing.
