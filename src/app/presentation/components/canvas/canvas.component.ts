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
  private _isRendering = false;
  protected readonly editorStore = inject(EditorStore);

  constructor() {
    // Re-render whenever layers signal changes (handles add, remove, undo, redo)
    effect(() => {
      const layers = this.editorStore.layers();
      if (this.canvas) {
        this.renderLayers(layers);
      }
    });

    effect(() => {
      const canEdit = this.editorStore.canEdit();
      if (!this.canvas) return;
      this.canvas.selection = canEdit;
      this.canvas.forEachObject((obj) => {
        this.applyObjectInteractivity(obj, canEdit);
      });
      this.canvas.requestRenderAll();
    });
  }

  ngAfterViewInit(): void {
    this.canvas = new fabric.Canvas(this.canvasEl.nativeElement, {
      width: this.width,
      height: this.height,
      selection: this.editorStore.canEdit(),
    });

    this.canvas.on('selection:created', (e) => {
      if (this._isRendering) return;
      const ids = (e.selected ?? [])
        .map((obj) => (obj as fabric.FabricObject & { layerId?: string }).layerId)
        .filter((id): id is string => typeof id === 'string');
      this.editorStore.selectLayers(ids);
    });

    this.canvas.on('selection:updated', (e) => {
      if (this._isRendering) return;
      const ids = (e.selected ?? [])
        .map((obj) => (obj as fabric.FabricObject & { layerId?: string }).layerId)
        .filter((id): id is string => typeof id === 'string');
      this.editorStore.selectLayers(ids);
    });

    this.canvas.on('selection:cleared', () => {
      if (this._isRendering) return;
      this.editorStore.selectLayers([]);
    });

    this.canvas.on('object:modified', (e) => {
      if (this._isRendering) return;
      const obj = e.target as fabric.FabricObject & { layerId?: string };
      this.saveLayerFromObject(obj, true);
    });

    this.canvas.on('text:editing:exited', (e) => {
      if (this._isRendering) return;
      const obj = (e.target ?? this.canvas.getActiveObject()) as
        | (fabric.Textbox & { layerId?: string })
        | undefined;
      this.saveLayerFromObject(obj, true);
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
    const selectedIds = this.editorStore.selectedLayerIds();
    const canEdit = this.editorStore.canEdit();
    this._isRendering = true;
    this.canvas.clear();
    try {
      for (const layer of layers) {
      if (layer.type === 'image' && layer.assetId) {
        const imageUrl = layer.content;
        if (imageUrl) {
          const imgEl = new Image();
          imgEl.onload = () => {
            try {
              const imageObj = new fabric.FabricImage(imgEl, {
                left: layer.properties.x,
                top: layer.properties.y,
                angle: layer.properties.rotation,
              });
              this.applyObjectInteractivity(imageObj, this.editorStore.canEdit());
              imageObj.scaleToWidth(layer.properties.width);
              imageObj.scaleToHeight(layer.properties.height);
              (imageObj as fabric.FabricImage & { layerId: string }).layerId = layer.id;
              this.canvas.add(imageObj);
              if (selectedIds.includes(layer.id)) {
                this.canvas.setActiveObject(imageObj);
              }
              this.canvas.renderAll();
            } catch {
              this.addImageFallback(layer, selectedIds.includes(layer.id));
            }
          };
          imgEl.onerror = () => {
            this.addImageFallback(layer, selectedIds.includes(layer.id));
          };
          imgEl.src = imageUrl;
        } else {
          this.addImageFallback(layer, selectedIds.includes(layer.id));
        }
      } else if (layer.type === 'text') {
        const text = new fabric.Textbox(layer.content ?? 'Text', {
          left: layer.properties.x,
          top: layer.properties.y,
          width: layer.properties.width,
          angle: layer.properties.rotation,
          editable: canEdit,
          lockScalingY: true,
        });
        this.applyObjectInteractivity(text, canEdit);
        text.set({ lockScalingY: true });
        (text as fabric.Textbox & { layerId: string }).layerId = layer.id;
        this.canvas.add(text);
      } else {
        const rect = new fabric.Rect({
          left: layer.properties.x,
          top: layer.properties.y,
          width: layer.properties.width,
          height: layer.properties.height,
          angle: layer.properties.rotation,
          fill: '#dbeafe',
          stroke: '#60a5fa',
          strokeWidth: 1,
        });
        this.applyObjectInteractivity(rect, canEdit);
        (rect as fabric.Rect & { layerId: string }).layerId = layer.id;
        this.canvas.add(rect);
      }
    }
    // Restore selection after re-render
    if (selectedIds.length > 0) {
      const toSelect = this.canvas.getObjects().filter(
        (obj) => selectedIds.includes((obj as fabric.FabricObject & { layerId?: string }).layerId ?? '')
      );
      if (toSelect.length === 1) {
        this.canvas.setActiveObject(toSelect[0]);
      } else if (toSelect.length > 1) {
        const selection = new fabric.ActiveSelection(toSelect, { canvas: this.canvas });
        this.canvas.setActiveObject(selection);
      }
    }
      this.canvas.renderAll();
    } finally {
      this._isRendering = false;
    }
  }

  private saveLayerFromObject(
    obj: (fabric.FabricObject & { layerId?: string }) | undefined,
    includeContent: boolean,
  ): void {
    const layerId = (obj as (fabric.FabricObject & { layerId?: string }) | undefined)?.layerId;
    if (!obj || !layerId || this._isRendering) return;

    let width = obj.getScaledWidth();
    let height = obj.getScaledHeight();

    if (obj instanceof fabric.Rect || obj instanceof fabric.FabricImage) {
      const nextWidth = (obj.width ?? 0) * (obj.scaleX ?? 1);
      const nextHeight = (obj.height ?? 0) * (obj.scaleY ?? 1);
      obj.set({ width: nextWidth, height: nextHeight, scaleX: 1, scaleY: 1 });
      obj.setCoords();
      width = nextWidth;
      height = nextHeight;
    }

    if (obj instanceof fabric.Textbox) {
      const nextWidth = (obj.width ?? 0) * (obj.scaleX ?? 1);
      obj.set({ width: nextWidth, scaleX: 1, scaleY: 1 });
      obj.initDimensions();
      obj.setCoords();
      width = nextWidth;
      height = obj.getScaledHeight();
    }

    const patch = {
      properties: {
        x: obj.left ?? 0,
        y: obj.top ?? 0,
        width,
        height,
        rotation: obj.angle ?? 0,
        zIndex: this.canvas.getObjects().indexOf(obj),
      },
      ...(includeContent && (obj instanceof fabric.Textbox || obj instanceof fabric.IText)
        ? { content: obj.text ?? '' }
        : {}),
    } as Partial<Layer>;

    this.editorStore.updateLayer(layerId, patch);
  }

  private addImageFallback(layer: Layer, shouldActivate: boolean): void {
    const canEdit = this.editorStore.canEdit();
    const fallback = new fabric.Rect({
      left: layer.properties.x,
      top: layer.properties.y,
      width: layer.properties.width,
      height: layer.properties.height,
      angle: layer.properties.rotation,
      fill: '#e2e8f0',
      stroke: '#94a3b8',
      strokeWidth: 1,
    });
    this.applyObjectInteractivity(fallback, canEdit);
    (fallback as fabric.Rect & { layerId: string }).layerId = layer.id;
    this.canvas.add(fallback);
    if (shouldActivate) {
      this.canvas.setActiveObject(fallback);
    }
    this.canvas.renderAll();
  }

  private applyObjectInteractivity(obj: fabric.FabricObject, canEdit: boolean): void {
    obj.set({
      selectable: canEdit,
      evented: canEdit,
      hasControls: canEdit,
      lockMovementX: !canEdit,
      lockMovementY: !canEdit,
      lockScalingX: !canEdit,
      lockScalingY: !canEdit,
      lockRotation: !canEdit,
    });
    if (obj instanceof fabric.Textbox || obj instanceof fabric.IText) {
      obj.set({ editable: canEdit });
    }
  }

  ngOnDestroy(): void {
    this.canvas?.dispose();
  }
}
