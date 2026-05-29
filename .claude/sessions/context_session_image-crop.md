# Session: Image Crop Feature

## Status: Planning

---

## Feature Summary

Non-destructive image cropping for image layers on the canvas, implemented with Fabric.js 7 `clipPath`. Crop bounds are persisted to the layer model so they survive save/load and undo/redo.

---

## Codebase Findings

### Relevant files
- `domain/models/layer.model.ts` — `LayerProperties`, `LayerTransforms`
- `application/stores/editor.store.ts` — `ToolType`, `EditorStore`, `updateLayer()`, `commitHistory()`
- `presentation/components/canvas/canvas.component.ts` — Fabric.js canvas, `renderLayers()`, image rendering
- `presentation/components/toolbar/toolbar.component.ts` — tool buttons, exports
- `presentation/components/inspector/inspector.component.ts` — right-panel inspector
- `presentation/components/image-transform-panel/image-transform-panel.component.ts` — image-specific controls

### Key constraints
- No NgRx; state via Angular Signals
- `renderLayers()` does a full `canvas.clear()` + re-add on every layers signal change
- Images are `fabric.FabricImage` with `scaleX/scaleY` normalized from natural dimensions
- `activeTool` is `'select' | 'text' | 'shape'` — crop extends this union
- Crop must be purely frontend (Fabric.js `clipPath`) — no server-side processing

---

## Team

- **Frontend**: `angular-frontend-developer` — UI/state/Fabric.js patterns
- **Backend**: none required (feature is 100% client-side)

---

## Implementation Plan

### 1. Domain layer — `layer.model.ts`

Add `cropRect` to `LayerProperties`:

```ts
readonly cropRect?: {
  readonly left: number;   // offset from image natural left (px)
  readonly top: number;    // offset from image natural top (px)
  readonly width: number;  // crop width in natural image px
  readonly height: number; // crop height in natural image px
};
```

Coordinates are in the **natural image space** (before scaleX/scaleY), matching Fabric.js `clipPath` coordinate system relative to the object's own origin.

### 2. Application layer — `editor.store.ts`

- Extend `ToolType`: `'select' | 'text' | 'shape' | 'crop'`
- Add `isCropMode` computed: `activeTool === 'crop' && selectedLayers has exactly 1 image layer`
- Add `applyCrop(layerId, cropRect)` method:
  - calls `updateLayer(id, { properties: { ...existing, cropRect } })`
  - switches `activeTool` back to `'select'`
- Add `cancelCrop()` method:
  - switches `activeTool` back to `'select'`

### 3. Canvas component — `canvas.component.ts`

#### Crop overlay (internal state)
```ts
private cropOverlay: fabric.Rect | null = null;
private croppingLayerId: string | null = null;
```

#### `effect()` on `activeTool`
- When tool becomes `'crop'` and a single image layer is selected:
  - Find the `FabricImage` object on canvas by `layerId`
  - Lock it (`lockMovementX/Y`, `hasControls: false`)
  - Create a `fabric.Rect` overlay covering the full image (or existing `cropRect` if any):
    - `fill: 'rgba(0,0,0,0)'`, `stroke: '#3b82f6'`, `strokeWidth: 2`
    - `strokeDashArray: [5,3]`
    - Custom corner handles for resize
    - Constrain its `object:scaling` / `object:moving` to stay within image bounds
  - Add overlay to canvas, set as active object
  - Store `croppingLayerId`
- When tool leaves `'crop'` (any transition): call `exitCropMode()` to clean up overlay

#### `exitCropMode()`
- Remove `cropOverlay` from canvas
- Restore image object interactivity
- Set `cropOverlay = null`, `croppingLayerId = null`

#### Confirm crop
- Read overlay rect coords (relative to canvas), convert to image's natural px space
- Call `editorStore.applyCrop(croppingLayerId, { left, top, width, height })`
- `renderLayers()` will re-run via the layers signal effect and apply `clipPath`

#### `renderLayers()` — apply `clipPath` when `cropRect` is set
```ts
if (layer.cropRect) {
  const clipRect = new fabric.Rect({
    left: layer.cropRect.left,
    top: layer.cropRect.top,
    width: layer.cropRect.width,
    height: layer.cropRect.height,
    absolutePositioned: false,  // relative to object
  });
  imageObj.clipPath = clipRect;
}
```

#### Constraint logic during crop overlay resize/move
- `object:scaling` event: clamp overlay to image bounding box
- `object:moving` event: clamp overlay to stay within image bounds

### 4. Canvas component template — crop toolbar overlay

Inside the existing `<div class="relative ...">` wrapper, add a conditional crop action bar:

```html
@if (isCropMode()) {
  <div class="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2 z-50">
    <button (click)="confirmCrop()">Crop</button>
    <button (click)="cancelCrop()">Cancel</button>
  </div>
}
```

