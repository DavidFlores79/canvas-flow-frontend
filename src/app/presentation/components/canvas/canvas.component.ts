import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import * as fabric from 'fabric';
import { EditorStore, ShapeKind } from '../../../application/stores/editor.store';
import { CropRect, Layer, LayerProperties } from '../../../domain/models/layer.model';

@Component({
  selector: 'app-canvas',
  standalone: true,
  template: `
    <div class="relative bg-white shadow-md" [style.width.px]="width" [style.height.px]="height">
      <canvas #canvasEl [width]="width" [height]="height"></canvas>

      @if (isCropMode()) {
        <!-- dark overlay outside crop rect -->
        <div class="absolute inset-0 pointer-events-none z-20" style="background:transparent">
          <!-- top -->
          <div class="absolute bg-black/40" [style.left.px]="cropBox().x" [style.top.px]="0" [style.width.px]="cropBox().w" [style.height.px]="cropBox().y"></div>
          <!-- bottom -->
          <div class="absolute bg-black/40" [style.left.px]="cropBox().x" [style.top.px]="cropBox().y + cropBox().h" [style.width.px]="cropBox().w" [style.height.px]="height - cropBox().y - cropBox().h"></div>
          <!-- left -->
          <div class="absolute bg-black/40" [style.left.px]="0" [style.top.px]="0" [style.width.px]="cropBox().x" [style.height.px]="height"></div>
          <!-- right -->
          <div class="absolute bg-black/40" [style.left.px]="cropBox().x + cropBox().w" [style.top.px]="0" [style.width.px]="width - cropBox().x - cropBox().w" [style.height.px]="height"></div>
        </div>

        <!-- crop rect border + handles -->
        <div class="absolute z-30 border-2 border-blue-500 box-border"
          [style.left.px]="cropBox().x"
          [style.top.px]="cropBox().y"
          [style.width.px]="cropBox().w"
          [style.height.px]="cropBox().h"
        >
          <!-- rule-of-thirds grid lines -->
          <div class="absolute inset-0 pointer-events-none">
            <div class="absolute border-white/40 border-l" style="left:33.33%;top:0;bottom:0"></div>
            <div class="absolute border-white/40 border-l" style="left:66.66%;top:0;bottom:0"></div>
            <div class="absolute border-white/40 border-t" style="top:33.33%;left:0;right:0"></div>
            <div class="absolute border-white/40 border-t" style="top:66.66%;left:0;right:0"></div>
          </div>

          <!-- corner handles -->
          <div class="absolute w-4 h-4 bg-white border-2 border-blue-600 cursor-nw-resize -left-2 -top-2" (mousedown)="onHandleMousedown($event,'nw')"></div>
          <div class="absolute w-4 h-4 bg-white border-2 border-blue-600 cursor-ne-resize -right-2 -top-2" (mousedown)="onHandleMousedown($event,'ne')"></div>
          <div class="absolute w-4 h-4 bg-white border-2 border-blue-600 cursor-sw-resize -left-2 -bottom-2" (mousedown)="onHandleMousedown($event,'sw')"></div>
          <div class="absolute w-4 h-4 bg-white border-2 border-blue-600 cursor-se-resize -right-2 -bottom-2" (mousedown)="onHandleMousedown($event,'se')"></div>

          <!-- edge handles -->
          <div class="absolute w-4 h-4 bg-white border-2 border-blue-600 cursor-n-resize -top-2" style="left:calc(50% - 8px)" (mousedown)="onHandleMousedown($event,'n')"></div>
          <div class="absolute w-4 h-4 bg-white border-2 border-blue-600 cursor-s-resize -bottom-2" style="left:calc(50% - 8px)" (mousedown)="onHandleMousedown($event,'s')"></div>
          <div class="absolute w-4 h-4 bg-white border-2 border-blue-600 cursor-w-resize -left-2" style="top:calc(50% - 8px)" (mousedown)="onHandleMousedown($event,'w')"></div>
          <div class="absolute w-4 h-4 bg-white border-2 border-blue-600 cursor-e-resize -right-2" style="top:calc(50% - 8px)" (mousedown)="onHandleMousedown($event,'e')"></div>

          <!-- drag the whole crop box -->
          <div class="absolute inset-0 cursor-move" (mousedown)="onHandleMousedown($event,'move')"></div>
        </div>

        <!-- action bar -->
        <div class="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2 z-50 bg-white/90 rounded-lg px-3 py-1.5 shadow border border-gray-200">
          <button class="px-3 py-1 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700" (click)="confirmCrop()">Apply Crop</button>
          <button class="px-3 py-1 text-sm font-medium bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50" (click)="cancelCrop()">Cancel</button>
        </div>
      }

      @if (contextMenu().visible) {
        <ul
          class="absolute z-50 bg-white border border-gray-200 rounded shadow-lg py-1 text-sm"
          [style.left.px]="contextMenu().x"
          [style.top.px]="contextMenu().y"
        >
          <li
            class="px-4 py-2 hover:bg-red-50 hover:text-red-600 cursor-pointer"
            (mousedown)="deleteSelectedLayers()"
          >Delete</li>
        </ul>
      }
    </div>
  `,
})
export class CanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() width = 1200;
  @Input() height = 800;
  @Output() readonly cropModeChanged = new EventEmitter<boolean>();

  @ViewChild('canvasEl', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  private canvas!: fabric.Canvas;
  private _isRendering = false;
  private _keydownHandler!: (e: KeyboardEvent) => void;
  protected readonly editorStore = inject(EditorStore);
  protected readonly contextMenu = signal<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });

  readonly isCropMode = signal(false);
  readonly cropBox = signal<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  private croppingLayerId: string | null = null;
  private _cropImageBounds: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };
  private _dragHandle: string | null = null;
  private _dragStart: { mx: number; my: number; box: { x: number; y: number; w: number; h: number } } | null = null;
  private _mousemoveHandler!: (e: MouseEvent) => void;
  private _mouseupHandler!: (e: MouseEvent) => void;

  constructor() {
    effect(() => {
      const tool = this.editorStore.activeTool();
      if (!this.canvas) return;
      untracked(() => {
        if (tool === 'crop') {
          if (this.isCropMode()) return;
          const selectedIds = this.editorStore.selectedLayerIds();
          if (selectedIds.length === 1) {
            const layer = this.editorStore.layers().find(l => l.id === selectedIds[0]);
            if (layer?.type === 'image') {
              this.enterCropMode(selectedIds[0]);
              return;
            }
          }
          this.editorStore.setActiveTool('select');
        } else if (this.isCropMode()) {
          this.exitCropMode();
        }
      });
    });

    // Re-render whenever layers signal changes (handles add, remove, undo, redo)
    effect(() => {
      const layers = this.editorStore.layers();
      if (this.canvas) {
        // Only re-render on layer mutations, not on selection signal updates.
        untracked(() => this.renderLayers(layers));
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

    effect(() => {
      const background = this.editorStore.canvasBackground();
      if (!this.canvas) return;
      this.canvas.backgroundColor = background || ''; // Ensure no null values
      this.canvas.requestRenderAll();
    });

    effect(() => {
      const ids = this.editorStore.selectedLayerIds();
      if (!this.canvas || this._isRendering) return;
      const objects = this.canvas.getObjects();
      const toSelect = objects.filter(
        (obj) => ids.includes((obj as fabric.FabricObject & { layerId?: string }).layerId ?? '')
      );
      this._isRendering = true;
      try {
        if (toSelect.length === 0) {
          this.canvas.discardActiveObject();
        } else if (toSelect.length === 1) {
          this.canvas.setActiveObject(toSelect[0]);
        } else {
          const selection = new fabric.ActiveSelection(toSelect, { canvas: this.canvas });
          this.canvas.setActiveObject(selection);
        }
        this.canvas.requestRenderAll();
      } finally {
        this._isRendering = false;
      }
    });
  }

  ngAfterViewInit(): void {
    this.canvas = new fabric.Canvas(this.canvasEl.nativeElement, {
      width: this.width,
      height: this.height,
      selection: this.editorStore.canEdit(),
    });

    this.canvas.backgroundColor = this.editorStore.canvasBackground() || ''; // Ensure no null values

    const syncSelection = () => {
      if (this._isRendering) return;
      const active = this.canvas.getActiveObject();
      const objects: fabric.FabricObject[] =
        active instanceof fabric.ActiveSelection ? active.getObjects() : active ? [active] : [];
      const ids = objects
        .map((obj) => (obj as fabric.FabricObject & { layerId?: string }).layerId)
        .filter((id): id is string => typeof id === 'string');
      this.editorStore.selectLayers(ids);
    };

    this.canvas.on('selection:created', syncSelection);
    this.canvas.on('selection:updated', syncSelection);

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
      if (tool === 'select' || tool === 'crop' || !this.editorStore.canEdit()) return;

      const point = e.scenePoint ?? this.canvas.getScenePoint(e.e);
      const nextZIndex = this.editorStore
        .layers()
        .reduce((max, layer) => Math.max(max, layer.properties.zIndex), -1) + 1;
      let layer: Layer;

      if (tool === 'text') {
        layer = {
          id: crypto.randomUUID(),
          type: 'text',
          content: 'Text',
          properties: {
            x: point.x,
            y: point.y,
            width: 200,
            height: 40,
            rotation: 0,
            zIndex: nextZIndex,
          },
        };
      } else {
        const kind = this.editorStore.activeShapeKind();
        const isLine = kind === 'line' || kind === 'dashed-line';
        layer = {
          id: crypto.randomUUID(),
          type: 'shape',
          properties: {
            x: point.x,
            y: point.y,
            width: isLine ? 150 : 150,
            height: isLine ? 0 : 150,
            rotation: 0,
            zIndex: nextZIndex,
            shapeKind: kind,
          },
        };
      }

      this.editorStore.addLayer(layer);
      this.editorStore.setActiveTool('select');
    });

    this.canvas.on('mouse:down', () => this.contextMenu.set({ visible: false, x: 0, y: 0 }));

    this.canvas.on('mouse:down:before', (e) => {
      if ((e.e as MouseEvent).button === 2) {
        const active = this.canvas.getActiveObject();
        if (!active || !this.editorStore.canEdit()) return;
        e.e.preventDefault();
        const rect = this.canvasEl.nativeElement.getBoundingClientRect();
        const me = e.e as MouseEvent;
        this.contextMenu.set({ visible: true, x: me.clientX - rect.left, y: me.clientY - rect.top });
      }
    });

    this._keydownHandler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'd') {
        const ids = this.editorStore.selectedLayerIds();
        if (ids.length === 1 && this.editorStore.canEdit()) {
          e.preventDefault();
          this.editorStore.duplicateLayer(ids[0]);
        }
        return;
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (this.isCropMode()) return;
      const active = this.canvas.getActiveObject();
      if (!active || !this.editorStore.canEdit()) return;
      if (active instanceof fabric.Textbox && active.isEditing) return;
      e.preventDefault();
      this.deleteSelectedLayers();
    };
    document.addEventListener('keydown', this._keydownHandler);

    // Initial render of any pre-loaded layers
    this.renderLayers(this.editorStore.layers());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.canvas) return;
    if (!changes['width'] && !changes['height']) return;

    this.canvas.setDimensions({ width: this.width, height: this.height });
    this.canvas.calcOffset();
    this.canvas.requestRenderAll();
  }

  renderLayers(layers: Layer[]): void {
    if (!this.canvas) return;
    const selectedIds = this.editorStore.selectedLayerIds();
    const canEdit = this.editorStore.canEdit();
    this._isRendering = true;
    this.canvas.clear();
    this.canvas.backgroundColor = this.editorStore.canvasBackground() || ''; // Ensure no null values
    try {
      const orderedLayers = [...layers].sort((a, b) => a.properties.zIndex - b.properties.zIndex);
      for (const layer of orderedLayers) {
      if (layer.type === 'image') {
        const imageUrl = layer.content;
        if (imageUrl) {
          const imgEl = new Image();
          imgEl.crossOrigin = 'anonymous';
          imgEl.onload = () => {
            try {
              const scaleX = layer.properties.width / (imgEl.naturalWidth || layer.properties.width);
              const scaleY = layer.properties.height / (imgEl.naturalHeight || layer.properties.height);
              const imageObj = new fabric.FabricImage(imgEl, {
                left: layer.properties.x,
                top: layer.properties.y,
                angle: layer.properties.rotation,
                scaleX,
                scaleY,
              });
              if (layer.properties.cropRect) {
                const cr = layer.properties.cropRect;
                // Image uses center origin; its top-left corner in canvas px is
                // (layer.x - scaledW/2, layer.y - scaledH/2). cropRect is stored
                // relative to that top-left, in natural px. clipPath with
                // absolutePositioned:true uses canvas coordinates.
                const cornerX = layer.properties.x - (imgEl.naturalWidth * scaleX) / 2;
                const cornerY = layer.properties.y - (imgEl.naturalHeight * scaleY) / 2;
                imageObj.clipPath = new fabric.Rect({
                  left: cornerX + cr.left * scaleX,
                  top: cornerY + cr.top * scaleY,
                  width: cr.width * scaleX,
                  height: cr.height * scaleY,
                  originX: 'left',
                  originY: 'top',
                  absolutePositioned: true,
                });
              }
              this.applyObjectInteractivity(imageObj, this.editorStore.canEdit());
              imageObj.setCoords();
              (imageObj as fabric.FabricImage & { layerId: string }).layerId = layer.id;
              this.canvas.add(imageObj);
              this.moveObjectToZIndex(imageObj, layer.properties.zIndex);
              if (selectedIds.includes(layer.id)) {
                this.canvas.setActiveObject(imageObj);
              }
              this.canvas.requestRenderAll();
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
          fontFamily: layer.properties.fontFamily ?? 'Arial',
          fontSize: layer.properties.fontSize ?? 24,
          fontWeight: layer.properties.fontWeight ?? 'normal',
          fontStyle: layer.properties.fontStyle ?? 'normal',
          underline: layer.properties.underline ?? false,
          fill: layer.properties.textColor ?? '#000000',
          textAlign: layer.properties.textAlign ?? 'left',
        });
        this.applyObjectInteractivity(text, canEdit);
        text.set({ lockScalingY: true });
        (text as fabric.Textbox & { layerId: string }).layerId = layer.id;
        this.canvas.add(text);
        this.moveObjectToZIndex(text, layer.properties.zIndex);
      } else {
        const shapeObj = this.createShapeObject(layer.properties);
        this.applyObjectInteractivity(shapeObj, canEdit);
        (shapeObj as fabric.FabricObject & { layerId: string }).layerId = layer.id;
        this.canvas.add(shapeObj);
        this.moveObjectToZIndex(shapeObj, layer.properties.zIndex);
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

  protected deleteSelectedLayers(): void {
    this.contextMenu.set({ visible: false, x: 0, y: 0 });
    const ids = this.editorStore.selectedLayerIds();
    // Remove Fabric.js objects from canvas
    this.canvas.getObjects().forEach(obj => {
      const layerId = (obj as fabric.FabricObject & { layerId?: string }).layerId;
      if (layerId && ids.includes(layerId)) {
        this.canvas.remove(obj);
      }
    });
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    // Remove from store
    ids.forEach(id => this.editorStore.removeLayer(id));
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

    const existingLayer = this.editorStore.layers().find(l => l.id === layerId);
    const existingProps = existingLayer?.properties ?? {};
    const textProps = (obj instanceof fabric.Textbox || obj instanceof fabric.IText)
      ? {
          fontFamily: (obj as fabric.Textbox).fontFamily ?? 'Arial',
          fontSize: (obj as fabric.Textbox).fontSize ?? 24,
          fontWeight: ((obj as fabric.Textbox).fontWeight as 'normal' | 'bold') ?? 'normal',
          fontStyle: ((obj as fabric.Textbox).fontStyle as 'normal' | 'italic') ?? 'normal',
          underline: (obj as fabric.Textbox).underline ?? false,
          textColor: (obj as fabric.Textbox).fill as string ?? '#000000',
          textAlign: ((obj as fabric.Textbox).textAlign as 'left' | 'center' | 'right') ?? 'left',
        }
      : {};
    const isShapeObj = obj instanceof fabric.Rect || obj instanceof fabric.Ellipse ||
      obj instanceof fabric.Triangle || obj instanceof fabric.Polygon ||
      obj instanceof fabric.Polyline || obj instanceof fabric.Path;
    const shapeProps = isShapeObj
      ? {
          fillColor: obj.fill as string ?? '#dbeafe',
          strokeColor: obj.stroke as string ?? '#60a5fa',
          strokeWidth: obj.strokeWidth ?? 1,
        }
      : {};
    const patch = {
      properties: {
        ...existingProps,
        x: obj.left ?? 0,
        y: obj.top ?? 0,
        width,
        height,
        rotation: obj.angle ?? 0,
        zIndex: existingLayer?.properties.zIndex ?? this.canvas.getObjects().indexOf(obj),
        ...textProps,
        ...shapeProps,
      },
      ...(includeContent && (obj instanceof fabric.Textbox || obj instanceof fabric.IText)
        ? { content: obj.text ?? '' }
        : {}),
    } as Partial<Layer>;

    this.editorStore.updateLayer(layerId, patch);
  }

  private createShapeObject(props: LayerProperties): fabric.FabricObject {
    const fill = props.fillColor ?? '#dbeafe';
    const stroke = props.strokeColor ?? '#60a5fa';
    const strokeWidth = props.strokeWidth ?? 1;
    const { x, y, width, height, rotation: angle } = props;
    const kind: ShapeKind = props.shapeKind ?? 'rect';

    switch (kind) {
      case 'ellipse':
        return new fabric.Ellipse({ left: x, top: y, rx: width / 2, ry: height / 2, angle, fill, stroke, strokeWidth });

      case 'triangle':
        return new fabric.Triangle({ left: x, top: y, width, height, angle, fill, stroke, strokeWidth });

      case 'line':
        return new fabric.Polyline([{ x: 0, y: 0 }, { x: width, y: 0 }], { left: x, top: y, angle, stroke, strokeWidth, fill: '' });

      case 'dashed-line':
        return new fabric.Polyline([{ x: 0, y: 0 }, { x: width, y: 0 }], { left: x, top: y, angle, stroke, strokeWidth, strokeDashArray: [8, 6], fill: '' });

      case 'star': {
        const cx = width / 2, cy = height / 2;
        const outerR = Math.min(width, height) / 2;
        const innerR = outerR * 0.45;
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = (Math.PI / 5) * i - Math.PI / 2;
          points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        return new fabric.Polygon(points, { left: x, top: y, angle, fill, stroke, strokeWidth });
      }

      case 'arrow': {
        const hw = height / 2;
        const headW = Math.min(hw, 20);
        const shaft = width - headW;
        const path = `M 0 ${hw} L ${shaft} ${hw} L ${shaft} ${hw - headW * 0.6} L ${width} ${hw} L ${shaft} ${hw + headW * 0.6} L ${shaft} ${hw} Z`;
        return new fabric.Path(path, { left: x, top: y, angle, fill, stroke, strokeWidth });
      }

      default:
        return new fabric.Rect({ left: x, top: y, width, height, angle, fill, stroke, strokeWidth });
    }
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
    this.moveObjectToZIndex(fallback, layer.properties.zIndex);
    if (shouldActivate) {
      this.canvas.setActiveObject(fallback);
    }
    this.canvas.requestRenderAll();
  }

  private moveObjectToZIndex(obj: fabric.FabricObject, zIndex: number): void {
    const targetIndex = Math.max(0, Math.floor(zIndex));
    const canvasWithMove = this.canvas as unknown as {
      moveObjectTo?: (object: fabric.FabricObject, index: number) => unknown;
    };
    canvasWithMove.moveObjectTo?.(obj, targetIndex);
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

  exportAs(format: 'png' | 'jpeg' | 'svg'): void {
    const project = this.editorStore.activeProject();
    const filename = (project?.name ?? 'canvas').replace(/\s+/g, '-').toLowerCase();

    const active = this.canvas.getActiveObject();
    const crop = active ? active.getBoundingRect() : null;

    if (format === 'svg') {
      const viewBox = crop
        ? { x: crop.left, y: crop.top, width: crop.width, height: crop.height }
        : undefined;
      const svg = this.canvas.toSVG({ viewBox } as Parameters<typeof this.canvas.toSVG>[0]);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      this.triggerDownload(URL.createObjectURL(blob), `${filename}.svg`);
      return;
    }

    const originalBackground = this.canvas.backgroundColor;
    if (format === 'jpeg') {
      this.canvas.backgroundColor = this.editorStore.canvasBackground() ?? '#ffffff';
      this.canvas.requestRenderAll();
    }

    const dataUrl = crop
      ? this.canvas.toDataURL({
          format,
          quality: 1,
          multiplier: 1,
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height,
        })
      : this.canvas.toDataURL({ format, quality: 1, multiplier: 1 });

    if (format === 'jpeg') {
      this.canvas.backgroundColor = originalBackground;
      this.canvas.requestRenderAll();
    }
    this.triggerDownload(dataUrl, `${filename}.${format}`);
  }

  private triggerDownload(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  private enterCropMode(layerId: string): void {
    if (this.isCropMode()) this.exitCropMode();

    const imageObj = this.canvas.getObjects().find(
      (o) => (o as fabric.FabricObject & { layerId?: string }).layerId === layerId
    ) as (fabric.FabricImage & { layerId?: string }) | undefined;

    if (!(imageObj instanceof fabric.FabricImage)) {
      this.editorStore.setActiveTool('select');
      return;
    }

    const layer = this.editorStore.layers().find(l => l.id === layerId);
    if (!layer) return;

    imageObj.set({ selectable: false, evented: false, hasControls: false });
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();

    // The image uses center origin, so imageObj.left/top is the CENTER.
    // getBoundingRect() gives the true top-left corner + size in canvas pixels.
    const bounds = imageObj.getBoundingRect();
    const ox = bounds.left;
    const oy = bounds.top;
    const imgW = bounds.width;
    const imgH = bounds.height;

    // naturalW/H needed for converting cropRect to/from natural px
    const naturalW = (imageObj.getElement() as HTMLImageElement).naturalWidth || imgW;
    const naturalH = (imageObj.getElement() as HTMLImageElement).naturalHeight || imgH;
    const scaleX = imgW / naturalW;
    const scaleY = imgH / naturalH;

    this._cropImageBounds = { x: ox, y: oy, w: imgW, h: imgH };

    let box: { x: number; y: number; w: number; h: number };
    if (layer.properties.cropRect) {
      box = {
        x: ox + layer.properties.cropRect.left * scaleX,
        y: oy + layer.properties.cropRect.top * scaleY,
        w: layer.properties.cropRect.width * scaleX,
        h: layer.properties.cropRect.height * scaleY,
      };
    } else {
      box = { x: ox, y: oy, w: imgW, h: imgH };
    }

    this.cropBox.set(box);
    this.croppingLayerId = layerId;

    this._mousemoveHandler = (e: MouseEvent) => this._onCropMouseMove(e);
    this._mouseupHandler = () => this._onCropMouseUp();
    document.addEventListener('mousemove', this._mousemoveHandler);
    document.addEventListener('mouseup', this._mouseupHandler);

    this.isCropMode.set(true);
    this.cropModeChanged.emit(true);
  }

  private exitCropMode(): void {
    document.removeEventListener('mousemove', this._mousemoveHandler);
    document.removeEventListener('mouseup', this._mouseupHandler);

    if (this.croppingLayerId) {
      const imageObj = this.canvas.getObjects().find(
        (o) => (o as fabric.FabricObject & { layerId?: string }).layerId === this.croppingLayerId
      );
      if (imageObj) this.applyObjectInteractivity(imageObj, this.editorStore.canEdit());
    }
    this.croppingLayerId = null;
    this._dragHandle = null;
    this._dragStart = null;
    this.isCropMode.set(false);
    this.cropModeChanged.emit(false);
    this.canvas.requestRenderAll();
  }

  onHandleMousedown(e: MouseEvent, handle: string): void {
    e.preventDefault();
    e.stopPropagation();
    this._dragHandle = handle;
    this._dragStart = { mx: e.clientX, my: e.clientY, box: { ...this.cropBox() } };
  }

  private _onCropMouseMove(e: MouseEvent): void {
    if (!this._dragHandle || !this._dragStart) return;
    // The canvas is rendered inside a CSS scale() transform (editor zoom).
    // Convert screen-pixel mouse deltas into native canvas pixels by dividing
    // by the actual on-screen scale factor of the canvas element.
    const rect = this.canvasEl.nativeElement.getBoundingClientRect();
    const scale = rect.width / (this.width || 1) || 1;
    const dx = (e.clientX - this._dragStart.mx) / scale;
    const dy = (e.clientY - this._dragStart.my) / scale;
    const s = this._dragStart.box;
    const ib = this._cropImageBounds;
    let { x, y, w, h } = s;
    const minSize = 20;

    switch (this._dragHandle) {
      case 'move':
        x = Math.max(ib.x, Math.min(ib.x + ib.w - w, s.x + dx));
        y = Math.max(ib.y, Math.min(ib.y + ib.h - h, s.y + dy));
        break;
      case 'nw':
        x = Math.max(ib.x, Math.min(s.x + s.w - minSize, s.x + dx));
        y = Math.max(ib.y, Math.min(s.y + s.h - minSize, s.y + dy));
        w = s.x + s.w - x;
        h = s.y + s.h - y;
        break;
      case 'ne':
        y = Math.max(ib.y, Math.min(s.y + s.h - minSize, s.y + dy));
        w = Math.max(minSize, Math.min(ib.x + ib.w - s.x, s.w + dx));
        h = s.y + s.h - y;
        break;
      case 'sw':
        x = Math.max(ib.x, Math.min(s.x + s.w - minSize, s.x + dx));
        w = s.x + s.w - x;
        h = Math.max(minSize, Math.min(ib.y + ib.h - s.y, s.h + dy));
        break;
      case 'se':
        w = Math.max(minSize, Math.min(ib.x + ib.w - s.x, s.w + dx));
        h = Math.max(minSize, Math.min(ib.y + ib.h - s.y, s.h + dy));
        break;
      case 'n':
        y = Math.max(ib.y, Math.min(s.y + s.h - minSize, s.y + dy));
        h = s.y + s.h - y;
        break;
      case 's':
        h = Math.max(minSize, Math.min(ib.y + ib.h - s.y, s.h + dy));
        break;
      case 'w':
        x = Math.max(ib.x, Math.min(s.x + s.w - minSize, s.x + dx));
        w = s.x + s.w - x;
        break;
      case 'e':
        w = Math.max(minSize, Math.min(ib.x + ib.w - s.x, s.w + dx));
        break;
    }
    this.cropBox.set({ x, y, w, h });
  }

  private _onCropMouseUp(): void {
    this._dragHandle = null;
    this._dragStart = null;
  }

  confirmCrop(): void {
    if (!this.croppingLayerId) return;

    const layer = this.editorStore.layers().find(l => l.id === this.croppingLayerId);
    const imageObj = this.canvas.getObjects().find(
      (o) => (o as fabric.FabricObject & { layerId?: string }).layerId === this.croppingLayerId
    ) as fabric.FabricImage | undefined;

    if (!layer || !(imageObj instanceof fabric.FabricImage)) return;

    const bounds = imageObj.getBoundingRect();
    const ox = bounds.left;
    const oy = bounds.top;
    const imgW = bounds.width;
    const imgH = bounds.height;
    const naturalW = (imageObj.getElement() as HTMLImageElement).naturalWidth || imgW;
    const naturalH = (imageObj.getElement() as HTMLImageElement).naturalHeight || imgH;
    const scaleX = imgW / naturalW;
    const scaleY = imgH / naturalH;
    const box = this.cropBox();

    const cropRect: CropRect = {
      left: Math.max(0, Math.min((box.x - ox) / scaleX, naturalW)),
      top: Math.max(0, Math.min((box.y - oy) / scaleY, naturalH)),
      width: Math.max(1, Math.min(box.w / scaleX, naturalW)),
      height: Math.max(1, Math.min(box.h / scaleY, naturalH)),
    };

    this.editorStore.applyCrop(this.croppingLayerId, cropRect);
  }

  cancelCrop(): void {
    this.exitCropMode();
    this.editorStore.setActiveTool('select');
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this._keydownHandler);
    this.canvas?.dispose();
  }
}
