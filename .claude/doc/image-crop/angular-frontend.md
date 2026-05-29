# Image Crop Feature — Implementation Plan

## Overview

This plan covers five files. No new files are created. The feature adds a non-destructive crop to image layers: the crop rectangle is stored in `LayerProperties.cropRect`, applied as a Fabric.js `clipPath` during render, and managed through a transient crop-mode overlay on the canvas.

---

## 1. `src/app/domain/models/layer.model.ts`

### What changes

Add `cropRect` to `LayerProperties`. Place it after `transforms` so optional fields stay grouped at the bottom.

### Exact diff

Inside `LayerProperties`, after the `readonly transforms?: LayerTransforms;` line, add:

```ts
readonly cropRect?: {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};
```

### Notes

- All four sub-fields are natural-image pixels (i.e. measured against the raw `HTMLImageElement.naturalWidth/naturalHeight` before any Fabric scaling is applied).
- `readonly` on every field because `LayerProperties` itself is fully immutable by convention — the store always produces new objects.

---

## 2. `src/app/application/stores/editor.store.ts`

### What changes

#### 2a. Extend `ToolType`

Change line 12 from:

```ts
export type ToolType = 'select' | 'text' | 'shape';
```

to:

```ts
export type ToolType = 'select' | 'text' | 'shape' | 'crop';
```

#### 2b. Add `applyCrop` method

Add after the existing `updateShapeStyle` method:

```ts
applyCrop(layerId: string, cropRect: { left: number; top: number; width: number; height: number }): void {
  const layer = this.layers().find(l => l.id === layerId);
  if (!layer) return;
  const next = this.layers().map(l =>
    l.id === layerId
      ? { ...l, properties: { ...l.properties, cropRect } }
      : l
  );
  this.commitHistory(next);
  this.setActiveTool('select');
}
```

#### 2c. Add `clearCrop` method

Add immediately after `applyCrop`:

```ts
clearCrop(layerId: string): void {
  const layer = this.layers().find(l => l.id === layerId);
  if (!layer) return;
  const { cropRect: _cr, ...restProps } = layer.properties;
  const next = this.layers().map(l =>
    l.id === layerId ? { ...l, properties: restProps } : l
  );
  this.commitHistory(next);
}
```

### Notes

- `applyCrop` calls `commitHistory` directly instead of going through `updateLayer` because it must batch the property update and the tool switch atomically from the store's perspective. Calling `setActiveTool` after `commitHistory` does not affect history — `setActiveTool` writes only to a signal, not to the history stack.
- `clearCrop` uses destructuring to omit `cropRect` rather than setting it to `undefined`. This keeps the serialised layer JSON clean (no `null`/`undefined` fields travelling to the API).
- Both methods call `commitHistory`, so undo/redo works correctly for crop operations.

---

## 3. `src/app/presentation/components/canvas/canvas.component.ts`

This is the most complex change. Read each subsection carefully.

### 3a. New imports

Add `EventEmitter, Output` to the Angular core import list (they are not currently imported). Also add `computed` — it is already imported, no change needed there.

Current import line:
```ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
```

Replace with:
```ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
```

### 3b. New class-level private fields and output

Add these four declarations directly below the existing `protected readonly contextMenu` signal (after line 50):

```ts
private cropOverlay: fabric.Rect | null = null;
private croppingLayerId: string | null = null;
readonly isCropMode = signal(false);

@Output() readonly cropModeChanged = new EventEmitter<boolean>();
```

Important: `isCropMode` must be `readonly` (signal reference is readonly; the value is mutated via `.set()`). `cropModeChanged` must be `@Output()`.

### 3c. New effect in constructor — react to activeTool changes

Add this effect at the end of the constructor body (after the existing three effects):

