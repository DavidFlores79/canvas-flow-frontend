import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import * as fabric from 'fabric';
import { EditorStore } from '../../../application/stores/editor.store';
import { Layer } from '../../../domain/models/layer.model';

@Component({
  selector: 'app-canvas',
  standalone: true,
  template: `
    <div class="relative bg-white shadow-md" [style.width.px]="width" [style.height.px]="height">
      <canvas #canvasEl [width]="width" [height]="height"></canvas>
    </div>
  `,
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() width = 1200;
  @Input() height = 800;

  @ViewChild('canvasEl', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  private canvas!: fabric.Canvas;
  protected readonly editorStore = inject(EditorStore);

  constructor() {
    // Re-render whenever layers signal changes (handles add, remove, undo, redo)
    effect(() => {
      const layers = this.editorStore.layers();
      if (this.canvas) {
        this.renderLayers(layers);
      }
    });
  }

  ngAfterViewInit(): void {
    this.canvas = new fabric.Canvas(this.canvasEl.nativeElement, {
      width: this.width,
      height: this.height,
      selection: this.editorStore.canEdit(),
    });

    this.canvas.on('selection:created', (e) => {
      const ids = (e.selected ?? [])
        .map((obj) => (obj as fabric.FabricObject & { layerId?: string }).layerId)
        .filter((id): id is string => typeof id === 'string');
      this.editorStore.selectLayers(ids);
    });

    this.canvas.on('selection:updated', (e) => {
      const ids = (e.selected ?? [])
        .map((obj) => (obj as fabric.FabricObject & { layerId?: string }).layerId)
        .filter((id): id is string => typeof id === 'string');
      this.editorStore.selectLayers(ids);
    });

    this.canvas.on('selection:cleared', () => {
      this.editorStore.selectLayers([]);
    });

    this.canvas.on('object:modified', (e) => {
      const obj = e.target as fabric.FabricObject & { layerId?: string };
      if (obj?.layerId) {
        this.editorStore.updateLayer(obj.layerId, {
          properties: {
            x: obj.left ?? 0,
            y: obj.top ?? 0,
            width: obj.width ?? 0,
            height: obj.height ?? 0,
            rotation: obj.angle ?? 0,
            zIndex: this.canvas.getObjects().indexOf(obj),
          },
        });
      }
    });

    // Create objects on canvas click based on active tool
    this.canvas.on('mouse:down', (e) => {
      const tool = this.editorStore.activeTool();
      if (tool === 'select' || !this.editorStore.canEdit()) return;
      if (e.target) return; // clicked on an existing object

      const point = e.scenePoint ?? this.canvas.getScenePoint(e.e);
      let layer: Layer;

      if (tool === 'text') {
        layer = {
          id: crypto.randomUUID(),
          type: 'text',
          content: 'Text',
          properties: { x: point.x, y: point.y, width: 200, height: 40, rotation: 0, zIndex: 0 },
        };
      } else {
        layer = {
          id: crypto.randomUUID(),
          type: 'shape',
          properties: { x: point.x, y: point.y, width: 150, height: 150, rotation: 0, zIndex: 0 },
        };
      }

      this.editorStore.addLayer(layer);
      this.editorStore.setActiveTool('select');
    });

    // Initial render of any pre-loaded layers
    this.renderLayers(this.editorStore.layers());
  }

  renderLayers(layers: Layer[]): void {
    if (!this.canvas) return;
    this.canvas.clear();
    for (const layer of layers) {
      if (layer.type === 'image' && layer.assetId) {
        // Placeholder rect for image layers
        const rect = new fabric.Rect({
          left: layer.properties.x,
          top: layer.properties.y,
          width: layer.properties.width,
          height: layer.properties.height,
          angle: layer.properties.rotation,
          fill: '#e2e8f0',
          stroke: '#94a3b8',
          strokeWidth: 1,
        });
        (rect as fabric.Rect & { layerId: string }).layerId = layer.id;
        this.canvas.add(rect);
      } else if (layer.type === 'text') {
        const text = new fabric.IText(layer.content ?? 'Text', {
          left: layer.properties.x,
          top: layer.properties.y,
          angle: layer.properties.rotation,
        });
        (text as fabric.IText & { layerId: string }).layerId = layer.id;
        this.canvas.add(text);
      } else {
        const rect = new fabric.Rect({
          left: layer.properties.x,
          top: layer.properties.y,
          width: layer.properties.width,
          height: layer.properties.height,
          angle: layer.properties.rotation,
          fill: '#dbeafe',
        });
        (rect as fabric.Rect & { layerId: string }).layerId = layer.id;
        this.canvas.add(rect);
      }
    }
    this.canvas.renderAll();
  }

  ngOnDestroy(): void {
    this.canvas?.dispose();
  }
}
