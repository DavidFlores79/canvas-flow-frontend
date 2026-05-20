# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server at http://localhost:4200
npm run build      # production build → dist/
npm test           # unit tests (Jasmine + Karma)
```

> **Package manager:** the project uses `yarn` as the canonical package manager (see `yarn.lock`). Use `yarn` for installing dependencies and running scripts, not `npm`.

## Architecture

Clean Architecture with four layers under `src/app/`:

| Folder | Layer | Responsibility |
|---|---|---|
| `domain/` | Domain | Interfaces only: `Layer`, `Project`, `Asset`, `User`, `Organization`, `Workspace` |
| `application/` | Application | Signals-based stores (`EditorStore`, `AuthStore`), guards, interceptors |
| `data/` | Data/Infrastructure | HTTP services (`*-api.service.ts`) — implement repositories via Angular `HttpClient` |
| `presentation/` | Presentation | Standalone components (`pages/` and `components/`) + Tailwind CSS |

### Key domain model: `Layer`

Every canvas element is a `Layer` (`domain/models/layer.model.ts`). `type` is `'text' | 'image' | 'shape'`. `properties.zIndex` controls render order. `content` holds image URL or text string. `assetId` links to uploaded assets.

### EditorStore (`application/stores/editor.store.ts`)

Central state for the editor, built with Angular Signals:
- `layers` signal drives all canvas renders
- `activeTool` (`'select' | 'text' | 'shape'`) controls mouse:down behaviour in the canvas
- `canEdit` computed from `workspaceRole` — gates all interactivity
- `historyStack` / `historyIndex` implement undo/redo; every mutation must call `commitHistory()`

### CanvasComponent (`presentation/components/canvas/canvas.component.ts`)

Wraps Fabric.js. Key behaviours:
- `effect()` on `editorStore.layers()` triggers `renderLayers()` — full canvas clear + re-add
- Image layers are added asynchronously (native `Image` onload); text and shape layers are synchronous
- `mouse:down` on empty canvas creates a new layer via `editorStore.addLayer()` then switches tool back to `'select'`
- `applyObjectInteractivity()` sets `selectable/evented` based on `canEdit` — call this on every new Fabric object
- `moveObjectToZIndex()` positions objects to match `layer.properties.zIndex`

### State management rule

No NgRx. Use Angular Signals (`signal`, `computed`, `effect`) everywhere. The only stores are `EditorStore` and `AuthStore`.

### Auth & multi-tenancy

JWT carries `sub`, `organizationId`, `orgRole`. `AuthStore` stores `currentUser`, `activeOrganization`, `orgRole`. Org switching calls `POST /auth/switch-organization` and reloads context. `AuthInterceptor` attaches `Bearer` tokens to all HTTP requests.

### File uploads

All uploads go through `POST /assets/upload` (multipart, fields: `file` + `workspaceId`). Never use Cloudinary Upload Widget or direct Cloudinary SDK — API credentials are server-side only.

### AI generation

`POST /ai/generate` is synchronous with up to 60 s server-side polling. Show a loading state for the full 60 s window.

## Workflow commands (slash commands)

| Command | Purpose |
|---|---|
| `/explore-plan <feature>` | Plan + architecture before writing code |
| `/start-working-on-branch-new <branch>` | Load session context and begin implementation |
| `/run-tests [scope]` | Run unit / coverage / e2e tests |
| `/update-feedback <pr-number>` | Iterate on PR review feedback |
| `/analyze_bug <description>` | Root-cause analysis |

Session context files live in `.claude/sessions/`. Agent definitions live in `.claude/agents/`.

## Branch strategy

- Feature branches from `develop`: `feat/`, `fix/`, `refactor/`, `chore/`
- PRs target `develop`; require 1 reviewer
- Current active branch: `feat/media-platform-frontend-core`