```ts
effect(() => {
  const tool = this.editorStore.activeTool();
  const selectedIds = this.editorStore.selectedLayerIds();
  if (!this.canvas) return;

  if (tool === 'crop') {
    if (selectedIds.length === 1) {
      const layer = this.editorStore.layers().find(l => l.id === selectedIds[0]);
      if (layer?.type === 'image') {
        untracked(() => this.enterCropMode(selectedIds[0]));
      } else {
        this.editorStore.setActiveTool('select');
      }
    } else {
      this.editorStore.setActiveTool('select');
    }
  } else if (this.isCropMode()) {
    untracked(() => this.exitCropMode());
  }
});
```

Why `untracked()` wrapping: `enterCropMode` and `exitCropMode` read from `this.canvas` and mutate Fabric state. Wrapping them prevents any signal reads inside those methods from being tracked by this effect and causing infinite loops.

### 3d. New private method: `enterCropMode(layerId: string)`

Add this as a private method after `applyObjectInteractivity`:

```ts
private enterCropMode(layerId: string): void {
  if (!this.canvas) return;

  const allObjects = this.canvas.getObjects();
  const imageObj = allObjects.find(
    obj => (obj as fabric.FabricObject & { layerId?: string }).layerId === layerId
  ) as (fabric.FabricImage & { layerId?: string }) | undefined;

  if (!(imageObj instanceof fabric.FabricImage)) {
    this.editorStore.setActiveTool('select');
    return;
  }

  imageObj.set({ selectable: false, evented: false, hasControls: false });
  this.canvas.discardActiveObject();

  const layer = this.editorStore.layers().find(l => l.id === layerId);
  const naturalW = (imageObj.getElement() as HTMLImageElement).naturalWidth || imageObj.width || 1;
  const naturalH = (imageObj.getElement() as HTMLImageElement).naturalHeight || imageObj.height || 1;

  const existing = layer?.properties.cropRect;
  const cropNatural = existing
    ? { left: existing.left, top: existing.top, width: existing.width, height: existing.height }
    : { left: 0, top: 0, width: naturalW, height: naturalH };

  const scaleX = imageObj.scaleX ?? 1;
  const scaleY = imageObj.scaleY ?? 1;
  const angle = imageObj.angle ?? 0;
  const imgLeft = imageObj.left ?? 0;
  const imgTop = imageObj.top ?? 0;

  let overlayLeft: number;
  let overlayTop: number;

  if (angle !== 0) {
    const rad = (angle * Math.PI) / 180;
    const localX = cropNatural.left * scaleX;
    const localY = cropNatural.top * scaleY;
    overlayLeft = imgLeft + localX * Math.cos(rad) - localY * Math.sin(rad);
    overlayTop = imgTop + localX * Math.sin(rad) + localY * Math.cos(rad);
  } else {
    overlayLeft = imgLeft + cropNatural.left * scaleX;
    overlayTop = imgTop + cropNatural.top * scaleY;
  }

  const overlay = new fabric.Rect({
    left: overlayLeft,
    top: overlayTop,
    width: cropNatural.width * scaleX,
    height: cropNatural.height * scaleY,
    fill: 'rgba(0,0,0,0)',
    stroke: '#3b82f6',
    strokeWidth: 2,
    strokeDashArray: [6, 4],
    transparentCorners: false,
    cornerColor: '#3b82f6',
    cornerSize: 10,
    lockRotation: true,
    angle: angle,
  });

  this.cropOverlay = overlay;
  this.croppingLayerId = layerId;

  const imgBounds = imageObj.getBoundingRect();

  const onScaling = (e: fabric.TEvent<Event> & { target?: fabric.FabricObject }): void => {
    if (e.target !== overlay) return;
    const ob = overlay.getBoundingRect();
    if (ob.left < imgBounds.left) {
      overlay.left = imgBounds.left;
    }
    if (ob.top < imgBounds.top) {
      overlay.top = imgBounds.top;
    }
    if (ob.left + ob.width > imgBounds.left + imgBounds.width) {
      overlay.scaleX = (imgBounds.left + imgBounds.width - overlay.left) / overlay.width;
    }
    if (ob.top + ob.height > imgBounds.top + imgBounds.height) {
      overlay.scaleY = (imgBounds.top + imgBounds.height - overlay.top) / overlay.height;
    }
    overlay.setCoords();
  };

  const onMoving = (e: fabric.TEvent<Event> & { target?: fabric.FabricObject }): void => {
    if (e.target !== overlay) return;
    const ob = overlay.getBoundingRect();
    const ow = ob.width;
    const oh = ob.height;
    let newLeft = overlay.left ?? 0;
    let newTop = overlay.top ?? 0;
    if (ob.left < imgBounds.left) newLeft += imgBounds.left - ob.left;
    if (ob.top < imgBounds.top) newTop += imgBounds.top - ob.top;
    if (ob.left + ow > imgBounds.left + imgBounds.width) newLeft -= (ob.left + ow) - (imgBounds.left + imgBounds.width);
    if (ob.top + oh > imgBounds.top + imgBounds.height) newTop -= (ob.top + oh) - (imgBounds.top + imgBounds.height);
    overlay.set({ left: newLeft, top: newTop });
    overlay.setCoords();
  };

  (overlay as fabric.Rect & { _cropScalingHandler: typeof onScaling })._cropScalingHandler = onScaling;
  (overlay as fabric.Rect & { _cropMovingHandler: typeof onMoving })._cropMovingHandler = onMoving;

  this.canvas.on('object:scaling', onScaling as (e: fabric.TEvent<Event>) => void);
  this.canvas.on('object:moving', onMoving as (e: fabric.TEvent<Event>) => void);

  this.canvas.add(overlay);
  this.canvas.setActiveObject(overlay);
  this.canvas.requestRenderAll();

  this.isCropMode.set(true);
  this.cropModeChanged.emit(true);
}
```

