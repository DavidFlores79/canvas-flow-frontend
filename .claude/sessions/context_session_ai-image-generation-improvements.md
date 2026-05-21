# Session: AI Image Generation Improvements

**Feature:** Style-based model selection (visual cards), aspect ratio presets, and backend `presetStyle` passthrough  
**Branch:** `feat/ai-image-generation-improvements`  
**Base:** `develop` → PR targets `develop`  
**Status:** Planning complete — ready to implement

---

## Context

The AI modal currently sends only `prompt`, a hardcoded `modelId`, and `numImages: 1` to the backend. Leonardo AI never receives `width`/`height` (they exist in the DTO but are never passed from the frontend), nor a `presetStyle` hint that dramatically improves output for certain model/style combinations. Users have no way to influence the visual style or output dimensions.

---

## Goals

1. **Style cards** — user picks a visual style; frontend resolves it to the correct `modelId` + optional `presetStyle`
2. **Size presets** — user picks a named aspect ratio; frontend sends the matching `width`/`height`
3. **`numImages` locked to 1** — keep in the payload type for future membership tiers, remove from UI
4. **Backend passthrough** — `presetStyle` forwarded through DTO → AiService → LeonardoService → Leonardo API

---

## Style → Model Mapping

| Style label | Leonardo model | modelId | presetStyle |
|---|---|---|---|
| Photorealistic | Phoenix 1.0 | `de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3` | — |
| Hyperrealistic | Lucid Origin | `7b592283-e8a7-4c5a-9ba6-d18c31f258b9` | — |
| Anime / Manga | Leonardo Anime XL | `e71a1c2f-4f80-4800-934f-2c68979d1cc6` | — |
| Comic / Cartoon | Phoenix 1.0 | `de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3` | `ILLUSTRATION` |
| Pixel Art | Lucid Origin | `7b592283-e8a7-4c5a-9ba6-d18c31f258b9` | — (prompt-guided) |

> Pixel Art style prepends `"pixel art, 8-bit, " ` to the prompt before sending.

---

## Size Presets

Default: **Square 1024 × 1024**

| Label | Width | Height | Use case |
|---|---|---|---|
| Square | 1024 | 1024 | General / social |
| Landscape 16:9 | 1344 | 768 | YouTube / banners |
| Portrait 9:16 | 768 | 1344 | Stories / Reels |
| Landscape 4:3 | 1024 | 768 | Presentations |
| Portrait 3:4 | 768 | 1024 | Print / posters |

---

## Team

- **Frontend:** `angular-frontend-developer` — ai-modal redesign, domain constants, payload interface
- **Backend:** `nestjs-backend-architect` — presetStyle DTO, LeonardoService passthrough, test updates

---

## Frontend Changes (Angular)

### New file: `src/app/domain/constants/ai-styles.ts`
- Exports `AI_STYLES` constant array: each entry has `id`, `label`, `description`, `icon` (emoji/unicode), `modelId`, `presetStyle?`, `promptPrefix?`
- Exports `AI_SIZE_PRESETS` constant array: each entry has `id`, `label`, `width`, `height`
- Exports types `AiStyleId` and `AiSizePresetId`

### Modified: `src/app/domain/models/asset.model.ts`
- Add `presetStyle?: string` to `AiGeneratePayload`

### Modified: `src/app/presentation/components/ai-modal/ai-modal.component.ts`
- Remove `modelId` and `numImages` from the ReactiveForm group
- Add signals: `selectedStyle = signal<AiStyleId>('photorealistic')` (default)
- Add signal: `selectedSize = signal<AiSizePresetId>('square')` (default)
- `generate()` resolves selected style → `modelId` + `presetStyle`, selected size → `width`/`height`, applies `promptPrefix` if needed
- Locks `numImages: 1` hardcoded in payload (no UI)
- Modal widens to `max-w-2xl`

### Modified: `src/app/presentation/components/ai-modal/ai-modal.component.html`
- Add style card grid (5 cards): `role="radiogroup"` container, each card is a `<button role="radio" [attr.aria-checked]="selectedStyle() === style.id">`
- Add size preset pills row (5 pills): same aria pattern
- Keep prompt textarea
- Remove hidden model/numImages controls
- Layout order: style cards → size pills → prompt → generate button → results

---

## Backend Changes (NestJS) — small, you can apply these yourself

### 1. `src/ai/dto/AiGeneratePayloadDto.ts`
Add an optional `presetStyle` field using a typed enum:

```typescript
export enum LeonardoPresetStyle {
  ANIME = 'ANIME',
  BOKEH = 'BOKEH',
  CINEMATIC = 'CINEMATIC',
  CREATIVE = 'CREATIVE',
  DYNAMIC = 'DYNAMIC',
  ENVIRONMENT = 'ENVIRONMENT',
  FASHION = 'FASHION',
  FILM = 'FILM',
  FOOD = 'FOOD',
  GENERAL = 'GENERAL',
  HDR = 'HDR',
  ILLUSTRATION = 'ILLUSTRATION',
  LEONARDO = 'LEONARDO',
  LONG_EXPOSURE = 'LONG_EXPOSURE',
  MACRO = 'MACRO',
  MINIMALISTIC = 'MINIMALISTIC',
  MONOCHROME = 'MONOCHROME',
  MOODY = 'MOODY',
  NONE = 'NONE',
  NEUTRAL = 'NEUTRAL',
  PHOTOGRAPHY = 'PHOTOGRAPHY',
  PORTRAIT = 'PORTRAIT',
  PRO = 'PRO',
  RETRO = 'RETRO',
  SKETCH_BW = 'SKETCH_BW',
  SKETCH_COLOR = 'SKETCH_COLOR',
  STOCK_PHOTO = 'STOCK_PHOTO',
  VIBRANT = 'VIBRANT',
}

// In AiGeneratePayloadDto:
@ApiPropertyOptional({ enum: LeonardoPresetStyle, description: 'Leonardo preset style hint' })
@IsOptional()
@IsEnum(LeonardoPresetStyle)
presetStyle?: LeonardoPresetStyle;
```

> Move the enum to `src/leonardo/enums/LeonardoPresetStyle.ts` so it stays near the Leonardo module — then import it in the DTO.

### 2. `src/leonardo/service/LeonardoService.ts`
Extend `LeonardoCreateGenerationOptions`:
```typescript
export interface LeonardoCreateGenerationOptions {
  width?: number;
  height?: number;
  numImages?: number;
  presetStyle?: string;   // add this
}
```

In `createGeneration()`, add to the body builder:
```typescript
if (options.presetStyle !== undefined) body.presetStyle = options.presetStyle;
```

### 3. `src/ai/service/AiService.ts`
Pass `presetStyle` into the options object:
```typescript
await this.leonardoService.createGeneration(
  dto.prompt,
  dto.modelId,
  { width: dto.width, height: dto.height, numImages: dto.numImages, presetStyle: dto.presetStyle },
);
```

### 4. Tests
- `LeonardoService.spec.ts`: add one test asserting `presetStyle` appears in body when set; confirm existing test passes when absent
- `AiService.spec.ts`: update mock expectations to include `presetStyle` in options where relevant

### No migrations needed — no DB schema changes.

---

## Architectural Decisions (from agent advice)

| Decision | Choice | Reason |
|---|---|---|
| Style mapping location | `domain/constants/ai-styles.ts` | Business knowledge, not UI or infra — belongs in domain |
| Style/size selection state | Angular Signals | UI selection state, not user text input; signals + computed are idiomatic |
| Card selection accessibility | `role="radio"` buttons with `aria-checked` | Full Tailwind control, no hidden input gymnastics |
| `presetStyle` in domain payload | Yes (`presetStyle?: string`) | It's an API contract field, not a Leonardo-specific detail |
| Modal width | `max-w-2xl` | 5 cards + 5 pills + textarea fit without scroll |
| Backend `presetStyle` typing | Enum in `LeonardoPresetStyle.ts` | Compile-time safety, Swagger auto-documents, rejects typos early |
| `presetStyle` in options object | Add to `LeonardoCreateGenerationOptions` | Consistent with width/height/numImages pattern, easy to extend |

---

## Implementation Order

1. **Backend first** (you apply manually in the NestJS project):
   - Create `src/leonardo/enums/LeonardoPresetStyle.ts`
   - Update `AiGeneratePayloadDto`
   - Update `LeonardoCreateGenerationOptions` + `createGeneration()` body
   - Update `AiService.generate()` call
   - Update affected tests

2. **Frontend** (I implement via `angular-frontend-developer` agent):
   - Create `src/app/domain/constants/ai-styles.ts`
   - Update `AiGeneratePayload` in `asset.model.ts`
   - Rebuild `ai-modal.component.ts` + `ai-modal.component.html`

---

## Files Touched

### Frontend (Angular)
| File | Action |
|---|---|
| `src/app/domain/constants/ai-styles.ts` | **Create** |
| `src/app/domain/models/asset.model.ts` | **Modify** — add `presetStyle?` |
| `src/app/presentation/components/ai-modal/ai-modal.component.ts` | **Modify** |
| `src/app/presentation/components/ai-modal/ai-modal.component.html` | **Modify** |

### Backend (NestJS) — apply manually
| File | Action |
|---|---|
| `src/leonardo/enums/LeonardoPresetStyle.ts` | **Create** |
| `src/ai/dto/AiGeneratePayloadDto.ts` | **Modify** — add `presetStyle?` |
| `src/leonardo/service/LeonardoService.ts` | **Modify** — options + body |
| `src/ai/service/AiService.ts` | **Modify** — pass presetStyle |
| `src/leonardo/service/LeonardoService.spec.ts` | **Modify** — add test case |
| `src/ai/service/AiService.spec.ts` | **Modify** — update mock expectations |
