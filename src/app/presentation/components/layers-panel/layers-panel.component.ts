import { Component, inject, signal, computed } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { EditorStore } from '../../../application/stores/editor.store';

@Component({
  selector: 'app-layers-panel',
  standalone: true,
  imports: [SlicePipe],
  templateUrl: './layers-panel.component.html',
})
export class LayersPanelComponent {
  protected readonly editorStore = inject(EditorStore);

  protected readonly sortedLayers = computed(() =>
    [...this.editorStore.layers()].sort((a, b) => b.properties.zIndex - a.properties.zIndex),
  );

  private dragFromIndex: number | null = null;
  protected dragOverIndex = signal<number | null>(null);

  selectLayer(id: string): void {
    this.editorStore.selectLayers([id]);
  }

  removeLayer(id: string): void {
    this.editorStore.removeLayer(id);
  }

  onDragStart(event: DragEvent, visualIndex: number): void {
    this.dragFromIndex = visualIndex;
    event.dataTransfer?.setData('text/plain', String(visualIndex));
  }

  onDragOver(event: DragEvent, visualIndex: number): void {
    event.preventDefault();
    this.dragOverIndex.set(visualIndex);
  }

  onDragLeave(): void {
    this.dragOverIndex.set(null);
  }

  onDrop(event: DragEvent, toVisualIndex: number): void {
    event.preventDefault();
    this.dragOverIndex.set(null);
    if (this.dragFromIndex === null || this.dragFromIndex === toVisualIndex) return;

    const total = this.sortedLayers().length;
    // Visual list shows highest zIndex first; convert to ascending zIndex index
    const fromZIndex = total - 1 - this.dragFromIndex;
    const toZIndex = total - 1 - toVisualIndex;

    this.editorStore.reorderLayers(fromZIndex, toZIndex);
    this.dragFromIndex = null;
  }

  onDragEnd(): void {
    this.dragFromIndex = null;
    this.dragOverIndex.set(null);
  }
}
