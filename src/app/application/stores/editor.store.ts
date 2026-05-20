import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Layer } from '../../domain/models/layer.model';
import { Project } from '../../domain/models/project.model';
import { WorkspaceRole } from '../../domain/models/user.model';
import { LayerApiService } from '../../data/services/layer-api.service';

function layersKey(layers: Layer[]): string {
  return JSON.stringify(layers.map(l => ({ ...l })));
}

export type ToolType = 'select' | 'text' | 'shape';

@Injectable({ providedIn: 'root' })
export class EditorStore {
  private readonly layerApi = inject(LayerApiService);

  readonly activeProject = signal<Project | null>(null);
  readonly layers = signal<Layer[]>([]);
  readonly selectedLayerIds = signal<string[]>([]);
  readonly workspaceRole = signal<WorkspaceRole | null>(null);
  readonly activeTool = signal<ToolType>('select');
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly viewportWidth = signal(0);
  readonly viewportHeight = signal(0);

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

      // Create or update each current layer
      await Promise.all(
        current.map(layer =>
          this.savedLayerIds.has(layer.id)
            ? firstValueFrom(this.layerApi.update(project.id, layer.id, layer))
            : firstValueFrom(this.layerApi.create(project.id, layer)),
        ),
      );

      this.savedLayerIds = new Set(current.map(l => l.id));
      this.savedSnapshot.set(layersKey(current));
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

  setActiveTool(tool: ToolType): void {
    this.activeTool.set(tool);
  }

  selectLayers(ids: string[]): void {
    this.selectedLayerIds.set(ids);
  }

  addLayer(layer: Layer): void {
    const next = [...this.layers(), layer];
    this.commitHistory(next);
  }

  updateProjectSize(width: number, height: number): void {
    const project = this.activeProject();
    if (!project) return;
    this.activeProject.set({ ...project, width, height });
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
