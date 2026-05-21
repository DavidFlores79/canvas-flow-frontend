import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AiApiService } from '../../../data/services/ai-api.service';
import { EditorStore } from '../../../application/stores/editor.store';
import { Asset } from '../../../domain/models/asset.model';
import { Layer } from '../../../domain/models/layer.model';
import {
  AI_STYLES,
  AI_SIZE_PRESETS,
  AiStyleId,
  AiSizePresetId,
} from '../../../domain/constants/ai-styles';

@Component({
  selector: 'app-ai-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './ai-modal.component.html',
})
export class AiModalComponent {
  private readonly aiApi = inject(AiApiService);
  protected readonly editorStore = inject(EditorStore);
  private readonly fb = inject(FormBuilder);

  @Output() readonly closed = new EventEmitter<void>();

  protected readonly isGenerating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly generatedAssets = signal<Asset[]>([]);

  protected readonly selectedStyle = signal<AiStyleId>('photorealistic');
  protected readonly selectedSize = signal<AiSizePresetId>('square');

  protected readonly styles = AI_STYLES;
  protected readonly sizePresets = AI_SIZE_PRESETS;

  protected readonly form = this.fb.group({
    prompt: ['', [Validators.required, Validators.minLength(3)]],
  });

  async generate(): Promise<void> {
    if (this.form.invalid || !this.editorStore.canEdit()) return;
    const project = this.editorStore.activeProject();
    if (!project) return;

    const { prompt } = this.form.getRawValue();
    const style = AI_STYLES.find((s) => s.id === this.selectedStyle())!;
    const size = AI_SIZE_PRESETS.find((s) => s.id === this.selectedSize())!;
    const finalPrompt = (style.promptPrefix ?? '') + prompt!;

    this.isGenerating.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.aiApi.generate({
          prompt: finalPrompt,
          modelId: style.modelId,
          presetStyle: style.presetStyle,
          workspaceId: project.workspaceId,
          width: size.width,
          height: size.height,
        }),
      );
      this.generatedAssets.set(result.assets);
    } catch {
      this.error.set('AI generation failed. Please try again.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  addToCanvas(asset: Asset): void {
    if (!this.editorStore.canEdit()) return;
    const project = this.editorStore.activeProject();
    if (!project) return;
    const imageUrl = asset.url ?? '';

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const MAX = 400;
      const ratio = img.naturalWidth / img.naturalHeight;
      let width: number;
      let height: number;
      if (img.naturalWidth >= img.naturalHeight) {
        width = Math.min(img.naturalWidth, MAX);
        height = width / ratio;
      } else {
        height = Math.min(img.naturalHeight, MAX);
        width = height * ratio;
      }
      const nextZIndex = this.editorStore
        .layers()
        .reduce((max, layer) => Math.max(max, layer.properties.zIndex), -1) + 1;
      const layer: Layer = {
        id: crypto.randomUUID(),
        type: 'image',
        assetId: asset.id,
        content: imageUrl,
        properties: {
          x: project.width / 2 - width / 2,
          y: project.height / 2 - height / 2,
          width,
          height,
          rotation: 0,
          zIndex: nextZIndex,
        },
      };
      this.editorStore.addLayer(layer);
      this.editorStore.setActiveTool('select');
      this.editorStore.selectLayers([layer.id]);
    };
    img.onerror = () => {
      const nextZIndex = this.editorStore
        .layers()
        .reduce((max, layer) => Math.max(max, layer.properties.zIndex), -1) + 1;
      const layer: Layer = {
        id: crypto.randomUUID(),
        type: 'image',
        assetId: asset.id,
        content: imageUrl,
        properties: {
          x: project.width / 2 - 150,
          y: project.height / 2 - 150,
          width: 300,
          height: 300,
          rotation: 0,
          zIndex: nextZIndex,
        },
      };
      this.editorStore.addLayer(layer);
      this.editorStore.setActiveTool('select');
      this.editorStore.selectLayers([layer.id]);
    };
    img.src = imageUrl;
  }

  close(): void {
    this.closed.emit();
  }
}
