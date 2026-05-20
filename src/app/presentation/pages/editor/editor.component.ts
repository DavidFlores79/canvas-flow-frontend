import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../application/stores/auth.store';
import { EditorStore } from '../../../application/stores/editor.store';
import { WorkspaceApiService } from '../../../data/services/workspace-api.service';
import { ProjectApiService } from '../../../data/services/project-api.service';
import { Project } from '../../../domain/models/project.model';
import { FormsModule } from '@angular/forms';
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
    FormsModule,
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
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
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
  protected readonly isCreatingProject = signal(false);
  protected readonly newProjectName = signal('');
  protected readonly showNewProjectInput = signal(false);
  private workspaceId = signal<string | null>(null);

  private readonly ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  protected readonly zoom = signal(1);
  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  protected readonly tabs: TabItem[] = [
    { key: 'layers', label: 'Layers' },
    { key: 'assets', label: 'Assets' },
    { key: 'ai', label: 'AI' },
  ];

  @ViewChild('canvasViewport') canvasViewport?: ElementRef<HTMLElement>;
  @ViewChild('canvasRef') canvasRef!: CanvasComponent;
  private resizeObserver?: ResizeObserver;

  async ngOnInit(): Promise<void> {
    const workspaceId = this.route.snapshot.paramMap.get('workspaceId');
    if (!workspaceId) {
      void this.router.navigate(['/dashboard']);
      return;
    }
    this.workspaceId.set(workspaceId);

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
    void this.editorStore.loadLayers();
    // Defer until the viewport has been measured by ResizeObserver/AfterViewInit
    setTimeout(() => this.fitPage());
  }

  switchProjectById(projectId: string): void {
    const project = this.projects().find(p => p.id === projectId);
    if (project) this.loadProject(project);
  }

  async createProject(): Promise<void> {
    const name = this.newProjectName().trim();
    const wsId = this.workspaceId();
    if (!name || !wsId) return;
    this.isCreatingProject.set(true);
    try {
      const project = await firstValueFrom(
        this.projectApi.create({ name, workspaceId: wsId, width: 1200, height: 800 }),
      );
      this.projects.update(list => [...list, project]);
      this.loadProject(project);
      this.newProjectName.set('');
      this.showNewProjectInput.set(false);
    } finally {
      this.isCreatingProject.set(false);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    const list = this.projects();
    if (list.length <= 1) return;
    const project = list.find(p => p.id === projectId);
    const confirmed = window.confirm(`Delete "${project?.name ?? 'this project'}"? This cannot be undone.`);
    if (!confirmed) return;
    await firstValueFrom(this.projectApi.delete(projectId));
    const remaining = list.filter(p => p.id !== projectId);
    this.projects.set(remaining);
    if (this.editorStore.activeProject()?.id === projectId) {
      this.loadProject(remaining[0]);
    }
  }

  setTab(tab: SideTab): void {
    this.activeTab.set(tab);
  }

  ngAfterViewInit(): void {
    const viewportEl = this.canvasViewport?.nativeElement;
    if (!viewportEl) return;

    const updateViewport = (): void => {
      const styles = getComputedStyle(viewportEl);
      const horizontalPadding =
        parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');
      const verticalPadding =
        parseFloat(styles.paddingTop || '0') + parseFloat(styles.paddingBottom || '0');

      const usableWidth = Math.max(0, viewportEl.clientWidth - horizontalPadding);
      const usableHeight = Math.max(0, viewportEl.clientHeight - verticalPadding);
      this.editorStore.setViewportSize(usableWidth, usableHeight);
    };

    updateViewport();
    this.resizeObserver = new ResizeObserver(() => updateViewport());
    this.resizeObserver.observe(viewportEl);
  }

  zoomIn(): void {
    const next = this.ZOOM_STEPS.find(s => s > this.zoom());
    if (next) this.zoom.set(next);
  }

  zoomOut(): void {
    const prev = [...this.ZOOM_STEPS].reverse().find(s => s < this.zoom());
    if (prev) this.zoom.set(prev);
  }

  zoomReset(): void {
    this.zoom.set(1);
  }

  fitPage(): void {
    const vp = this.canvasViewport?.nativeElement;
    const project = this.editorStore.activeProject();
    if (!vp || !project) return;
    const pad = 64;
    const scaleX = (vp.clientWidth - pad) / project.width;
    const scaleY = (vp.clientHeight - pad) / project.height;
    this.zoom.set(Math.min(scaleX, scaleY, 3));
  }

  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent): void {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
