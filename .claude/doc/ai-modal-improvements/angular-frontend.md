# Implementation Plan: AI Modal Style & Size Selection

## Overview

Four discrete changes across three existing files and one new file. The goal is to replace the raw `modelId` and `numImages` form fields with curated style and size selectors, surfaced as signal-driven UI cards and pills inside the AI generation modal.

---

## Files to Create

### `src/app/domain/constants/ai-styles.ts` (NEW)

The `domain/` directory currently contains only `models/`. Create a `constants/` sibling folder alongside it and add `ai-styles.ts`.

Full file content — export exactly as specified, no additions, no comments:

```typescript
export type AiStyleId = 'photorealistic' | 'hyperrealistic' | 'anime' | 'comic' | 'pixelart';
export type AiSizePresetId = 'square' | 'landscape-16-9' | 'portrait-9-16' | 'landscape-4-3' | 'portrait-3-4';

export interface AiStyle {
  id: AiStyleId;
  label: string;
  description: string;
  modelId: string;
  presetStyle?: string;
  promptPrefix?: string;
}

export interface AiSizePreset {
  id: AiSizePresetId;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

export const AI_STYLES: AiStyle[] = [
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    description: 'Natural photography look',
    modelId: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3',
  },
  {
    id: 'hyperrealistic',
    label: 'Hyperrealistic',
    description: 'Ultra-detailed, HDR quality',
    modelId: '7b592283-e8a7-4c5a-9ba6-d18c31f258b9',
  },
  {
    id: 'anime',
    label: 'Anime / Manga',
    description: 'Japanese animation style',
    modelId: 'e71a1c2f-4f80-4800-934f-2c68979d1cc6',
  },
  {
    id: 'comic',
    label: 'Comic / Cartoon',
    description: 'Illustrated, graphic novel style',
    modelId: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3',
    presetStyle: 'ILLUSTRATION',
  },
  {
    id: 'pixelart',
    label: 'Pixel Art',
    description: '8-bit retro game style',
    modelId: '7b592283-e8a7-4c5a-9ba6-d18c31f258b9',
    promptPrefix: 'pixel art, 8-bit, ',
  },
];

export const AI_SIZE_PRESETS: AiSizePreset[] = [
  { id: 'square', label: 'Square', ratio: '1:1', width: 1024, height: 1024 },
  { id: 'landscape-16-9', label: 'Landscape', ratio: '16:9', width: 1344, height: 768 },
  { id: 'portrait-9-16', label: 'Portrait', ratio: '9:16', width: 768, height: 1344 },
  { id: 'landscape-4-3', label: 'Landscape', ratio: '4:3', width: 1024, height: 768 },
  { id: 'portrait-3-4', label: 'Portrait', ratio: '3:4', width: 768, height: 1024 },
];
```

No barrel `index.ts` is needed; the component imports directly from this path.

---

## Files to Modify

### 1. `src/app/domain/models/asset.model.ts`

**Change:** Add one optional field to `AiGeneratePayload`. Everything else in the file stays byte-for-byte identical.

Current `AiGeneratePayload`:
```typescript
export interface AiGeneratePayload {
  prompt: string;
  modelId: string;
  workspaceId: string;
  width?: number;
  height?: number;
  numImages?: number;
}
```

Target `AiGeneratePayload`:
```typescript
export interface AiGeneratePayload {
  prompt: string;
  modelId: string;
  workspaceId: string;
  width?: number;
  height?: number;
  numImages?: number;
  presetStyle?: string;
}
```

Insert `presetStyle?: string;` after `numImages?: number;`. Do not touch `Asset`, `TransformPayload`, or any other interface.

The `AiApiService` (`src/app/data/services/ai-api.service.ts`) accepts `AiGeneratePayload` directly and passes it to `POST /ai/generate`, so no changes are required there — the new field flows through automatically.

---

### 2. `src/app/presentation/components/ai-modal/ai-modal.component.ts`

**Change:** Full rewrite of the class body. The `@Component` decorator metadata (`selector`, `standalone`, `imports`, `templateUrl`) stays identical.

#### Import changes

Remove from imports:
- Nothing from `@angular/core` beyond what is already there (`Component`, `EventEmitter`, `Output`, `inject`, `signal` are all still needed).

Add to imports:
```typescript
import { AI_STYLES, AI_SIZE_PRESETS, AiStyleId, AiSizePresetId } from '../../../domain/constants/ai-styles';
```

#### Class body changes

