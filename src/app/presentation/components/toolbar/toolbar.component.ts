import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { EditorStore, ToolType } from '../../../application/stores/editor.store';

export type ExportFormat = 'png' | 'jpeg' | 'svg';

interface Tool {
  key: ToolType;
  label: string;
}

@Component({
  selector: 'app-toolbar',
  standalone: true,
  templateUrl: './toolbar.component.html',
})
export class ToolbarComponent {
  protected readonly editorStore = inject(EditorStore);

  @Output() readonly exportRequested = new EventEmitter<ExportFormat>();

  protected readonly tools: Tool[] = [
    { key: 'select', label: 'Select' },
    { key: 'text', label: 'Text' },
    { key: 'shape', label: 'Shape' },
  ];

  protected showExportMenu = false;
  protected readonly hasSelection = computed(() => this.editorStore.selectedLayers().length > 0);
  protected readonly selectionCount = computed(() => this.editorStore.selectedLayers().length);

  selectTool(tool: ToolType): void {
    this.editorStore.setActiveTool(tool);
  }

  undo(): void {
    this.editorStore.undo();
  }

  redo(): void {
    this.editorStore.redo();
  }

  save(): void {
    void this.editorStore.saveLayers();
  }

  export(format: ExportFormat): void {
    this.showExportMenu = false;
    this.exportRequested.emit(format);
  }
}
