import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Asset } from '../../../domain/models/asset.model';
import { AssetApiService } from '../../../data/services/asset-api.service';
import { EditorStore } from '../../../application/stores/editor.store';
import { Layer } from '../../../domain/models/layer.model';

@Component({
  selector: 'app-assets-panel',
  standalone: true,
  templateUrl: './assets-panel.component.html',
})
export class AssetsPanelComponent implements OnInit {
  private readonly assetApi = inject(AssetApiService);
  protected readonly editorStore = inject(EditorStore);

  protected readonly assets = signal<Asset[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const project = this.editorStore.activeProject();
    if (!project) return;
    this.isLoading.set(true);
    try {
      const list = await firstValueFrom(this.assetApi.listByWorkspace(project.workspaceId));
      this.assets.set(list);
    } catch {
      this.error.set('Failed to load assets');
    } finally {
      this.isLoading.set(false);
    }
  }

  addToCanvas(asset: Asset): void {
    if (!this.editorStore.canEdit()) return;
    const project = this.editorStore.activeProject();
    if (!project) return;

    const assetRecord = asset as Asset & { _id?: string; secure_url?: string };
    const assetIdentifier = asset.id ?? assetRecord._id ?? asset.cloudinaryPublicId;
    const imageUrl = asset.url ?? assetRecord.secure_url ?? '';

    const defaultWidth = 200;
    const defaultHeight = 200;

    const layer: Layer = {
      id: crypto.randomUUID(),
      type: 'image',
      assetId: assetIdentifier,
      content: imageUrl,
      // Add in the project center so users can see it immediately.
      properties: {
        x: project.width / 2,
        y: project.height / 2,
        width: defaultWidth,
        height: defaultHeight,
        rotation: 0,
        zIndex: 0,
      },
    };
    this.editorStore.addLayer(layer);
    this.editorStore.setActiveTool('select');
    this.editorStore.selectLayers([layer.id]);
  }

  async uploadFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const project = this.editorStore.activeProject();
    if (!file || !project) return;

    this.isLoading.set(true);
    try {
      const asset = await firstValueFrom(this.assetApi.upload(file, project.workspaceId));
      this.assets.update(prev => [...prev, asset]);
    } catch {
      this.error.set('Upload failed');
    } finally {
      this.isLoading.set(false);
      input.value = '';
    }
  }
}