**Remove** from `form` group:
- `modelId` control (was `'ac614f96-1082-45bf-be9d-757f2d31c174'`)
- `numImages` control (was `1`)

**Keep** in `form` group:
- `prompt` with its existing validators (`Validators.required`, `Validators.minLength(3)`)

**Add** two signals after the existing three (`isGenerating`, `error`, `generatedAssets`):
```typescript
protected readonly selectedStyle = signal<AiStyleId>('photorealistic');
protected readonly selectedSize = signal<AiSizePresetId>('square');
```

**Add** two constant references so the template can iterate without importing:
```typescript
protected readonly styles = AI_STYLES;
protected readonly sizePresets = AI_SIZE_PRESETS;
```

**Rewrite `generate()`:**

```typescript
async generate(): Promise<void> {
  if (this.form.invalid || !this.editorStore.canEdit()) return;
  const project = this.editorStore.activeProject();
  if (!project) return;

  const { prompt } = this.form.getRawValue();
  const style = AI_STYLES.find(s => s.id === this.selectedStyle())!;
  const size = AI_SIZE_PRESETS.find(s => s.id === this.selectedSize())!;
  const finalPrompt = (style.promptPrefix ?? '') + prompt!;

  this.isGenerating.set(true);
  this.error.set(null);
  try {
    const result = await firstValueFrom(
      this.aiApi.generate({
        prompt: finalPrompt,
        modelId: style.modelId,
        presetStyle: style.presetStyle,
        workspaceId: project.workspaceId,
        width: size.width,
        height: size.height,
      }),
    );
    this.generatedAssets.set(result.assets);
  } catch {
    this.error.set('AI generation failed. Please try again.');
  } finally {
    this.isGenerating.set(false);
  }
}
```

Note: `numImages` is omitted from the payload entirely. The backend defaults to 1. `presetStyle` is `undefined` for styles that do not define it; the TypeScript compiler is happy because the field is now `presetStyle?: string` in `AiGeneratePayload`.

**Keep unchanged:** `addToCanvas()` and `close()` — copy them verbatim from the current file.

#### Complete resulting class shape (for reference, not the literal file):

```typescript
@Component({ ... })
export class AiModalComponent {
  private readonly aiApi = inject(AiApiService);
  protected readonly editorStore = inject(EditorStore);
  private readonly fb = inject(FormBuilder);

  @Output() readonly closed = new EventEmitter<void>();

  protected readonly isGenerating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly generatedAssets = signal<Asset[]>([]);
  protected readonly selectedStyle = signal<AiStyleId>('photorealistic');
  protected readonly selectedSize = signal<AiSizePresetId>('square');

  protected readonly styles = AI_STYLES;
  protected readonly sizePresets = AI_SIZE_PRESETS;

  protected readonly form = this.fb.group({
    prompt: ['', [Validators.required, Validators.minLength(3)]],
  });

  async generate(): Promise<void> { ... }   // as above
  addToCanvas(asset: Asset): void { ... }   // unchanged
  close(): void { ... }                      // unchanged
}
```

---

### 3. `src/app/presentation/components/ai-modal/ai-modal.component.html`

**Change:** Full rewrite. The outer backdrop `div` and the header section stay structurally identical except the modal container changes from `max-w-lg` to `max-w-2xl`.

#### Structure inside `<!-- Body -->` (top to bottom, inside `@else` block):

The `form` element now wraps only the new selectors, the prompt, and the submit button. Error banner and results grid stay outside the form, exactly as now.

```
form (ngSubmit)="generate()"
  ├── Style section
  │   ├── label "Image style"
  │   └── div role="radiogroup"  [grid grid-cols-5 gap-2]
  │       └── @for style of styles
  │           └── button role="radio" [aria-checked] (click)
  │               ├── span  — style.label  (font-medium text-sm)
  │               └── span  — style.description  (text-xs text-gray-500)
  ├── Size section
  │   ├── label "Output size"
  │   └── div role="radiogroup"  [flex gap-2 flex-wrap]
  │       └── @for preset of sizePresets
  │           └── button role="radio" [aria-checked] (click)
  │               ├── span  — preset.ratio  (font-semibold text-sm block)
  │               └── span  — preset.label  (text-xs block)
  ├── Prompt textarea  (unchanged markup)
  └── Generate button  (unchanged markup)
```

#### Style card Tailwind classes