Key implementation notes:

- **`getElement()`**: `FabricImage` in Fabric.js 6/7 exposes the underlying HTML element via `getElement()`. This returns the original `HTMLImageElement`, which has `.naturalWidth`/`.naturalHeight`. Fall back to `imageObj.width` if the element reports 0 (e.g., SVG).
- **Rotation handling**: For `angle !== 0`, the crop overlay's top-left corner is computed by rotating the local-space offset `(cropNatural.left * scaleX, cropNatural.top * scaleY)` around the image's origin. The overlay itself is also given the same `angle` so it aligns visually.
- **Constraint storage**: The two event handlers are stored directly on the overlay object using typed augmented properties (`_cropScalingHandler`, `_cropMovingHandler`). This avoids a separate class-level map and makes `exitCropMode` able to retrieve and unregister them.
- **No `layerId` property**: The overlay rect is never assigned a `layerId` property. The `syncSelection` callback in `ngAfterViewInit` therefore ignores it — it filters on `typeof id === 'string'`, and undefined passes that filter, so be precise: the filter is `.filter((id): id is string => typeof id === 'string')`, which will correctly exclude undefined. Confirm this is already the case in the existing code — it is, at line 120.
- **`_isRendering` guard**: `enterCropMode` does not set `_isRendering = true` because the overlay add should trigger `selection:created` which will call `syncSelection`. That is acceptable — the overlay has no `layerId` so `ids` will be empty and `editorStore.selectLayers([])` will be called, which is the correct state while in crop mode.

### 3e. New private method: `exitCropMode()`

Add after `enterCropMode`:

```ts
private exitCropMode(): void {
  if (!this.canvas) return;

  if (this.cropOverlay) {
    type AugmentedRect = fabric.Rect & {
      _cropScalingHandler?: (e: fabric.TEvent<Event>) => void;
      _cropMovingHandler?: (e: fabric.TEvent<Event>) => void;
    };
    const aug = this.cropOverlay as AugmentedRect;
    if (aug._cropScalingHandler) {
      this.canvas.off('object:scaling', aug._cropScalingHandler);
    }
    if (aug._cropMovingHandler) {
      this.canvas.off('object:moving', aug._cropMovingHandler);
    }
    this.canvas.remove(this.cropOverlay);
    this.cropOverlay = null;
  }

  if (this.croppingLayerId) {
    const imageObj = this.canvas.getObjects().find(
      obj => (obj as fabric.FabricObject & { layerId?: string }).layerId === this.croppingLayerId
    );
    if (imageObj) {
      this.applyObjectInteractivity(imageObj, this.editorStore.canEdit());
    }
  }

  this.croppingLayerId = null;
  this.isCropMode.set(false);
  this.cropModeChanged.emit(false);
  this.canvas.requestRenderAll();
}
```

