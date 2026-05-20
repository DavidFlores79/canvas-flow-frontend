import { Component, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EditorStore } from '../../../application/stores/editor.store';
import { AssetApiService } from '../../../data/services/asset-api.service';
import { TransformPayload } from '../../../domain/models/asset.model';
import { LayerTransforms } from '../../../domain/models/layer.model';

type FormatOption = 'original' | 'jpg' | 'png' | 'webp' | 'avif';

interface ImageMeta {
  naturalWidth: number;
  naturalHeight: number;
  format: string;
}

@Component({
  selector: 'app-image-transform-panel',
  standalone: true,
  templateUrl: './image-transform-panel.component.html',
})
export class ImageTransformPanelComponent {
  private readonly assetApi = inject(AssetApiService);
  protected readonly editorStore = inject(EditorStore);

  protected readonly layer = computed(() => {
    const layers = this.editorStore.selectedLayers();
    return layers.length === 1 && layers[0].type === 'image' ? layers[0] : null;
  });

  protected readonly removeBackground = signal(false);
  protected readonly brightness = signal(0);
  protected readonly contrast = signal(0);
  protected readonly blurUi = signal(0);
  protected readonly grayscale = signal(false);
  protected readonly format = signal<FormatOption>('original');
  protected readonly widthInput = signal(0);
  protected readonly heightInput = signal(0);

  protected readonly isApplying = signal(false);
  protected readonly successMsg = signal('');
  protected readonly errorMsg = signal('');
  protected readonly imageMeta = signal<ImageMeta | null>(null);
  protected readonly transformedUrl = signal<string | null>(null);

  private lastSyncedLayerId: string | null = null;

  constructor() {
    effect(() => {
      const l = this.layer();
      if (!l || l.id === this.lastSyncedLayerId) return;
      this.lastSyncedLayerId = l.id;
      const t = l.properties.transforms;
      this.removeBackground.set(t?.removeBackground ?? false);
      this.brightness.set(t?.brightness ?? 0);
      this.contrast.set(t?.contrast ?? 0);
      this.blurUi.set(t?.blur ?? 0);
      this.grayscale.set(t?.grayscale ?? false);
      this.format.set(t?.format ?? 'original');
      this.widthInput.set(t?.width ?? 0);
      this.heightInput.set(t?.height ?? 0);
      this.successMsg.set('');
      this.errorMsg.set('');
      this.transformedUrl.set(null);
      this.imageMeta.set(null);
      if (l.content) this.loadImageMeta(l.content);
    });
  }

  private loadImageMeta(url: string): void {
    const img = new Image();
    img.onload = () => {
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
      const formatMap: Record<string, string> = { jpg: 'JPG', jpeg: 'JPG', png: 'PNG', webp: 'WebP', avif: 'AVIF', gif: 'GIF' };
      this.imageMeta.set({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        format: (formatMap[ext] ?? ext.toUpperCase()) || 'Unknown',
      });
    };
    img.src = url;
  }

  reset(): void {
    const l = this.layer();
    this.removeBackground.set(false);
    this.brightness.set(0);
    this.contrast.set(0);
    this.blurUi.set(0);
    this.grayscale.set(false);
    this.format.set('original');
    this.widthInput.set(0);
    this.heightInput.set(0);
    this.successMsg.set('');
    this.errorMsg.set('');
    this.transformedUrl.set(null);
    if (l) {
      const { transforms: _t, ...rest } = l.properties;
      this.editorStore.updateLayer(l.id, { properties: rest });
      if (l.content) this.loadImageMeta(l.content);
    }
  }

  async apply(): Promise<void> {
    const l = this.layer();
    if (!l?.assetId) return;

    const workspaceId = this.editorStore.activeProject()?.workspaceId ?? '';
    const payload: TransformPayload = { workspaceId };

    if (this.removeBackground()) payload.removeBackground = true;
    if (this.brightness() !== 0) payload.brightness = this.brightness();
    if (this.contrast() !== 0) payload.contrast = this.contrast();
    if (this.blurUi() > 0) payload.blur = this.blurUi() * 20;
    if (this.grayscale()) payload.grayscale = true;
    if (this.format() !== 'original') payload.format = this.format() as TransformPayload['format'];
    if (this.widthInput() > 0) payload.width = this.widthInput();
    if (this.heightInput() > 0) payload.height = this.heightInput();

    this.isApplying.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    try {
      const newAsset = await firstValueFrom(this.assetApi.transform(l.assetId, payload));

      const transforms: LayerTransforms = {};
      if (this.removeBackground()) transforms.removeBackground = true;
      if (this.brightness() !== 0) transforms.brightness = this.brightness();
      if (this.contrast() !== 0) transforms.contrast = this.contrast();
      if (this.blurUi() > 0) transforms.blur = this.blurUi();
      if (this.grayscale()) transforms.grayscale = true;
      if (this.format() !== 'original') transforms.format = this.format();
      if (this.widthInput() > 0) transforms.width = this.widthInput();
      if (this.heightInput() > 0) transforms.height = this.heightInput();

      this.editorStore.updateLayer(l.id, {
        content: newAsset.url,
        assetId: newAsset.id,
        properties: { ...l.properties, transforms },
      });

      this.transformedUrl.set(newAsset.url);
      this.loadImageMeta(newAsset.url);
      this.successMsg.set('Transform applied.');
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch {
      this.errorMsg.set('Transform failed. Please try again.');
    } finally {
      this.isApplying.set(false);
    }
  }

  downloadImage(): void {
    const url = this.transformedUrl() ?? this.layer()?.content;
    if (!url) return;
    const ext = url.split('?')[0].split('.').pop() ?? 'jpg';
    const a = document.createElement('a');
    a.href = url;
    a.download = `image.${ext}`;
    a.target = '_blank';
    a.click();
  }

  onRangeInput(setter: (v: number) => void, event: Event): void {
    setter(Number((event.target as HTMLInputElement).value));
  }

  onNumberInput(setter: (v: number) => void, event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    setter(Number.isFinite(v) ? v : 0);
  }

  onFormatChange(event: Event): void {
    this.format.set((event.target as HTMLSelectElement).value as ReturnType<typeof this.format>);
  }
}
