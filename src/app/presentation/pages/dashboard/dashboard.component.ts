import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../application/stores/auth.store';
import { WorkspaceApiService } from '../../../data/services/workspace-api.service';
import { Workspace } from '../../../domain/models/workspace.model';
import { OrgSwitcherComponent } from '../../components/org-switcher/org-switcher.component';
import { WorkspaceCardComponent } from '../../components/workspace-card/workspace-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [OrgSwitcherComponent, WorkspaceCardComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly workspaceApi = inject(WorkspaceApiService);
  private readonly router = inject(Router);

  protected readonly workspaces = signal<Workspace[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const orgId = this.authStore.activeOrganizationId();
      if (orgId) void this.loadWorkspaces(orgId);
    });
  }

  private async loadWorkspaces(orgId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.workspaces.set([]);
    try {
      const ws = await firstValueFrom(this.workspaceApi.listByOrganization(orgId));
      this.workspaces.set(ws);
    } catch {
      this.error.set('Failed to load workspaces');
    } finally {
      this.isLoading.set(false);
    }
  }

  onWorkspaceSelected(workspace: Workspace): void {
    void this.router.navigate(['/editor', workspace.id]);
  }

  signOut(): void {
    this.authStore.signOut();
  }
}