`isCropMode()` is a local signal set when entering crop mode.

### 5. Toolbar — crop button

Add a `'crop'` tool button in `toolbar.component.ts`, visible only when a single image layer is selected:

```html
@if (hasImageSelection()) {
  <button (click)="selectTool('crop')">Crop</button>
}
```

`hasImageSelection` computed: `selectedLayers().length === 1 && selectedLayers()[0].type === 'image'`

---

## Data Flow

```
User clicks "Crop" in toolbar
  → editorStore.setActiveTool('crop')
  → CanvasComponent effect fires
  → Crop overlay Rect added to canvas

User resizes overlay
  → Fabric object:scaling/moving events clamp to image bounds

User clicks "Confirm"
  → confirmCrop() converts overlay coords → natural image space
  → editorStore.applyCrop(id, cropRect)
  → layers signal changes → renderLayers() fires
  → FabricImage gets clipPath applied
  → activeTool resets to 'select'

User clicks "Cancel"
  → cancelCrop() removes overlay
  → activeTool resets to 'select'
  → No layer mutation, undo stack unchanged
```

---

## Undo/Redo

- `applyCrop()` calls `updateLayer()` which calls `commitHistory()` — crop is undoable
- Cancel does NOT touch history
- Undo after crop: `cropRect` reverts to previous value, `renderLayers()` re-applies or removes `clipPath`

---

## Persistence

`cropRect` is part of `LayerProperties`, so it's saved to the backend via the existing `saveLayers()` flow with no backend changes needed.

---

## Branch Strategy

- **Branch**: `feat/image-crop`
- **Base**: `develop`
- **Target PR**: `develop`
- **Reviewer**: 1 required

---

## Files to Modify

| File | Change |
|---|---|
| `domain/models/layer.model.ts` | Add `cropRect` to `LayerProperties` |
| `application/stores/editor.store.ts` | Extend `ToolType`, add `applyCrop()`, `cancelCrop()` |
| `presentation/components/canvas/canvas.component.ts` | Crop mode logic, overlay, `renderLayers` clipPath |
| `presentation/components/toolbar/toolbar.component.ts` | Crop button (image selection only) |

No new files needed.

---

## Architectural Decisions (from Angular agent advice)

### clipPath coordinate space
Use **local coordinate space** (`absolutePositioned: false`, the default). The clipPath `left/top` origin is the **image center**, not its top-left. Convert stored `cropRect` values (natural image px from top-left) to local coords:
```
clipPath.left = cropRect.left - imageNaturalWidth / 2
clipPath.top  = cropRect.top  - imageNaturalHeight / 2
```
Store `cropRect` normalized to the image's **natural pixel dimensions** (pre-scale). This survives the image being moved/rotated correctly.

### clipPath must be applied inside the async onload callback
`FabricImage.width/height` are only valid after the image element loads. Apply `clipPath` inside `imgEl.onload`, after `imageObj` is constructed — not before.

### Overlay rect is transient, never a layer
The `fabric.Rect` overlay is added imperatively to the canvas during crop mode. It is **never** part of the `layers` signal. This avoids triggering `renderLayers()` while cropping. On `canvas.clear()` it is destroyed; this is fine because crop mode is always exited before any layer-signal-driven re-render.

### Crop toolbar UI: sibling component, not inside CanvasComponent
`CanvasComponent` exposes a `cropModeActive` output signal. The parent editor page renders a `CropToolbarComponent` as an absolutely-positioned overlay above the canvas when crop mode is active. `CanvasComponent` stays single-responsibility (Fabric.js only).

### Undo/redo
`applyCrop()` → `updateLayer()` → `commitHistory()`. Cancel is a no-op on state. Undo naturally restores previous `cropRect` (or `undefined`), and `renderLayers()` reconstructs the correct `clipPath`.

---

## Clarification Answers

- **Overlay initial size**: Full image covered on first crop; if `cropRect` already exists, restore it
- **Remove crop**: Handled by the existing "Reset" button in `ImageTransformPanelComponent` (clears `cropRect` alongside transforms)
- **Rotation**: Always allow crop regardless of rotation — handle coordinate math correctly

---

## Acceptance Criteria

- [ ] Crop button appears in toolbar only when a single image layer is selected
- [ ] Entering crop mode shows a resizable dashed rect overlay on top of the image
- [ ] Overlay is constrained to image bounds (cannot extend outside)
- [ ] Confirming crop applies `clipPath` visually and persists `cropRect` to layer model
- [ ] Cancelling crop removes overlay with no state change
- [ ] Cropped image re-renders correctly after undo/redo
- [ ] Cropped image re-renders correctly after save + reload
- [ ] Non-image layers are unaffected
