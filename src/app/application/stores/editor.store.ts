import { Injectable, computed, signal } from '@angular/core';
import { Layer } from '../../domain/models/layer.model';
import { Project } from '../../domain/models/project.model';
import { WorkspaceRole } from '../../domain/models/user.model';

export type ToolType = 'select' | 'text' | 'shape';

@Injectable({ providedIn: 'root' })
export class EditorStore {
  readonly activeProject = signal<Project | null>(null);
  readonly layers = signal<Layer[]>([]);
  readonly selectedLayerIds = signal<string[]>([]);
  readonly workspaceRole = signal<WorkspaceRole | null>(null);
  readonly activeTool = signal<ToolType>('select');
  readonly isLoading = signal(false);

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

  setProject(project: Project): void {
    this.activeProject.set(project);
  }

  setLayers(layers: Layer[]): void {
    this.layers.set(layers);
    this.historyStack = [layers];
    this.historyIndex = 0;
  }

  setWorkspaceRole(role: WorkspaceRole): void {
    this.workspaceRole.set(role);
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
    // Trim redo future
    this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    // Push new state
    this.historyStack.push(next);
    this.historyIndex = this.historyStack.length - 1;
    this.layers.set(next);
  }
}
