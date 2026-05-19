import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../application/stores/auth.store';
import { EditorStore } from '../../../application/stores/editor.store';
import { WorkspaceApiService } from '../../../data/services/workspace-api.service';
import { ProjectApiService } from '../../../data/services/project-api.service';
import { Project } from '../../../domain/models/project.model';
import { CanvasComponent } from '../../components/canvas/canvas.component';
import { ToolbarComponent } from '../../components/toolbar/toolbar.component';
import { InspectorComponent } from '../../components/inspector/inspector.component';
import { LayersPanelComponent } from '../../components/layers-panel/layers-panel.component';
import { AssetsPanelComponent } from '../../components/assets-panel/assets-panel.component';
import { AiPanelComponent } from '../../components/ai-panel/ai-panel.component';
import { OrgSwitcherComponent } from '../../components/org-switcher/org-switcher.component';

export type SideTab = 'layers' | 'assets' | 'ai';

interface TabItem {
  key: SideTab;
  label: string;
}

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    CanvasComponent,
    ToolbarComponent,
    InspectorComponent,
    LayersPanelComponent,
    AssetsPanelComponent,
    AiPanelComponent,
    OrgSwitcherComponent,
  ],
  templateUrl: './editor.component.html',
})
export class EditorComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  protected readonly editorStore = inject(EditorStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspaceApi = inject(WorkspaceApiService);
  private readonly projectApi = inject(ProjectApiService);

  protected readonly projects = signal<Project[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly activeTab = signal<SideTab>('layers');

  protected readonly tabs: TabItem[] = [
    { key: 'layers', label: 'Layers' },
    { key: 'assets', label: 'Assets' },
    { key: 'ai', label: 'AI' },
  ];

  async ngOnInit(): Promise<void> {
    const workspaceId = this.route.snapshot.paramMap.get('workspaceId');
    if (!workspaceId) {
      void this.router.navigate(['/dashboard']);
      return;
    }

    try {
      const [workspace, projectList] = await Promise.all([
        firstValueFrom(this.workspaceApi.getById(workspaceId)),
        firstValueFrom(this.projectApi.listByWorkspace(workspaceId)),
      ]);
      this.projects.set(projectList);

      const orgRole = this.authStore.orgRole();
      const wsRole = orgRole === 'member' ? 'viewer' : orgRole === 'admin' ? 'editor' : 'owner';
      this.editorStore.setWorkspaceRole(wsRole as 'owner' | 'editor' | 'viewer');

      if (projectList.length > 0) {
        this.loadProject(projectList[0]);
      } else {
        const project = await firstValueFrom(
          this.projectApi.create({ name: 'Untitled', workspaceId: workspace.id, width: 1200, height: 800 }),
        );
        this.projects.set([project]);
        this.loadProject(project);
      }
    } catch {
      this.error.set('Failed to load editor');
    } finally {
      this.isLoading.set(false);
    }
  }

  private loadProject(project: Project): void {
    this.editorStore.setProject(project);
    this.editorStore.setLayers([]);
  }

  setTab(tab: SideTab): void {
    this.activeTab.set(tab);
  }
}
