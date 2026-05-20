import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { EditorStore, ShapeKind, ToolType } from '../../../application/stores/editor.store';

export type ExportFormat = 'png' | 'jpeg' | 'svg';

interface Tool {
  key: ToolType;
  label: string;
}

interface ShapeOption {
  kind: ShapeKind;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-toolbar',
  standalone: true,
  templateUrl: './toolbar.component.html',
})
export class ToolbarComponent {
  protected readonly editorStore = inject(EditorStore);

  @Output() readonly exportRequested = new EventEmitter<ExportFormat>();
  @Output() readonly canvasBackgroundChanged = new EventEmitter<string | null>();
  @Output() readonly aiGenerateClicked = new EventEmitter<void>();

  protected readonly tools: Tool[] = [
    { key: 'select', label: 'Select' },
    { key: 'text', label: 'Text' },
  ];

  protected readonly shapeOptions: ShapeOption[] = [
    { kind: 'rect',        label: 'Rectangle',  icon: '▭' },
    { kind: 'ellipse',     label: 'Ellipse',     icon: '⬭' },
    { kind: 'triangle',    label: 'Triangle',    icon: '△' },
    { kind: 'line',        label: 'Line',        icon: '—' },
    { kind: 'dashed-line', label: 'Dashed line', icon: '╌' },
    { kind: 'star',        label: 'Star',        icon: '★' },
    { kind: 'arrow',       label: 'Arrow',       icon: '→' },
  ];

  protected showExportMenu = false;
  protected showShapeMenu = false;
  protected readonly hasSelection = computed(() => this.editorStore.selectedLayers().length > 0);
  protected readonly selectionCount = computed(() => this.editorStore.selectedLayers().length);

  protected get activeShapeOption(): ShapeOption {
    return this.shapeOptions.find(s => s.kind === this.editorStore.activeShapeKind()) ?? this.shapeOptions[0];
  }

  selectTool(tool: ToolType): void {
    this.editorStore.setActiveTool(tool);
  }

  selectShape(kind: ShapeKind): void {
    this.editorStore.setActiveShapeKind(kind);
    this.editorStore.setActiveTool('shape');
    this.showShapeMenu = false;
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

  onCanvasBackgroundChange(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.canvasBackgroundChanged.emit(color);
  }

  setTransparentBackground(): void {
    this.canvasBackgroundChanged.emit(null);
  }
}