### 3f. New public method: `confirmCrop()`

Add after `exitCropMode`:

```ts
confirmCrop(): void {
  if (!this.cropOverlay || !this.croppingLayerId || !this.canvas) return;

  const layerId = this.croppingLayerId;
  const overlay = this.cropOverlay;

  const imageObj = this.canvas.getObjects().find(
    obj => (obj as fabric.FabricObject & { layerId?: string }).layerId === layerId
  ) as fabric.FabricImage | undefined;

  if (!imageObj) return;

  const naturalW = (imageObj.getElement() as HTMLImageElement).naturalWidth || imageObj.width || 1;
  const naturalH = (imageObj.getElement() as HTMLImageElement).naturalHeight || imageObj.height || 1;

  const scaleX = imageObj.scaleX ?? 1;
  const scaleY = imageObj.scaleY ?? 1;
  const angle = imageObj.angle ?? 0;
  const imgLeft = imageObj.left ?? 0;
  const imgTop = imageObj.top ?? 0;

  const overlayScaledW = overlay.getScaledWidth();
  const overlayScaledH = overlay.getScaledHeight();
  const overlayLeft = overlay.left ?? 0;
  const overlayTop = overlay.top ?? 0;

  let cropLeft: number;
  let cropTop: number;

  if (angle !== 0) {
    const rad = -(angle * Math.PI) / 180;
    const dx = overlayLeft - imgLeft;
    const dy = overlayTop - imgTop;
    const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);
    cropLeft = rotatedX / scaleX;
    cropTop = rotatedY / scaleY;
  } else {
    cropLeft = (overlayLeft - imgLeft) / scaleX;
    cropTop = (overlayTop - imgTop) / scaleY;
  }

  const cropWidth = overlayScaledW / scaleX;
  const cropHeight = overlayScaledH / scaleY;

  const clampedLeft = Math.max(0, Math.min(cropLeft, naturalW));
  const clampedTop = Math.max(0, Math.min(cropTop, naturalH));
  const clampedWidth = Math.max(1, Math.min(cropWidth, naturalW - clampedLeft));
  const clampedHeight = Math.max(1, Math.min(cropHeight, naturalH - clampedTop));

  this.editorStore.applyCrop(layerId, {
    left: clampedLeft,
    top: clampedTop,
    width: clampedWidth,
    height: clampedHeight,
  });
}
```

Notes on `confirmCrop`:

- `applyCrop` in the store calls `setActiveTool('select')`, which triggers the activeTool effect, which calls `exitCropMode`. So `exitCropMode` is not called here directly — it will be triggered automatically.
- `getScaledWidth()` returns `width * scaleX` on the overlay, which is the correct canvas-space width accounting for any handle-based resize the user performed.
- Clamping ensures values never exceed natural image dimensions, guarding against floating-point drift at boundaries.

### 3g. New public method: `cancelCrop()`

Add after `confirmCrop`:

```ts
cancelCrop(): void {
  this.exitCropMode();
  this.editorStore.setActiveTool('select');
}
```

### 3h. Update `renderLayers()` — apply clipPath for `cropRect`

Inside the `imgEl.onload` callback, after `imageObj.setCoords()` and before `this.canvas.add(imageObj)`, add the clipPath block:

```ts
if (layer.properties.cropRect) {
  const cr = layer.properties.cropRect;
  const clipRect = new fabric.Rect({
    left: cr.left - (imgEl.naturalWidth / 2),
    top: cr.top - (imgEl.naturalHeight / 2),
    width: cr.width,
    height: cr.height,
    absolutePositioned: false,
  });
  imageObj.clipPath = clipRect;
}
```

