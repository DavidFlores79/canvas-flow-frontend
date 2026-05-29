import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CropRect, Layer } from '../../domain/models/layer.model';
import { Project } from '../../domain/models/project.model';
import { WorkspaceRole } from '../../domain/models/user.model';
import { LayerApiService } from '../../data/services/layer-api.service';

function layersKey(layers: Layer[]): string {
  return JSON.stringify(layers.map(l => ({ ...l })));
}

export type ToolType = 'select' | 'text' | 'shape' | 'crop';
export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'line' | 'dashed-line' | 'star' | 'arrow';

@Injectable({ providedIn: 'root' })
export class EditorStore {
  private readonly layerApi = inject(LayerApiService);

  readonly activeProject = signal<Project | null>(null);
  readonly layers = signal<Layer[]>([]);
  readonly selectedLayerIds = signal<string[]>([]);
  readonly workspaceRole = signal<WorkspaceRole | null>(null);
  readonly activeTool = signal<ToolType>('select');
  readonly activeShapeKind = signal<ShapeKind>('rect');
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly viewportWidth = signal(0);
  readonly viewportHeight = signal(0);
  readonly canvasBackground = signal<string | null>(null);

  readonly canEdit = computed(() => {
    const role = this.workspaceRole();
    return role === 'owner' || role === 'editor';
  });

  readonly selectedLayers = computed(() => {
    const ids = new Set(this.selectedLayerIds());
    return this.layers().filter(l => ids.has(l.id));
  });

  private historyStack: Layer[][] = [];
  private historyIndex = -1;
  private savedLayerIds = new Set<string>();
  private readonly savedSnapshot = signal<string>('[]');

  readonly isDirty = computed(() => layersKey(this.layers()) !== this.savedSnapshot());

  setProject(project: Project): void {
    this.activeProject.set(project);
  }

  setLayers(layers: Layer[]): void {
    this.layers.set(layers);
    this.historyStack = [layers];
    this.historyIndex = 0;
    this.savedLayerIds = new Set(layers.map(l => l.id));
    this.savedSnapshot.set(layersKey(layers));
  }

