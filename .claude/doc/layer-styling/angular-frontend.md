# Layer Styling System — Implementation Plan

## Scope

Extend text and shape layer styling. No new files. Four files modified in dependency order:

1. `src/app/domain/models/layer.model.ts`
2. `src/app/application/stores/editor.store.ts`
3. `src/app/presentation/components/canvas/canvas.component.ts`
4. `src/app/presentation/components/inspector/inspector.component.ts`
5. `src/app/presentation/components/inspector/inspector.component.html`

---

## File 1 — `src/app/domain/models/layer.model.ts`

### What exists now

`LayerProperties` has: `x`, `y`, `width`, `height`, `rotation`, `zIndex`, `transforms?`, `fontFamily?`, `fontSize?`.

### Change

Add seven optional readonly fields to `LayerProperties` immediately after `fontSize?`:

```ts
readonly fontWeight?: 'normal' | 'bold';
readonly fontStyle?: 'normal' | 'italic';
readonly underline?: boolean;
readonly textColor?: string;
readonly textAlign?: 'left' | 'center' | 'right';
readonly fillColor?: string;
readonly strokeColor?: string;
readonly strokeWidth?: number;
```

No other changes to this file.

---

## File 2 — `src/app/application/stores/editor.store.ts`

### What exists now

`updateTextStyle(id: string, fontFamily?: string, fontSize?: number)` — positional signature, spreads conditionally.

No `updateShapeStyle` method.

### Change A — Replace `updateTextStyle` entirely

The current method at line 171 must be deleted and replaced with a patch-object version:

```ts
updateTextStyle(id: string, patch: {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}): void {
  const next = this.layers().map(l => {
    if (l.id !== id) return l;
    return { ...l, properties: { ...l.properties, ...patch } };
  });
  this.commitHistory(next);
}
```

The old body spread `fontFamily` and `fontSize` conditionally with ternaries. The new body uses a single spread of `patch`, which already omits undefined keys in the caller. This is safe because all callers are updated in the same change set.

### Change B — Add `updateShapeStyle` after `updateTextStyle`

```ts
updateShapeStyle(id: string, patch: { fillColor?: string; strokeColor?: string; strokeWidth?: number }): void {
  const next = this.layers().map(l => {
    if (l.id !== id) return l;
    return { ...l, properties: { ...l.properties, ...patch } };
  });
  this.commitHistory(next);
}
```

Insert this immediately after the closing brace of `updateTextStyle`.

---

## File 3 — `src/app/presentation/components/canvas/canvas.component.ts`

### Change A — `renderLayers`: text branch constructor arguments (lines 239–248)

The existing `fabric.Textbox` constructor object literal ends at `fontSize`. Append five properties inside the same object literal:

```ts
fontWeight: layer.properties.fontWeight ?? 'normal',
fontStyle: layer.properties.fontStyle ?? 'normal',
underline: layer.properties.underline ?? false,
fill: layer.properties.textColor ?? '#000000',
textAlign: layer.properties.textAlign ?? 'left',
```

The full resulting object passed to `new fabric.Textbox(...)` will have eleven properties. The surrounding code (`applyObjectInteractivity`, `text.set({ lockScalingY: true })`, `layerId` assignment) is unchanged.

### Change B — `renderLayers`: shape branch constructor arguments (lines 255–264)

Replace the three hardcoded values `fill`, `stroke`, `strokeWidth` with property reads:

```ts
fill: layer.properties.fillColor ?? '#dbeafe',
stroke: layer.properties.strokeColor ?? '#60a5fa',
strokeWidth: layer.properties.strokeWidth ?? 1,
```

The surrounding code (`applyObjectInteractivity`, `layerId` assignment) is unchanged.

### Change C — `saveLayerFromObject`: expand `textProps` (line 334)

The existing block is:

```ts
const textProps = (obj instanceof fabric.Textbox || obj instanceof fabric.IText)
  ? { fontFamily: (obj as fabric.Textbox).fontFamily ?? 'Arial', fontSize: (obj as fabric.Textbox).fontSize ?? 24 }
  : {};
```

Replace with:

```ts
const textProps = (obj instanceof fabric.Textbox || obj instanceof fabric.IText)
  ? {
      fontFamily: (obj as fabric.Textbox).fontFamily ?? 'Arial',
      fontSize: (obj as fabric.Textbox).fontSize ?? 24,
      fontWeight: ((obj as fabric.Textbox).fontWeight as 'normal' | 'bold') ?? 'normal',
      fontStyle: ((obj as fabric.Textbox).fontStyle as 'normal' | 'italic') ?? 'normal',
      underline: (obj as fabric.Textbox).underline ?? false,
      textColor: (obj as fabric.Textbox).fill as string ?? '#000000',
      textAlign: ((obj as fabric.Textbox).textAlign as 'left' | 'center' | 'right') ?? 'left',
    }
  : {};
```