Why these coordinates: In Fabric.js 6+, when `absolutePositioned: false` (the default), a `clipPath` is placed in the object's **local coordinate space**. The origin of that space is the object center. For a `FabricImage`, the center is at `(naturalWidth / 2, naturalHeight / 2)` in natural pixel coordinates. Therefore, to map `cr.left` (in natural px from left edge) to local space: `cr.left - naturalWidth / 2`. The same logic applies to `cr.top`.

This approach means the clip region scales and rotates with the image automatically, because Fabric transforms the clipPath with the parent object.

### 3i. Update the inline template — add crop confirm/cancel bar

The component uses an inline `template` string (not a separate HTML file). The existing template is:

```ts
template: `
  <div class="relative bg-white shadow-md" [style.width.px]="width" [style.height.px]="height">
    <canvas #canvasEl [width]="width" [height]="height"></canvas>
    @if (contextMenu().visible) {
      ...context menu...
    }
  </div>
`,
```

Add the crop bar block **after** the context menu `@if` block, still inside the outer `<div>`:

```html
@if (isCropMode()) {
  <div class="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2 z-50 bg-white/90 rounded-lg px-3 py-1.5 shadow border border-gray-200">
    <button
      class="px-3 py-1 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
      (click)="confirmCrop()">
      Apply Crop
    </button>
    <button
      class="px-3 py-1 text-sm font-medium bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50"
      (click)="cancelCrop()">
      Cancel
    </button>
  </div>
}
```

### 3j. Guard `mouse:down` tool handler against crop mode

In `ngAfterViewInit`, the `mouse:down` handler that creates text/shape layers begins with:

```ts
const tool = this.editorStore.activeTool();
if (tool === 'select' || !this.editorStore.canEdit()) return;
```

Change that guard to also bail when in crop mode:

```ts
const tool = this.editorStore.activeTool();
if (tool === 'select' || tool === 'crop' || !this.editorStore.canEdit()) return;
```

This prevents a stray canvas click during crop mode from accidentally creating a new layer.

### 3k. Guard `saveLayerFromObject` against the crop overlay

`saveLayerFromObject` is invoked from `object:modified`. If the crop overlay is moved or scaled it would trigger this callback. Since the overlay has no `layerId`, the early-return guard `if (!obj || !layerId || this._isRendering) return;` already handles this — `layerId` would be `undefined`, so the function returns immediately. No additional change needed.

---

## 4. `src/app/presentation/components/toolbar/toolbar.component.ts`

### What changes

Add a `hasImageSelection` computed signal.

After the existing `protected readonly selectionCount` line, add:

```ts
protected readonly hasImageSelection = computed(() =>
  this.editorStore.selectedLayers().length === 1 &&
  this.editorStore.selectedLayers()[0].type === 'image'
);
```

No other TypeScript changes are needed. `ToolType` is already imported from the store and `'crop'` is now part of that union.

---

## 5. `src/app/presentation/components/toolbar/toolbar.component.html`

### What changes

Add the Crop button. The button must be conditional on `hasImageSelection() && editorStore.canEdit()` and must match the existing button style exactly.

Place the crop button block **after the AI button** and **before** the first `<div class="w-px h-5 bg-gray-200 mx-2"></div>` divider (which currently appears on line 57). The AI button ends on line 55:

```html
<button
  class="bg-gradient-to-r from-brand-500 to-brand-700 text-white px-3 py-1 text-sm rounded-md hover:from-brand-600 hover:to-brand-800 shadow-sm transition-all disabled:opacity-40 flex items-center gap-1.5"
  [disabled]="!editorStore.canEdit()"
  (click)="aiGenerateClicked.emit()"
><span>✦</span><span>AI</span></button>
```

Insert the crop button block immediately after:

```html
@if (hasImageSelection() && editorStore.canEdit()) {
  <button
    class="px-3 py-1 text-sm rounded-md transition-colors"
    [class.bg-brand-100]="editorStore.activeTool() === 'crop'"
    [class.text-brand-700]="editorStore.activeTool() === 'crop'"
    [class.bg-gray-100]="editorStore.activeTool() !== 'crop'"
    [class.text-gray-700]="editorStore.activeTool() !== 'crop'"
    (click)="selectTool('crop')"
    title="Crop image"
  >Crop</button>
}
```

