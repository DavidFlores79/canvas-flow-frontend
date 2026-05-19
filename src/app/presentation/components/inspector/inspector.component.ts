import { Component, effect, inject, signal } from '@angular/core';
import { EditorStore } from '../../../application/stores/editor.store';

@Component({
  selector: 'app-inspector',
  standalone: true,
  templateUrl: './inspector.component.html',
})
export class InspectorComponent {
  protected readonly editorStore = inject(EditorStore);
  protected readonly canvasWidth = signal(1200);
  protected readonly canvasHeight = signal(800);

  constructor() {
    effect(() => {
      const project = this.editorStore.activeProject();
      if (!project) return;
      this.canvasWidth.set(project.width);
      this.canvasHeight.set(project.height);
    });
  }

  onWidthInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.canvasWidth.set(value);
  }

  onHeightInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.canvasHeight.set(value);
  }

  applyCanvasSize(): void {
    const width = Math.max(320, Math.floor(this.canvasWidth()));
    const height = Math.max(240, Math.floor(this.canvasHeight()));
    this.editorStore.updateProjectSize(width, height);
  }

  fitCanvasToViewport(): void {
    this.editorStore.fitProjectToViewport();
  }
}
