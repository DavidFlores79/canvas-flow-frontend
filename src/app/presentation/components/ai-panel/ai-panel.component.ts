import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AiApiService } from '../../../data/services/ai-api.service';
import { EditorStore } from '../../../application/stores/editor.store';
import { Asset } from '../../../domain/models/asset.model';
import { Layer } from '../../../domain/models/layer.model';

@Component({
  selector: 'app-ai-panel',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './ai-panel.component.html',
})
export class AiPanelComponent {
  private readonly aiApi = inject(AiApiService);
  protected readonly editorStore = inject(EditorStore);
  private readonly fb = inject(FormBuilder);

  protected readonly isGenerating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly generatedAssets = signal<Asset[]>([]);

  protected readonly form = this.fb.group({
    prompt: ['', [Validators.required, Validators.minLength(3)]],
    modelId: ['ac614f96-1082-45bf-be9d-757f2d31c174', Validators.required],
    numImages: [1],
  });

  async generate(): Promise<void> {
    if (this.form.invalid || !this.editorStore.canEdit()) return;
    const project = this.editorStore.activeProject();
    if (!project) return;

    const { prompt, modelId, numImages } = this.form.getRawValue();
    this.isGenerating.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.aiApi.generate({
          prompt: prompt!,
          modelId: modelId!,
          workspaceId: project.workspaceId,
          numImages: numImages ?? 1,
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
    const layer: Layer = {
      id: crypto.randomUUID(),
      type: 'image',
      assetId: asset.id,
      properties: { x: 100, y: 100, width: 300, height: 300, rotation: 0, zIndex: 0 },
    };
    this.editorStore.addLayer(layer);
  }
}