The active-state classes (`bg-brand-100`, `text-brand-700`) and inactive classes (`bg-gray-100`, `text-gray-700`) are taken verbatim from the existing Select/Text tool buttons.

---

## 6. `src/app/presentation/components/image-transform-panel/image-transform-panel.component.ts`

### What changes

Extend the `reset()` method so it also removes `cropRect` from the layer when resetting.

The current `reset()` method body (lines 83–101) contains this block:

```ts
if (l) {
  const { transforms: _t, ...rest } = l.properties;
  this.editorStore.updateLayer(l.id, { properties: rest });
  if (l.content) this.loadImageMeta(l.content);
}
```

Change it to:

```ts
if (l) {
  const { transforms: _t, cropRect: _c, ...rest } = l.properties;
  this.editorStore.updateLayer(l.id, { properties: rest });
  if (l.content) this.loadImageMeta(l.content);
}
```

The only difference is adding `cropRect: _c` to the destructuring. TypeScript will not complain about `_c` being unused because the `_` prefix is the project's convention for intentionally unused destructure targets (matching the existing `_t` pattern).

---

## Critical implementation details and tricky areas

### Fabric.js 7 API notes

The codebase already imports Fabric as `import * as fabric from 'fabric'`. All Fabric 7 APIs are accessed via this namespace. Key methods:

- `canvas.getObjects()` — returns all canvas objects including the overlay
- `canvas.off(eventName, handler)` — removes a specific handler. Pass the exact same function reference that was passed to `canvas.on()`.
- `imageObj.getElement()` — returns the raw `HTMLImageElement`. Cast to `HTMLImageElement` to access `.naturalWidth/.naturalHeight`.
- `imageObj.getBoundingRect()` — returns `{ left, top, width, height }` in canvas (viewport) coordinates, accounting for rotation and scale.
- `overlay.getScaledWidth()` — returns `overlay.width * overlay.scaleX`. Use this in `confirmCrop` to get the actual displayed width after the user has resized via handles.
- `fabric.util.transformPoint` — available but not needed here; the manual rotation math is explicit and more readable for reviewers.

### Why `absolutePositioned: false` on clipPath

Setting `absolutePositioned: false` (the default when not specified) tells Fabric to interpret the clipPath in the parent object's local coordinate system. The parent's local origin is its center. This is why the `left`/`top` of the clip rect must be offset by `-(naturalWidth/2)` and `-(naturalHeight/2)`. If `absolutePositioned: true` were used instead, the clip rect would be in canvas (world) coordinates, which would break when the image is moved or rotated.

### Why the overlay must not have a `layerId` property

The `syncSelection` callback (attached to `selection:created` and `selection:updated` in `ngAfterViewInit`) collects `layerId` values from the active selection and calls `editorStore.selectLayers(ids)`. If the overlay had a `layerId`, selecting it would attempt to select a non-existent layer in the store, and subsequent re-renders triggered by `selectedLayerIds` would clear and re-add all objects while the overlay is active — corrupting crop mode.

### Effect ordering: tool change → renderLayers race

When `applyCrop` calls `setActiveTool('select')`, two effects fire nearly simultaneously:
1. The activeTool effect calls `exitCropMode()` (clears the overlay, restores image interactivity).
2. The layers effect calls `renderLayers()` (clears all canvas objects and re-renders from the layer signal, now including the `cropRect`).

Angular's effect scheduler runs effects in dependency order within the same microtask batch. Both signals change in the same synchronous `applyCrop` call. The layers signal changes first (inside `commitHistory`), then `activeTool`. Effect 2 (layers) may fire before Effect 1 (activeTool). This is safe because `renderLayers` calls `this.canvas.clear()`, which removes the overlay anyway. Effect 1 then calls `exitCropMode`, which checks `if (this.cropOverlay)` — after `canvas.clear()` the overlay reference still exists in `this.cropOverlay` but it is no longer on the canvas. The `canvas.remove(this.cropOverlay)` in `exitCropMode` is a no-op for already-removed objects in Fabric. Confirm that `canvas.remove()` is idempotent for objects not currently on the canvas — it is in Fabric 6/7 (it splices from the internal `_objects` array only if found).