Note: Fabric.js stores `fill` as the text color on `IText`/`Textbox`. The cast to `string` is necessary because `fill` is typed as `TFiller | string | null`. TypeScript will flag this without the cast. The `as 'normal' | 'bold'` casts are required because Fabric types `fontWeight` as `string`.

### Change D — `saveLayerFromObject`: add `shapeProps` block after `textProps`

Insert immediately after the `textProps` const, before the `const patch = {` line:

```ts
const shapeProps = (obj instanceof fabric.Rect)
  ? {
      fillColor: obj.fill as string ?? '#dbeafe',
      strokeColor: obj.stroke as string ?? '#60a5fa',
      strokeWidth: obj.strokeWidth ?? 1,
    }
  : {};
```

### Change E — `saveLayerFromObject`: merge `shapeProps` into the `properties` patch

The existing `patch` object (line 337) spreads `...textProps`. Add `...shapeProps` after it:

```ts
properties: {
  ...existingProps,
  x: obj.left ?? 0,
  y: obj.top ?? 0,
  width,
  height,
  rotation: obj.angle ?? 0,
  zIndex: this.canvas.getObjects().indexOf(obj),
  ...textProps,
  ...shapeProps,
},
```

---

## File 4 — `src/app/presentation/components/inspector/inspector.component.ts`

### Change A — Fix `onFontFamilyChange` (line 81)

Current: `this.editorStore.updateTextStyle(layerId, value, undefined);`

Replace with: `this.editorStore.updateTextStyle(layerId, { fontFamily: value });`

### Change B — Fix `onFontSizeChange` (line 87)

Current: `this.editorStore.updateTextStyle(layerId, undefined, value);`

Replace with: `this.editorStore.updateTextStyle(layerId, { fontSize: value });`

### Change C — Add new handler methods

Add these nine methods to the class body, after `onFontSizeChange`:

```ts
onFontWeightToggle(layerId: string, current: string): void {
  this.editorStore.updateTextStyle(layerId, { fontWeight: current === 'bold' ? 'normal' : 'bold' });
}

onFontStyleToggle(layerId: string, current: string): void {
  this.editorStore.updateTextStyle(layerId, { fontStyle: current === 'italic' ? 'normal' : 'italic' });
}

onUnderlineToggle(layerId: string, current: boolean): void {
  this.editorStore.updateTextStyle(layerId, { underline: !current });
}

onTextColorChange(event: Event, layerId: string): void {
  this.editorStore.updateTextStyle(layerId, { textColor: (event.target as HTMLInputElement).value });
}

onTextAlignChange(align: 'left' | 'center' | 'right', layerId: string): void {
  this.editorStore.updateTextStyle(layerId, { textAlign: align });
}

onFillColorChange(event: Event, layerId: string): void {
  this.editorStore.updateShapeStyle(layerId, { fillColor: (event.target as HTMLInputElement).value });
}

onStrokeColorChange(event: Event, layerId: string): void {
  this.editorStore.updateShapeStyle(layerId, { strokeColor: (event.target as HTMLInputElement).value });
}

onStrokeWidthChange(event: Event, layerId: string): void {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(value) && value >= 0) {
    this.editorStore.updateShapeStyle(layerId, { strokeWidth: value });
  }
}
```

No new imports are needed. `FormsModule` is already imported. All referenced store methods exist after the store changes above.

---

## File 5 — `src/app/presentation/components/inspector/inspector.component.html`

### Change A — Replace the `@if (layer.type === 'text')` block (lines 84–113)

Delete lines 84–113 entirely and replace with the expanded text block:

```html
@if (layer.type === 'text') {
  <div class="mt-3 border-t border-gray-100 pt-3 space-y-3">
    <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Text Style</p>

    <label class="block text-xs text-gray-500">
      Font
      <select
        class="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white"
        [value]="layer.properties.fontFamily ?? 'Arial'"
        (change)="onFontFamilyChange($event, layer.id)"
      >
        @for (font of FONT_FAMILIES; track font) {
          <option [value]="font">{{ font }}</option>
        }
      </select>
    </label>

    <label class="block text-xs text-gray-500">
      Size
      <input
        type="number"
        min="6"
        max="400"
        class="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-sm"
        [value]="layer.properties.fontSize ?? 24"
        (change)="onFontSizeChange($event, layer.id)"
      />
    </label>

    <div>
      <p class="text-xs text-gray-500 mb-1">Style</p>
      <div class="flex gap-1">
        <button
          class="flex-1 py-1 rounded text-sm font-bold border"
          [class]="(layer.properties.fontWeight ?? 'normal') === 'bold' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-600'"
          (click)="onFontWeightToggle(layer.id, layer.properties.fontWeight ?? 'normal')"
          title="Bold"
        >B</button>
        <button
          class="flex-1 py-1 rounded text-sm italic border"
          [class]="(layer.properties.fontStyle ?? 'normal') === 'italic' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-600'"
          (click)="onFontStyleToggle(layer.id, layer.properties.fontStyle ?? 'normal')"
          title="Italic"
        >I</button>
        <button
          class="flex-1 py-1 rounded text-sm underline border"
          [class]="(layer.properties.underline ?? false) ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-600'"
          (click)="onUnderlineToggle(layer.id, layer.properties.underline ?? false)"
          title="Underline"
        >U</button>
      </div>
    </div>

    <div>
      <p class="text-xs text-gray-500 mb-1">Align</p>
      <div class="flex gap-1">
        @for (align of (['left', 'center', 'right'] as const); track align) {
          <button
            class="flex-1 py-1 rounded text-xs border"
            [class]="(layer.properties.textAlign ?? 'left') === align ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-600'"
            (click)="onTextAlignChange(align, layer.id)"
          >{{ align }}</button>
        }
      </div>
    </div>

    <label class="block text-xs text-gray-500">
      Color
      <div class="mt-1 flex items-center gap-2">
        <input
          type="color"
          class="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
          [value]="layer.properties.textColor ?? '#000000'"
          (input)="onTextColorChange($event, layer.id)"
        />
        <span class="text-xs text-gray-400">{{ layer.properties.textColor ?? '#000000' }}</span>
      </div>
    </label>
  </div>
}
```

### Change B — Insert shape block between the text block and the image block

After the closing `}` of the text `@if` block and before `@if (layer.type === 'image')` (currently line 115), insert:

```html
@if (layer.type === 'shape') {
  <div class="mt-3 border-t border-gray-100 pt-3 space-y-3">
    <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Shape Style</p>

    <label class="block text-xs text-gray-500">
      Fill
      <div class="mt-1 flex items-center gap-2">
        <input
          type="color"
          class="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
          [value]="layer.properties.fillColor ?? '#dbeafe'"
          (input)="onFillColorChange($event, layer.id)"
        />
        <span class="text-xs text-gray-400">{{ layer.properties.fillColor ?? '#dbeafe' }}</span>
      </div>
    </label>

    <label class="block text-xs text-gray-500">
      Stroke
      <div class="mt-1 flex items-center gap-2">
        <input
          type="color"
          class="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
          [value]="layer.properties.strokeColor ?? '#60a5fa'"
          (input)="onStrokeColorChange($event, layer.id)"
        />
        <span class="text-xs text-gray-400">{{ layer.properties.strokeColor ?? '#60a5fa' }}</span>
      </div>
    </label>

    <label class="block text-xs text-gray-500">
      Stroke width
      <input
        type="number"
        min="0"
        max="50"
        class="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-sm"
        [value]="layer.properties.strokeWidth ?? 1"
        (change)="onStrokeWidthChange($event, layer.id)"
      />
    </label>
  </div>
}
```

---

## Ordering constraint

Apply changes in this exact order to avoid TypeScript errors mid-edit:

1. `layer.model.ts` — new fields must exist before the store and canvas reference them.
2. `editor.store.ts` — `updateTextStyle` signature must be updated before the inspector calls it.
3. `canvas.component.ts` — reads `LayerProperties` fields; safe after step 1.
4. `inspector.component.ts` — calls store methods; safe after step 2.
5. `inspector.component.html` — binds to component methods; safe after step 4.

---

## TypeScript notes

- `fabric.Textbox.fontWeight` is typed as `string` in the Fabric.js v6 type definitions, not as a union. The cast `as 'normal' | 'bold'` in `saveLayerFromObject` is required to satisfy `LayerProperties.fontWeight`.
- `fabric.Textbox.fontStyle` has the same situation, requiring `as 'normal' | 'italic'`.
- `fabric.Textbox.fill` is `TFiller | string | null`. The `as string` cast is required when assigning to `textColor: string`.
- `fabric.Rect.fill` and `fabric.Rect.stroke` require the same `as string` casts in `shapeProps`.
- The `(['left', 'center', 'right'] as const)` in the template `@for` loop is necessary so Angular's type checker narrows `align` to `'left' | 'center' | 'right'` when passing it to `onTextAlignChange`.

---

## Verification

After all changes: run `npx tsc --noEmit` from the project root. Expect zero errors. The four changed files are the only files that reference `LayerProperties` styling fields or call `updateTextStyle`/`updateShapeStyle`.
