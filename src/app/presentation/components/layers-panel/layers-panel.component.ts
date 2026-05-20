import { Component, inject } from '@angular/core';
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

  selectLayer(id: string): void {
    this.editorStore.selectLayers([id]);
  }

  removeLayer(id: string): void {
    this.editorStore.removeLayer(id);
  }
}