### Keyboard Delete guard

The existing `keydown` handler calls `deleteSelectedLayers()` when Delete/Backspace is pressed. While in crop mode, the active object is the overlay rect, which has no `layerId`. Pressing Delete would call `deleteSelectedLayers()`, which iterates `editorStore.selectedLayerIds()`. Those IDs are empty during crop mode (because `syncSelection` emits empty when the overlay is selected). So `ids.forEach(id => editorStore.removeLayer(id))` is a no-op. However, the overlay itself would be removed from the canvas by the Fabric-level loop in `deleteSelectedLayers`. To prevent this, add an early return in `deleteSelectedLayers` when in crop mode:

```ts
protected deleteSelectedLayers(): void {
  if (this.isCropMode()) return;
  // ... existing body
}
```

This one additional guard is needed but was not listed in the original spec. It is necessary to prevent the user from accidentally dismissing the crop overlay with the Delete key.

### `saveLayerFromObject` and `object:modified` during crop

When the user resizes the crop overlay, `object:modified` fires with `e.target` being the overlay rect. `saveLayerFromObject` receives it. Its first check is `const layerId = obj?.layerId` — undefined — so it returns immediately. No change needed.

### TypeScript strict mode

- All event handler types must be explicit. Fabric 7 uses generic `TEvent<Event>` for canvas events. The handlers stored on the overlay use a type augmentation pattern (`AugmentedRect`) rather than `any`.
- `getElement()` returns `HTMLElement | null` in Fabric 7's types. Cast with `as HTMLImageElement` only after confirming the object is a `FabricImage`. The `instanceof fabric.FabricImage` check preceding any `getElement()` call makes this cast safe.
- The `cropRect` destructure in `clearCrop` and `image-transform-panel reset()` will raise a TypeScript error if `cropRect` is not present in `LayerProperties`. The domain model change (step 1) must be applied before these store/component changes.

---

## Build verification

After all edits are applied, run:

```bash
cd /Users/LAPTOP-david-001/Development/apps/Angular/canvas-flow-frontend && pnpm build
```

Common TypeScript errors to expect and fix:

1. **`Property 'cropRect' does not exist on type 'LayerProperties'`** — domain model change was not saved.
2. **`Argument of type '"crop"' is not assignable to parameter of type 'ToolType'`** — `ToolType` union extension was not applied.
3. **`Property 'cropModeChanged' does not exist`** — `@Output()` or `EventEmitter` import missing.
4. **`Object is possibly 'null'`** on `imageObj.getElement()` — add null check or non-null assertion after the `instanceof` guard.
5. **`_c is declared but its value is never read`** — if strict unused-locals is on, rename to `_cropRect` or suppress with `// eslint-disable-next-line @typescript-eslint/no-unused-vars`.

---

## Files modified (summary)

| File | Change type |
|------|-------------|
| `src/app/domain/models/layer.model.ts` | Add `cropRect` field to `LayerProperties` |
| `src/app/application/stores/editor.store.ts` | Extend `ToolType`, add `applyCrop`, add `clearCrop` |
| `src/app/presentation/components/canvas/canvas.component.ts` | Add imports, fields, output, effect, `enterCropMode`, `exitCropMode`, `confirmCrop`, `cancelCrop`, clipPath in `renderLayers`, crop bar in template, guard in `mouse:down`, guard in `deleteSelectedLayers` |
| `src/app/presentation/components/toolbar/toolbar.component.ts` | Add `hasImageSelection` computed |
| `src/app/presentation/components/toolbar/toolbar.component.html` | Add Crop button after AI button |
| `src/app/presentation/components/image-transform-panel/image-transform-panel.component.ts` | Extend `reset()` to also omit `cropRect` |