  async loadLayers(): Promise<void> {
    const project = this.activeProject();
    if (!project) return;
    this.isLoading.set(true);
    try {
      const layers = await firstValueFrom(this.layerApi.list(project.id));
      this.setLayers(layers);
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveLayers(): Promise<void> {
    const project = this.activeProject();
    if (!project) return;
    this.isSaving.set(true);
    try {
      const current = this.layers();
      const currentIds = new Set(current.map(l => l.id));

      // Delete layers removed since last save
      const deletedIds = [...this.savedLayerIds].filter(id => !currentIds.has(id));
      await Promise.all(deletedIds.map(id => firstValueFrom(this.layerApi.remove(project.id, id))));

      // Create or update each current layer; replace local UUID with server ObjectId after create
      const saved = await Promise.all(
        current.map(layer =>
          this.savedLayerIds.has(layer.id)
            ? firstValueFrom(this.layerApi.update(project.id, layer.id, layer))
            : firstValueFrom(this.layerApi.create(project.id, layer)),
        ),
      );

      // Patch in-memory layers: swap local UUIDs for the ObjectIds the backend assigned
      const idMap = new Map<string, string>();
      current.forEach((layer, i) => {
        const serverId = saved[i]?.id;
        if (serverId && serverId !== layer.id) idMap.set(layer.id, serverId);
      });
      if (idMap.size > 0) {
        this.layers.update(ls => ls.map(l => idMap.has(l.id) ? { ...l, id: idMap.get(l.id)! } : l));
        this.selectedLayerIds.update(ids => ids.map(id => idMap.get(id) ?? id));
      }

      const finalLayers = this.layers();
      this.savedLayerIds = new Set(finalLayers.map(l => l.id));
      this.savedSnapshot.set(layersKey(finalLayers));
    } finally {
      this.isSaving.set(false);
    }
  }

  setWorkspaceRole(role: WorkspaceRole): void {
    this.workspaceRole.set(role);
  }

  setViewportSize(width: number, height: number): void {
    this.viewportWidth.set(width);
    this.viewportHeight.set(height);
  }

  setCanvasBackground(color: string | null): void {
    this.canvasBackground.set(color);
  }

  setActiveTool(tool: ToolType): void {
    this.activeTool.set(tool);
  }

  setActiveShapeKind(kind: ShapeKind): void {
    this.activeShapeKind.set(kind);
  }

  selectLayers(ids: string[]): void {
    this.selectedLayerIds.set(ids);
  }

  addLayer(layer: Layer): void {
    const next = [...this.layers(), layer];
    this.commitHistory(next);
  }

  reorderLayers(fromIndex: number, toIndex: number): void {
    const ordered = [...this.layers()].sort((a, b) => a.properties.zIndex - b.properties.zIndex);
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    const reassigned = ordered.map((l, i) => ({ ...l, properties: { ...l.properties, zIndex: i } }));
    this.commitHistory(reassigned);
  }

  updateProjectSize(width: number, height: number): void {
    const project = this.activeProject();
    if (!project) return;

    const scaleX = width / project.width;
    const scaleY = height / project.height;

    const scaledLayers = this.layers()
      .map(l => ({
        ...l,
        properties: {
          ...l.properties,
          x: l.properties.x * scaleX,
          y: l.properties.y * scaleY,
          width: l.properties.width * scaleX,
          height: l.properties.height * scaleY,
        },
      }))
      .filter(l => {
        const { x, y, width: w, height: h } = l.properties;
        return x + w > 0 && y + h > 0 && x < width && y < height;
      });

    const removedIds = new Set(this.layers().map(l => l.id));
    scaledLayers.forEach(l => removedIds.delete(l.id));
    this.selectedLayerIds.update(ids => ids.filter(id => !removedIds.has(id)));

    this.activeProject.set({ ...project, width, height });
    this.commitHistory(scaledLayers);
  }

  fitProjectToViewport(): void {
    const project = this.activeProject();
    if (!project) return;
    const fittedWidth = Math.max(320, Math.floor(this.viewportWidth() - 24));
    const fittedHeight = Math.max(240, Math.floor(this.viewportHeight() - 24));
    this.updateProjectSize(fittedWidth, fittedHeight);
  }

  updateLayer(id: string, partial: Partial<Layer>): void {
    const next = this.layers().map(l => (l.id === id ? { ...l, ...partial } : l));
    this.commitHistory(next);
  }

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

  updateShapeStyle(id: string, patch: { fillColor?: string; strokeColor?: string; strokeWidth?: number }): void {
    const next = this.layers().map(l => {
      if (l.id !== id) return l;
      return { ...l, properties: { ...l.properties, ...patch } };
    });
    this.commitHistory(next);
  }

  duplicateLayer(id: string): void {
    const original = this.layers().find(l => l.id === id);
    if (!original) return;
    const maxZ = Math.max(0, ...this.layers().map(l => l.properties.zIndex));
    const clone: Layer = {
      ...original,
      id: crypto.randomUUID(),
      properties: {
        ...original.properties,
        x: original.properties.x + 10,
        y: original.properties.y + 10,
        zIndex: maxZ + 1,
      },
    };
    this.commitHistory([...this.layers(), clone]);
    this.selectedLayerIds.set([clone.id]);
  }

  applyCrop(layerId: string, cropRect: CropRect): void {
    const layer = this.layers().find(l => l.id === layerId);
    if (!layer) return;
    const next = this.layers().map(l =>
      l.id === layerId ? { ...l, properties: { ...l.properties, cropRect } } : l
    );
    this.commitHistory(next);
    this.setActiveTool('select');
  }

  clearCrop(layerId: string): void {
    const layer = this.layers().find(l => l.id === layerId);
    if (!layer) return;
    const { cropRect: _c, ...rest } = layer.properties;
    const next = this.layers().map(l =>
      l.id === layerId ? { ...l, properties: rest } : l
    );
    this.commitHistory(next);
  }

  removeLayer(id: string): void {
    const next = this.layers().filter(l => l.id !== id);
    this.commitHistory(next);
    this.selectedLayerIds.update(prev => prev.filter(i => i !== id));
  }

  undo(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.layers.set(this.historyStack[this.historyIndex]);
    }
  }

  redo(): void {
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyIndex++;
      this.layers.set(this.historyStack[this.historyIndex]);
    }
  }

  private commitHistory(next: Layer[]): void {
    this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    this.historyStack.push(next);
    this.historyIndex = this.historyStack.length - 1;
    this.layers.set(next);
  }
}