Use `[class]` binding (not `aria-checked:` variant) because Tailwind v3 JIT does not scan dynamically-generated class strings by default, and `aria-checked:` requires explicit `content` config. A `[class]` binding on the button is reliable:

```html
<div role="radiogroup" class="grid grid-cols-5 gap-2">
  @for (style of styles; track style.id) {
    <button
      type="button"
      role="radio"
      [attr.aria-checked]="selectedStyle() === style.id"
      (click)="selectedStyle.set(style.id)"
      [class]="selectedStyle() === style.id
        ? 'flex flex-col gap-0.5 rounded-xl border-2 border-purple-500 bg-purple-50 px-2 py-2 text-left transition-colors w-full'
        : 'flex flex-col gap-0.5 rounded-xl border-2 border-gray-200 bg-white px-2 py-2 text-left hover:border-purple-300 transition-colors w-full'"
    >
      <span class="font-medium text-sm leading-tight">{{ style.label }}</span>
      <span class="text-xs text-gray-500 leading-tight">{{ style.description }}</span>
    </button>
  }
</div>
```

If five cards are too narrow at `max-w-2xl` during review, fall back to `grid-cols-3 gap-2` (five cards wrap into 3+2 rows). This is a visual judgment call at implementation time; either is structurally valid.

#### Size pill Tailwind classes

```html
<div role="radiogroup" class="flex gap-2 flex-wrap">
  @for (preset of sizePresets; track preset.id) {
    <button
      type="button"
      role="radio"
      [attr.aria-checked]="selectedSize() === preset.id"
      (click)="selectedSize.set(preset.id)"
      [class]="selectedSize() === preset.id
        ? 'flex flex-col items-center rounded-lg px-3 py-1.5 text-center bg-purple-600 text-white transition-colors'
        : 'flex flex-col items-center rounded-lg px-3 py-1.5 text-center bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors'"
    >
      <span class="font-semibold text-sm block">{{ preset.ratio }}</span>
      <span class="text-xs block">{{ preset.label }}</span>
    </button>
  }
</div>
```

#### Sections that carry over unchanged

- The outer backdrop and `(click)="close()"` wrapper
- The gradient header (including the `✦` glyph and close button)
- The read-only warning banner inside `@if (!editorStore.canEdit())`
- The prompt `<textarea>` and all its classes
- The generate `<button>` and all its classes including the spinner
- The error banner (`@if (error())`)
- The generated images grid (`@if (generatedAssets().length > 0)`)

The error banner and results grid must remain **outside** the `<form>` tag, as they are now.

#### Modal container width change

In the outermost modal `div`, change `max-w-lg` to `max-w-2xl`:

```
before: class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col"
after:  class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col"
```

---

## Build Verification

After all four changes run:

```bash
pnpm build
```

Expected outcome: zero TypeScript errors. Potential issues to watch for:

1. **`presetStyle` type mismatch** — `style.presetStyle` is `string | undefined`; `AiGeneratePayload.presetStyle` is now `string | undefined`. They align. No cast needed.

2. **Non-null assertion on `find()`** — `AI_STYLES.find(...)!` uses a non-null assertion. This is safe because `selectedStyle` is initialized to `'photorealistic'` which is always present in `AI_STYLES`. Same for `selectedSize` / `AI_SIZE_PRESETS`. TypeScript strict mode accepts this.

3. **`[class]` binding with ternary** — Angular 18 fully supports ternary in `[class]` binding. No special syntax or `NgClass` import needed for standalone components.

4. **`CommonModule`** — The current component does not import `CommonModule`. The new template uses `@for` and `@if` control flow (Angular 17+ built-in), so no extra imports are needed. `ReactiveFormsModule` stays in the `imports` array as-is.

5. **No barrel export needed** — The new `ai-styles.ts` file does not need to be registered anywhere else. The component imports it by relative path. No changes to any `index.ts` or module file.

---

## File Change Summary

| File | Action | Nature of change |
|---|---|---|
| `src/app/domain/constants/ai-styles.ts` | Create | New constants file with types, interfaces, and data arrays |
| `src/app/domain/models/asset.model.ts` | Modify | Add `presetStyle?: string` to `AiGeneratePayload` |
| `src/app/presentation/components/ai-modal/ai-modal.component.ts` | Modify | Remove `modelId`/`numImages` form controls; add two signals and two constant refs; rewrite `generate()` |
| `src/app/presentation/components/ai-modal/ai-modal.component.html` | Modify | Add style cards and size pills sections; widen modal to `max-w-2xl`; keep all other sections verbatim |
