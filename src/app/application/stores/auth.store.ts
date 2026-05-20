import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { OrgRole, OrgSummary, User, UserSession } from '../../domain/models/user.model';
import { AuthApiService, RefreshTokenResponse, SignInPayload } from '../../data/services/auth-api.service';

const TOKEN_KEY = 'cf_access_token';
const REFRESH_KEY = 'cf_refresh_token';
const ORG_ID_KEY = 'cf_org_id';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly currentUser = signal<User | null>(null);
  readonly activeOrganizationId = signal<string | null>(null);
  readonly orgRole = signal<OrgRole | null>(null);
  readonly organizations = signal<OrgSummary[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly hasMultipleOrgs = computed(() => this.organizations().length > 1);

  private refreshPromise: Promise<boolean> | null = null;

  constructor(
    private readonly authApi: AuthApiService,
    private readonly router: Router,
  ) {
    this.restoreFromStorage();
  }

  async signIn(payload: SignInPayload): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await firstValueFrom(this.authApi.signIn(payload));
      this.applySession(session);
      await this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('Invalid email or password');
    } finally {
      this.isLoading.set(false);
    }
  }

  async switchOrganization(organizationId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const tokens = await firstValueFrom(
        this.authApi.switchOrganization({ organizationId }),
      );
      if (tokens.accessToken) {
        localStorage.setItem(TOKEN_KEY, tokens.accessToken);
      }
      if (tokens.refreshToken) {
        localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
      }
      this.activeOrganizationId.set(organizationId);
      localStorage.setItem(ORG_ID_KEY, organizationId);
      const summary = this.organizations().find(o => o.id === organizationId);
      this.orgRole.set(summary?.role ?? null);
    } finally {
      this.isLoading.set(false);
    }
  }

  signOut(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ORG_ID_KEY);
    this.currentUser.set(null);
    this.activeOrganizationId.set(null);
    this.orgRole.set(null);
    this.organizations.set([]);
    void this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this._doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<boolean> {
    const token = localStorage.getItem(REFRESH_KEY);
    if (!token) { this.signOut(); return false; }
    try {
      const res = await firstValueFrom(this.authApi.refreshToken(token));
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      localStorage.setItem(REFRESH_KEY, res.refreshToken);
      return true;
    } catch {
      this.signOut();
      return false;
    }
  }

  private applySession(session: UserSession): void {
    localStorage.setItem(TOKEN_KEY, session.jwt);
    if (session.refreshToken) {
      localStorage.setItem(REFRESH_KEY, session.refreshToken);
    }
    if (session.organizationId) {
      localStorage.setItem(ORG_ID_KEY, session.organizationId);
    }
    const raw = session.user as User & { firstName?: string; lastName?: string };
    this.currentUser.set({
      id: raw.id,
      email: raw.email,
      name: raw.name || `${raw.firstName ?? ''} ${raw.lastName ?? ''}`.trim(),
    });
    this.activeOrganizationId.set(session.organizationId ?? null);
    this.organizations.set(session.organizations ?? []);
    const active = session.organizations?.find(o => o.id === session.organizationId);
    this.orgRole.set(active?.role ?? null);
  }

  private restoreFromStorage(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    const orgId = localStorage.getItem(ORG_ID_KEY);
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1])) as {
          sub?: string;
          email?: string;
          name?: string;
          organizationId?: string;
          orgRole?: OrgRole;
        };
        this.currentUser.set({
          id: payload.sub ?? '',
          email: payload.email ?? '',
          name: payload.name ?? '',
        });
        this.activeOrganizationId.set(orgId ?? payload.organizationId ?? null);
        this.orgRole.set(payload.orgRole ?? null);
      } catch {
        // malformed token — stay logged out
      }
    }
  }
}
