# Angular 20 Frontend Implementation Plan: Media Editing Platform

## 1. Clean Architecture Layers

**UI Layer (Presentation)**
- `editor.page.ts`: Smart container orchestration
- `canvas.component.ts`: Pure presentation wrapping Fabric.js
- `toolbar.component.ts`, `inspector.component.ts`, `layers-panel.component.ts`

**Domain Layer (Core)**
- `project.model.ts`, `layer.model.ts`, `asset.model.ts`
- `project.repository.ts`, `asset.repository.ts`

**Business Layer (Application)**
- `editor.use-case.ts`: Manages history stack and coordinates state
- `state/editor.store.ts`: Angular Signals-based state management

**Data Layer (Infrastructure)**
- `project-api.service.ts`: Implements `ProjectRepository` via HTTP
- `cloudinary-api.service.ts`

## 2. Component Architecture

**Canvas Component (Fabric.js Integration)**
- Must handle `ngAfterViewInit` to instantiate `new fabric.Canvas('editor-canvas')`.
- Listens to Angular Signals from `editor.store.ts` using `effect()`.
- Emits events on object modified, scaled, rotated.

**State Management (Signals)**
```typescript
import { signal, computed, effect, Injectable } from '@angular/core';
import { Project, Layer } from '../domain/models';

@Injectable({ providedIn: 'root' })
export class EditorStore {
  readonly activeProject = signal<Project | null>(null);
  readonly layers = signal<Layer[]>([]);
  readonly selectedLayerIds = signal<string[]>([]);
  
  // History Stack
  private historyStack: any[] = [];
  private historyIndex = -1;

  updateLayer(id: string, props: Partial<Layer>) {
    this.layers.update(layers => 
      layers.map(l => l.id === id ? { ...l, ...props } : l)
    );
    this.pushToHistory();
  }

  private pushToHistory() {
    // Implement history logic for undo/redo
  }
}
```

## 3. TypeScript Interfaces & DTOs
```typescript
// feature/domain/models/layer.model.ts
export interface Layer {
  readonly id: string;
  readonly type: 'text' | 'image' | 'shape';
  readonly properties: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotation: number;
    readonly zIndex: number;
  };
  readonly assetId?: string;
}
```

## 4. Feature Roadmap
1. Setup basic UI layout with Tailwind CSS.
2. Integrate Fabric.js and define the Signal store.
3. Build the canvas interaction loop (select, move, scale).
4. Implement the Inspector panel to bind to the selected object's properties.
5. Integrate Cloudinary API for asset uploads.
6. Integrate Leonardo AI for generative workflows.

## 5. Testing Strategy
- Unit tests using Jasmine/Karma.
- Mock the API services for use-case testing.
- Target coverage >80%.
