import { Component, computed, effect, inject, signal } from '@angular/core';
import { EditorStore } from '../../../application/stores/editor.store';
import { ImageTransformPanelComponent } from '../image-transform-panel/image-transform-panel.component';

@Component({
  selector: 'app-inspector',
  standalone: true,
  imports: [ImageTransformPanelComponent],
  templateUrl: './inspector.component.html',
})
export class InspectorComponent {
  protected readonly round = Math.round;
  protected readonly editorStore = inject(EditorStore);
  protected readonly canvasWidth = signal(1200);
  protected readonly canvasHeight = signal(800);
  protected readonly pendingConfirm = signal(false);

  protected readonly layersOutsideCount = computed(() => {
    const newW = Math.max(320, Math.floor(this.canvasWidth()));
    const newH = Math.max(240, Math.floor(this.canvasHeight()));
    const project = this.editorStore.activeProject();
    if (!project) return 0;
    const scaleX = newW / project.width;
    const scaleY = newH / project.height;
    return this.editorStore.layers().filter(l => {
      const x = l.properties.x * scaleX;
      const y = l.properties.y * scaleY;
      const w = l.properties.width * scaleX;
      const h = l.properties.height * scaleY;
      return x + w <= 0 || y + h <= 0 || x >= newW || y >= newH;
    }).length;
  });

  constructor() {
    effect(() => {
      const project = this.editorStore.activeProject();
      if (!project) return;
      this.canvasWidth.set(project.width);
      this.canvasHeight.set(project.height);
      this.pendingConfirm.set(false);
    });
  }

  onWidthInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.canvasWidth.set(value);
    this.pendingConfirm.set(false);
  }

  onHeightInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.canvasHeight.set(value);
    this.pendingConfirm.set(false);
  }

  applyCanvasSize(): void {
    if (this.layersOutsideCount() > 0 && !this.pendingConfirm()) {
      this.pendingConfirm.set(true);
      return;
    }
    const width = Math.max(320, Math.floor(this.canvasWidth()));
    const height = Math.max(240, Math.floor(this.canvasHeight()));
    this.editorStore.updateProjectSize(width, height);
    this.pendingConfirm.set(false);
  }

  cancelApply(): void {
    this.pendingConfirm.set(false);
  }
}
