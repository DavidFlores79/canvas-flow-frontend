import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EditorStore } from '../../../application/stores/editor.store';
import { AssetApiService } from '../../../data/services/asset-api.service';
import { TransformPayload } from '../../../domain/models/asset.model';

type FormatOption = 'original' | 'jpg' | 'png' | 'webp' | 'avif';
type CropOption = 'none' | 'fill' | 'crop' | 'scale' | 'fit' | 'thumb';

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
  protected readonly crop = signal<CropOption>('none');
  protected readonly widthInput = signal(0);
  protected readonly heightInput = signal(0);

  protected readonly isApplying = signal(false);
  protected readonly successMsg = signal('');
  protected readonly errorMsg = signal('');

  reset(): void {
    this.removeBackground.set(false);
    this.brightness.set(0);
    this.contrast.set(0);
    this.blurUi.set(0);
    this.grayscale.set(false);
    this.format.set('original');
    this.crop.set('none');
    this.widthInput.set(0);
    this.heightInput.set(0);
    this.successMsg.set('');
    this.errorMsg.set('');
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
    if (this.crop() !== 'none') payload.crop = this.crop() as TransformPayload['crop'];
    if (this.widthInput() > 0) payload.width = this.widthInput();
    if (this.heightInput() > 0) payload.height = this.heightInput();

    this.isApplying.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    try {
      const newAsset = await firstValueFrom(this.assetApi.transform(l.assetId, payload));
      this.editorStore.updateLayer(l.id, { content: newAsset.url });
      this.successMsg.set('Transform applied.');
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch {
      this.errorMsg.set('Transform failed. Please try again.');
    } finally {
      this.isApplying.set(false);
    }
  }

  onRangeInput(setter: (v: number) => void, event: Event): void {
    setter(Number((event.target as HTMLInputElement).value));
  }

  onNumberInput(setter: (v: number) => void, event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    setter(Number.isFinite(v) ? v : 0);
  }
}
