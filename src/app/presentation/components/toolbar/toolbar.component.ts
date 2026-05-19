import { Component, inject } from '@angular/core';
import { EditorStore, ToolType } from '../../../application/stores/editor.store';

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

  protected readonly tools: Tool[] = [
    { key: 'select', label: 'Select' },
    { key: 'text', label: 'Text' },
    { key: 'shape', label: 'Shape' },
  ];

  selectTool(tool: ToolType): void {
    this.editorStore.setActiveTool(tool);
  }

  undo(): void {
    this.editorStore.undo();
  }

  redo(): void {
    this.editorStore.redo();
  }
}
