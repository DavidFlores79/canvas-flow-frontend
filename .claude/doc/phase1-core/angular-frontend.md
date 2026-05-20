# Phase 1 Implementation Plan: Canvas Flow Angular 20 Frontend Core

## Project Baseline

The workspace at `/Users/LAPTOP-david-001/Development/apps/Angular/canvas-flow-frontend` is an Angular 20 scaffold generated with `@angular/cli ^20.3.26`. Key facts that affect every decision below:

- Builder: `@angular/build:application` (uses Vite internally, not Webpack)
- `@angular/common/http` and `@angular/forms` are installed alongside core
- `tailwindcss@4` and `@tailwindcss/vite` are present as devDependencies
- `fabric@7.4.0` is a runtime dependency
- TypeScript 5.9 with `strict: true`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `strictTemplates`
- Jasmine + Karma for unit tests via `@angular/build:karma`
- No `src/environments/` directory exists yet
- The root component is exported as `App` (not `AppComponent`) from `src/app/app.ts`
- `app.spec.ts` references `h1` containing `Hello, canvas-flow-frontend` — this test will need to be updated once `app.html` is replaced

---

## Critical Notes Before Implementing

### Tailwind CSS v4 in Angular 20

Tailwind CSS v4 removed `tailwind.config.js` entirely. Configuration is entirely CSS-based.

For Angular 20 using `@angular/build:application` (Vite-backed), the `@tailwindcss/vite` plugin integrates at the Vite level. Angular's `@angular/build:application` exposes a `plugins` array under `architect.build.options` that accepts Vite plugin references as **string module specifiers**. Adding `"plugins": ["@tailwindcss/vite"]` in `angular.json` is the correct approach for this builder version — it tells the Angular Vite host to load the plugin.

However, the CSS `@import "tailwindcss"` in `src/styles.css` alone is sufficient for Tailwind utility classes to be processed, because the Vite PostCSS pipeline picks up the import. The `plugins` entry in `angular.json` enables the optimized Vite plugin path. Include both.

### Angular 20 API Notes

Angular 20 uses the same `@angular/core` Signal API as Angular 17+: `signal()`, `computed()`, `effect()`. The `inject()` function works in injection context (constructors and field initializers). `firstValueFrom` from `rxjs` is the correct way to convert Observables to Promises in async methods.

Angular 20 does NOT yet use `linkedSignal` or resource API in stable — do not use those.

`provideBrowserGlobalErrorListeners()` is already present in the generated `app.config.ts`. Keep it when updating that file.

### File Naming Convention

The scaffold uses `app.ts`, `app.html`, `app.css` (no `.component` suffix for the root). For feature files, use `login.ts`, `login.html`, `login.css` etc. following the same pattern the task description specifies (e.g., `login/login.ts`).

### `@angular/common` Imports in Angular 20

In Angular 20 with standalone components, `NgIf`, `NgFor`, `NgClass` are not needed — use `@if`, `@for`, `@switch` control flow syntax directly. `CommonModule` is not needed in `imports` arrays for control flow. Only import `CommonModule` if you need pipes like `AsyncPipe`, `DatePipe`, etc., or import those pipes individually.

### Strict TypeScript Constraints

- `noPropertyAccessFromIndexSignature` is enabled — when accessing JWT payload properties decoded as `Record<string, unknown>`, use bracket notation: `payload['organizationId']`
- `noImplicitReturns` is enabled — every code path in functions returning non-void must return a value
- `strict: true` includes `strictNullChecks` — handle `null | undefined` at every call site
- Template type checking is `strictTemplates: true` — all template expressions must be type-safe

---

## Step 0: Configure Tailwind CSS v4

### File to modify: `src/styles.css`

Replace the entire file with:

```css
@import "tailwindcss";
```

Remove the existing comment line. That is the only content needed.

### File to modify: `angular.json`

Under `projects.canvas-flow-frontend.architect.build.options`, add a `plugins` array:

```json
"plugins": ["@tailwindcss/vite"]
```

This goes at the same level as `browser`, `polyfills`, `tsConfig`, `assets`, `styles` inside `options`. The production and development configurations do not need changes.

---

## Step 1: Create Directory Structure

Create the following empty directories (use `.gitkeep` files only if needed for git — Angular does not require them):

```
src/app/core/guards/
src/app/core/interceptors/
src/app/core/services/
src/app/domain/models/
src/app/domain/enums/
src/app/business/stores/
src/app/data/services/
src/app/ui/auth/pages/login/
src/app/ui/auth/components/org-switcher/
src/app/ui/shared/components/coming-soon/
src/environments/
```

---

## Step 2: Domain Models

All domain model files are pure TypeScript interfaces. They must have zero Angular imports and zero runtime dependencies. They are read-only value types.

### `src/app/domain/models/user.model.ts`

```typescript
export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}
```

### `src/app/domain/models/organization.model.ts`

```typescript
export interface Organization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly ownerId: string;
}

export interface OrgSummary {
  readonly id: string;
  readonly role: string;
}
```

### `src/app/domain/models/workspace.model.ts`

```typescript
export interface Workspace {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly ownerId: string;
}
```

### `src/app/domain/models/project.model.ts`

```typescript
export interface Project {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly version: number;
}
```

### `src/app/domain/models/layer.model.ts`

```typescript
export interface Layer {
  readonly id: string;
  readonly type: 'text' | 'image' | 'shape';
  readonly properties: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotation: number;
    readonly zIndex: number;
  };
  readonly assetId?: string;
}
```

### `src/app/domain/models/asset.model.ts`

```typescript
export interface Asset {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly cloudinaryPublicId: string;
  readonly url: string;
  readonly type: 'image' | 'video' | 'document';
}
```

### `src/app/domain/enums/org-role.enum.ts`

```typescript
export enum OrgRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
}
```

### `src/app/domain/enums/workspace-role.enum.ts`

```typescript
export enum WorkspaceRole {
  Owner = 'owner',
  Editor = 'editor',
  Viewer = 'viewer',
}
```

---

## Step 3: Environment Files

These must be created before data layer services because `auth-api.service.ts` imports from `environment`.

### `src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3060/v1',
};
```

### `src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: '/v1',
};
```

### `angular.json` update for file replacements

Inside `projects.canvas-flow-frontend.architect.build.configurations.production`, add:

```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
]
```

This goes alongside the existing `budgets` and `outputHashing` keys in the production configuration object.

---

## Step 4: Data Layer — Auth API Service

### `src/app/data/services/auth-api.service.ts`

This service lives in the data layer and is the only file in the codebase that makes direct HTTP calls for auth. It must NOT be imported by UI components — only by the `AuthStore` in the business layer.

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SignInPayload {
  email: string;
  password: string;
}

export interface OrgSummaryResponse {
  id: string;
  role: string;
}

export interface UserSessionResponse {
  user: { id: string; email: string; name: string };
  jwt: string;
  refreshToken?: string;
  kid: string;
  organizationId?: string;
  organizations?: OrgSummaryResponse[];
}

export interface SwitchOrganizationResponse {
  jwt: string;
  refreshToken?: string;
  kid: string;
  organizationId: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  signIn(payload: SignInPayload): Observable<UserSessionResponse> {
    return this.http.post<UserSessionResponse>(`${this.baseUrl}/sign-in`, payload);
  }

  switchOrganization(organizationId: string): Observable<SwitchOrganizationResponse> {
    return this.http.post<SwitchOrganizationResponse>(
      `${this.baseUrl}/switch-organization`,
      { organizationId }
    );
  }

  refreshToken(refreshToken: string): Observable<SwitchOrganizationResponse> {
    return this.http.post<SwitchOrganizationResponse>(
      `${this.baseUrl}/refresh`,
      { refreshToken }
    );
  }
}
```

Note: The DTOs exported from this file (`SignInPayload`, `UserSessionResponse`, etc.) are intentionally in the data layer. The `AuthStore` imports `SignInPayload` from here. This is the one accepted cross-layer import — the store is a mediator.

---

## Step 5: Core Layer — Token Service

### `src/app/core/services/token.service.ts`

```typescript
import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'cf_access_token';
const REFRESH_TOKEN_KEY = 'cf_refresh_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  storeTokens(jwt: string, refreshToken?: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, jwt);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  decodePayload(token: string): Record<string, unknown> | null {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  }
}
```

Important: `decodePayload` returns `Record<string, unknown>` — not `any`. All callers must use bracket notation to access properties: `payload['organizationId']`. This satisfies `noPropertyAccessFromIndexSignature`.

---

## Step 6: Business Layer — AuthStore

### `src/app/business/stores/auth.store.ts`

This is the central auth state manager. It uses Angular Signals exclusively — no BehaviorSubject, no Subject. The `async/await` with `firstValueFrom` converts the HTTP Observables returned by `AuthApiService`.

```typescript
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { User } from '../../domain/models/user.model';
import { OrgSummary } from '../../domain/models/organization.model';
import { OrgRole } from '../../domain/enums/org-role.enum';
import { AuthApiService, SignInPayload } from '../../data/services/auth-api.service';
import { TokenService } from '../../core/services/token.service';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authApi = inject(AuthApiService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  readonly currentUser = signal<User | null>(null);
  readonly activeOrganizationId = signal<string | null>(null);
  readonly orgRole = signal<OrgRole | null>(null);
  readonly organizations = signal<OrgSummary[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly hasMultipleOrgs = computed(() => this.organizations().length > 1);

  async signIn(payload: SignInPayload): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await firstValueFrom(this.authApi.signIn(payload));
      this.tokenService.storeTokens(session.jwt, session.refreshToken);
      this.currentUser.set({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });
      this.activeOrganizationId.set(session.organizationId ?? null);
      this.organizations.set(session.organizations ?? []);
      this.orgRole.set(this.extractOrgRole(session.organizations, session.organizationId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      this.error.set(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  async switchOrganization(organizationId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const tokens = await firstValueFrom(this.authApi.switchOrganization(organizationId));
      this.tokenService.storeTokens(tokens.jwt, tokens.refreshToken);
      this.activeOrganizationId.set(tokens.organizationId);
      this.loadContextFromToken();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Switch organization failed';
      this.error.set(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  signOut(): void {
    this.tokenService.clearTokens();
    this.currentUser.set(null);
    this.activeOrganizationId.set(null);
    this.orgRole.set(null);
    this.organizations.set([]);
    this.router.navigate(['/auth/login']);
  }

  loadContextFromToken(): void {
    const token = this.tokenService.getAccessToken();
    if (!token) return;
    const payload = this.tokenService.decodePayload(token);
    if (!payload) return;
    if (payload['organizationId']) {
      this.activeOrganizationId.set(payload['organizationId'] as string);
    }
    if (payload['orgRole']) {
      this.orgRole.set(payload['orgRole'] as OrgRole);
    }
  }

  private extractOrgRole(
    orgs: { id: string; role: string }[] | undefined,
    activeOrgId: string | undefined
  ): OrgRole | null {
    if (!orgs || !activeOrgId) return null;
    const membership = orgs.find((o) => o.id === activeOrgId);
    return (membership?.role as OrgRole) ?? null;
  }
}
```

Key deviation from the original spec: the `signIn` method wraps the entire try block with `catch` to properly set `this.error`. The original spec omitted the catch block — this would cause unhandled promise rejections in a strict TypeScript environment. The `finally` block ensures `isLoading` is always reset.

---

## Step 7: Core Layer — HTTP Interceptor

### `src/app/core/interceptors/auth.interceptor.ts`

Functional interceptors (not class-based) are the Angular 15+ pattern. Use `HttpInterceptorFn`.

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenService } from '../services/token.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const token = tokenService.getAccessToken();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
```

---

## Step 8: Core Layer — Guards

### `src/app/core/guards/auth.guard.ts`

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from '../services/token.service';

export const authGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  if (tokenService.getAccessToken()) return true;
  return router.createUrlTree(['/auth/login']);
};
```

### `src/app/core/guards/role.guard.ts`

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../business/stores/auth.store';
import { OrgRole } from '../../domain/enums/org-role.enum';

export const roleGuard = (allowedRoles: OrgRole[]): CanActivateFn => () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const role = authStore.orgRole();
  if (role && allowedRoles.includes(role)) return true;
  return router.createUrlTree(['/dashboard']);
};
```

Note on `roleGuard` TypeScript signature: the outer function returns a `CanActivateFn`. The inner arrow function `() =>` satisfies the `CanActivateFn` type because `CanActivateFn` is `(route, state) => ...` — the parameters are optional to destructure. This is valid TypeScript because unused parameters can be omitted in arrow functions. If TypeScript complains under strict mode about parameter count, change to `(_route, _state) => {`.

---

## Step 9: App Config — Wire HTTP Client and Interceptor

### File to modify: `src/app/app.config.ts`

Replace the entire file:

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

`provideBrowserGlobalErrorListeners()` is preserved from the scaffold — it is an Angular 20 addition that registers global error handlers. Do not remove it.

`provideHttpClient` must include `withInterceptors` wrapping `authInterceptor`. Providing `HttpClient` without this setup means the interceptor is never registered.

---

## Step 10: UI Layer — Coming Soon Placeholder

This component must exist before defining routes, because `app.routes.ts` lazy-loads it.

### `src/app/ui/shared/components/coming-soon/coming-soon.ts`

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-950">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-white">Canvas Flow</h1>
        <p class="mt-2 text-gray-400">Dashboard coming soon</p>
      </div>
    </div>
  `,
})
export class ComingSoonComponent {}
```

No separate HTML file is needed for a placeholder this simple. The inline `template` is acceptable.

---

## Step 11: UI Layer — Login Page

### `src/app/ui/auth/pages/login/login.ts`

This is the smart container for authentication. It imports `ReactiveFormsModule` and calls `AuthStore`. It does NOT import from the data layer.

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../business/stores/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly authStore = inject(AuthStore);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    await this.authStore.signIn({ email: email!, password: password! });
    if (this.authStore.error()) return;
    const destination = this.authStore.hasMultipleOrgs()
      ? '/auth/select-org'
      : '/dashboard';
    await this.router.navigate([destination]);
  }

  protected getError(field: 'email' | 'password'): string | null {
    const control = this.form.get(field);
    if (!control?.touched || !control.errors) return null;
    if (control.errors['required']) return `${field} is required`;
    if (control.errors['email']) return 'Enter a valid email address';
    if (control.errors['minlength']) return 'Password must be at least 6 characters';
    return null;
  }
}
```

Important notes:
- `getRawValue()` returns typed values when using typed `FormGroup` — TypeScript will infer `string | null` for each field because initial values are `''`. The `!` non-null assertions are safe here because `form.invalid` check ensures both fields have values.
- `protected` visibility on class members is required for Angular 20 strict template checking. Template expressions can only access public or protected members.
- The `authStore` must be `protected` (not `private`) because the template binds to `authStore.error()`, `authStore.isLoading()`, etc.

### `src/app/ui/auth/pages/login/login.html`

```html
<div class="flex min-h-screen items-center justify-center bg-gray-950">
  <div class="w-full max-w-md rounded-2xl bg-gray-900 p-8 shadow-2xl">
    <h1 class="mb-2 text-2xl font-bold text-white">Sign in</h1>
    <p class="mb-8 text-sm text-gray-400">Welcome back to Canvas Flow</p>

    @if (authStore.error()) {
      <div class="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {{ authStore.error() }}
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="space-y-5">
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-gray-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          formControlName="email"
          autocomplete="email"
          placeholder="you@example.com"
          class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          [class.border-red-500]="!!getError('email')"
        />
        @if (getError('email')) {
          <p class="mt-1 text-xs text-red-400">{{ getError('email') }}</p>
        }
      </div>

      <div>
        <label for="password" class="mb-1 block text-sm font-medium text-gray-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          formControlName="password"
          autocomplete="current-password"
          placeholder="••••••••"
          class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          [class.border-red-500]="!!getError('password')"
        />
        @if (getError('password')) {
          <p class="mt-1 text-xs text-red-400">{{ getError('password') }}</p>
        }
      </div>

      <button
        type="submit"
        [disabled]="authStore.isLoading()"
        class="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        @if (authStore.isLoading()) {
          <span class="inline-flex items-center gap-2">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Signing in...
          </span>
        } @else {
          Sign in
        }
      </button>
    </form>
  </div>
</div>
```

Important: Use `@if` / `@else` (Angular 17+ control flow syntax) instead of `*ngIf`. This avoids needing `CommonModule` in `imports`.

### `src/app/ui/auth/pages/login/login.css`

```css
/* Component-specific overrides go here. Tailwind utility-first approach means this file may remain empty. */
```

---

## Step 12: UI Layer — OrgSwitcher Component

### `src/app/ui/auth/components/org-switcher/org-switcher.ts`

```typescript
import { Component, inject } from '@angular/core';
import { AuthStore } from '../../../../business/stores/auth.store';

@Component({
  selector: 'app-org-switcher',
  standalone: true,
  templateUrl: './org-switcher.html',
})
export class OrgSwitcherComponent {
  protected readonly authStore = inject(AuthStore);

  protected async onSelect(orgId: string): Promise<void> {
    if (orgId === this.authStore.activeOrganizationId()) return;
    await this.authStore.switchOrganization(orgId);
  }
}
```

### `src/app/ui/auth/components/org-switcher/org-switcher.html`

```html
<div class="relative">
  <select
    [disabled]="authStore.isLoading()"
    (change)="onSelect(($event.target as HTMLSelectElement).value)"
    class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
    aria-label="Switch organization"
  >
    @for (org of authStore.organizations(); track org.id) {
      <option
        [value]="org.id"
        [selected]="org.id === authStore.activeOrganizationId()"
      >
        {{ org.id }}
      </option>
    }
  </select>
</div>
```

Note: The `OrgSummary` model only has `id` and `role` — there is no `name` field. The display value uses `org.id` as a placeholder. When the backend is integrated, the `OrgSummary` model should be extended with a `name` field and the template updated to show `{{ org.name }}`.

---

## Step 13: Routes

### File to modify: `src/app/app.routes.ts`

Replace the entire file:

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./ui/auth/pages/login/login').then((m) => m.LoginComponent),
      },
    ],
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./ui/shared/components/coming-soon/coming-soon').then(
        (m) => m.ComingSoonComponent
      ),
  },
  { path: '**', redirectTo: 'dashboard' },
];
```

---

## Step 14: Update Root App Component

### File to modify: `src/app/app.ts`

The root component needs only the router outlet. Remove the `title` signal and the Angular scaffold HTML.

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
```

### File to modify: `src/app/app.html`

Because the template is now inline in the component decorator, the `app.html` file is no longer referenced. Delete its content or remove the `templateUrl` in favor of `template`. The cleanest approach is to use inline `template` in `app.ts` and delete `app.html`.

If keeping `app.html`, its entire content should be replaced with:

```html
<router-outlet />
```

### File to modify: `src/app/app.css`

Clear this file. All global styles come from Tailwind via `src/styles.css`.

### File to modify: `src/app/app.spec.ts`

The existing spec tests for `h1` content that no longer exists. Update:

```typescript
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
```

The `provideRouter(routes)` is required because `App` imports `RouterOutlet` and the test environment needs a router.

---

## Step 15: Unit Tests

### `src/app/core/services/token.service.spec.ts`

```typescript
import { TestBed } from '@angular/core/testing';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenService);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('storeTokens', () => {
    it('stores access token', () => {
      service.storeTokens('jwt-value');
      expect(localStorage.getItem('cf_access_token')).toBe('jwt-value');
    });

    it('stores refresh token when provided', () => {
      service.storeTokens('jwt', 'refresh-value');
      expect(localStorage.getItem('cf_refresh_token')).toBe('refresh-value');
    });

    it('does not store refresh token when not provided', () => {
      service.storeTokens('jwt');
      expect(localStorage.getItem('cf_refresh_token')).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('returns null when no token stored', () => {
      expect(service.getAccessToken()).toBeNull();
    });

    it('returns stored access token', () => {
      localStorage.setItem('cf_access_token', 'my-jwt');
      expect(service.getAccessToken()).toBe('my-jwt');
    });
  });

  describe('getRefreshToken', () => {
    it('returns null when no refresh token stored', () => {
      expect(service.getRefreshToken()).toBeNull();
    });

    it('returns stored refresh token', () => {
      localStorage.setItem('cf_refresh_token', 'my-refresh');
      expect(service.getRefreshToken()).toBe('my-refresh');
    });
  });

  describe('clearTokens', () => {
    it('removes both tokens', () => {
      service.storeTokens('jwt', 'refresh');
      service.clearTokens();
      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
    });
  });

  describe('decodePayload', () => {
    it('decodes a valid JWT payload', () => {
      // header.payload.signature — payload is base64({"sub":"123","email":"test@test.com"})
      const payload = btoa(JSON.stringify({ sub: '123', email: 'test@test.com' }));
      const token = `header.${payload}.signature`;
      const decoded = service.decodePayload(token);
      expect(decoded?.['sub']).toBe('123');
      expect(decoded?.['email']).toBe('test@test.com');
    });

    it('returns null for malformed token', () => {
      expect(service.decodePayload('not-a-jwt')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(service.decodePayload('')).toBeNull();
    });
  });
});
```

### `src/app/core/interceptors/auth.interceptor.spec.ts`

```typescript
import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { TokenService } from '../services/token.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let tokenService: TokenService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    tokenService = TestBed.inject(TokenService);
    localStorage.clear();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('attaches Authorization header when token exists', () => {
    tokenService.storeTokens('test-jwt');
    http.get('/api/test').subscribe();
    const req = httpTesting.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    req.flush({});
  });

  it('does not attach Authorization header when no token', () => {
    http.get('/api/test').subscribe();
    const req = httpTesting.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
```

Note: `provideHttpClientTesting` is from `@angular/common/http/testing`. This package is available because `@angular/common` is installed. The `HttpTestingController` approach is the Angular 15+ way — `HttpClientTestingModule` still works but is deprecated in newer versions.

### `src/app/core/guards/auth.guard.spec.ts`

```typescript
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { TokenService } from '../services/token.service';
import { Component } from '@angular/core';

@Component({ standalone: true, template: '<p>Protected</p>' })
class ProtectedComponent {}

@Component({ standalone: true, template: '<p>Login</p>' })
class LoginComponent {}

describe('authGuard', () => {
  let tokenService: TokenService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'auth/login', component: LoginComponent },
          {
            path: 'protected',
            canActivate: [authGuard],
            component: ProtectedComponent,
          },
        ]),
      ],
    }).compileComponents();
    tokenService = TestBed.inject(TokenService);
    router = TestBed.inject(Router);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('allows navigation when token exists', async () => {
    tokenService.storeTokens('valid-jwt');
    await RouterTestingHarness.create('/protected');
    expect(router.url).toBe('/protected');
  });

  it('redirects to /auth/login when no token', async () => {
    await RouterTestingHarness.create('/protected');
    expect(router.url).toBe('/auth/login');
  });
});
```

Note: `RouterTestingHarness` is available from `@angular/router/testing` since Angular 15. It is the modern replacement for `RouterTestingModule`.

### `src/app/business/stores/auth.store.spec.ts`

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthApiService, UserSessionResponse, SwitchOrganizationResponse } from '../../data/services/auth-api.service';
import { TokenService } from '../../core/services/token.service';

describe('AuthStore', () => {
  let store: AuthStore;
  let authApiSpy: jasmine.SpyObj<AuthApiService>;
  let tokenServiceSpy: jasmine.SpyObj<TokenService>;
  let router: Router;

  const mockSession: UserSessionResponse = {
    user: { id: 'u1', email: 'test@test.com', name: 'Test User' },
    jwt: 'mock-jwt',
    refreshToken: 'mock-refresh',
    kid: 'key1',
    organizationId: 'org1',
    organizations: [{ id: 'org1', role: 'admin' }, { id: 'org2', role: 'member' }],
  };

  beforeEach(() => {
    authApiSpy = jasmine.createSpyObj('AuthApiService', ['signIn', 'switchOrganization', 'refreshToken']);
    tokenServiceSpy = jasmine.createSpyObj('TokenService', [
      'storeTokens', 'getAccessToken', 'getRefreshToken', 'clearTokens', 'decodePayload',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: authApiSpy },
        { provide: TokenService, useValue: tokenServiceSpy },
      ],
    });

    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  describe('signIn', () => {
    it('sets currentUser and organizations on success', async () => {
      authApiSpy.signIn.and.returnValue(of(mockSession));
      await store.signIn({ email: 'test@test.com', password: 'secret' });
      expect(store.currentUser()?.email).toBe('test@test.com');
      expect(store.organizations().length).toBe(2);
      expect(store.activeOrganizationId()).toBe('org1');
    });

    it('sets isLoading to false after completion', async () => {
      authApiSpy.signIn.and.returnValue(of(mockSession));
      await store.signIn({ email: 'test@test.com', password: 'secret' });
      expect(store.isLoading()).toBeFalse();
    });

    it('sets error on failure', async () => {
      authApiSpy.signIn.and.returnValue(throwError(() => new Error('Unauthorized')));
      await store.signIn({ email: 'bad@test.com', password: 'wrong' });
      expect(store.error()).toBe('Unauthorized');
      expect(store.currentUser()).toBeNull();
    });

    it('sets isAuthenticated computed to true on success', async () => {
      authApiSpy.signIn.and.returnValue(of(mockSession));
      await store.signIn({ email: 'test@test.com', password: 'secret' });
      expect(store.isAuthenticated()).toBeTrue();
    });

    it('sets hasMultipleOrgs computed correctly', async () => {
      authApiSpy.signIn.and.returnValue(of(mockSession));
      await store.signIn({ email: 'test@test.com', password: 'secret' });
      expect(store.hasMultipleOrgs()).toBeTrue();
    });
  });

  describe('switchOrganization', () => {
    const mockSwitch: SwitchOrganizationResponse = {
      jwt: 'new-jwt',
      refreshToken: 'new-refresh',
      kid: 'key2',
      organizationId: 'org2',
    };

    it('updates activeOrganizationId on success', async () => {
      authApiSpy.switchOrganization.and.returnValue(of(mockSwitch));
      tokenServiceSpy.getAccessToken.and.returnValue(null);
      await store.switchOrganization('org2');
      expect(store.activeOrganizationId()).toBe('org2');
      expect(tokenServiceSpy.storeTokens).toHaveBeenCalledWith('new-jwt', 'new-refresh');
    });
  });

  describe('signOut', () => {
    it('clears all signals and navigates to login', async () => {
      authApiSpy.signIn.and.returnValue(of(mockSession));
      await store.signIn({ email: 'test@test.com', password: 'secret' });
      const navigateSpy = spyOn(router, 'navigate');
      store.signOut();
      expect(store.currentUser()).toBeNull();
      expect(store.organizations()).toEqual([]);
      expect(store.activeOrganizationId()).toBeNull();
      expect(tokenServiceSpy.clearTokens).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('loadContextFromToken', () => {
    it('does nothing when no token in storage', () => {
      tokenServiceSpy.getAccessToken.and.returnValue(null);
      store.loadContextFromToken();
      expect(store.activeOrganizationId()).toBeNull();
    });

    it('sets organizationId from decoded token payload', () => {
      tokenServiceSpy.getAccessToken.and.returnValue('some-jwt');
      tokenServiceSpy.decodePayload.and.returnValue({ organizationId: 'org-from-token', orgRole: 'admin' });
      store.loadContextFromToken();
      expect(store.activeOrganizationId()).toBe('org-from-token');
    });
  });
});
```

### `src/app/ui/auth/pages/login/login.spec.ts`

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { LoginComponent } from './login';
import { AuthStore } from '../../../../business/stores/auth.store';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authStoreMock: jasmine.SpyObj<AuthStore> & {
    error: ReturnType<typeof signal<string | null>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    hasMultipleOrgs: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(async () => {
    const errorSig = signal<string | null>(null);
    const loadingSig = signal(false);
    const multiOrgSig = signal(false);

    authStoreMock = {
      ...jasmine.createSpyObj<AuthStore>('AuthStore', ['signIn', 'switchOrganization', 'signOut', 'loadContextFromToken']),
      error: errorSig,
      isLoading: loadingSig,
      hasMultipleOrgs: multiOrgSig,
      isAuthenticated: signal(false),
      currentUser: signal(null),
      organizations: signal([]),
      activeOrganizationId: signal(null),
      orgRole: signal(null),
    } as unknown as typeof authStoreMock;

    authStoreMock.signIn.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStoreMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show validation errors on empty submit', async () => {
    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.click();
    fixture.detectChanges();
    const errors = fixture.nativeElement.querySelectorAll('p.text-red-400');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should call authStore.signIn with form values', async () => {
    const emailInput = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    const passwordInput = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    emailInput.value = 'user@test.com';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'password123';
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();

    expect(authStoreMock.signIn).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
    });
  });

  it('should display error from authStore', () => {
    authStoreMock.error.set('Invalid credentials');
    fixture.detectChanges();
    const errorDiv = fixture.nativeElement.querySelector('.text-red-400');
    expect(errorDiv?.textContent).toContain('Invalid credentials');
  });
});
```

Note on mocking Angular Signals in tests: signals from the store must be real signal instances (not spied functions) because the template calls them as functions `authStore.error()`, `authStore.isLoading()`. The `jasmine.createSpyObj` approach is used for methods like `signIn`, while signals are replaced with real `signal()` instances on the mock object.

### `src/app/ui/auth/components/org-switcher/org-switcher.spec.ts`

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { OrgSwitcherComponent } from './org-switcher';
import { AuthStore } from '../../../../business/stores/auth.store';
import { OrgSummary } from '../../../../domain/models/organization.model';

describe('OrgSwitcherComponent', () => {
  let fixture: ComponentFixture<OrgSwitcherComponent>;
  let authStoreMock: {
    organizations: ReturnType<typeof signal<OrgSummary[]>>;
    activeOrganizationId: ReturnType<typeof signal<string | null>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    switchOrganization: jasmine.Spy;
  };

  const mockOrgs: OrgSummary[] = [
    { id: 'org1', role: 'admin' },
    { id: 'org2', role: 'member' },
  ];

  beforeEach(async () => {
    authStoreMock = {
      organizations: signal<OrgSummary[]>(mockOrgs),
      activeOrganizationId: signal<string | null>('org1'),
      isLoading: signal(false),
      switchOrganization: jasmine.createSpy('switchOrganization').and.returnValue(Promise.resolve()),
    };

    await TestBed.configureTestingModule({
      imports: [OrgSwitcherComponent],
      providers: [{ provide: AuthStore, useValue: authStoreMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgSwitcherComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders an option for each organization', () => {
    const options = fixture.nativeElement.querySelectorAll('option');
    expect(options.length).toBe(2);
  });

  it('calls switchOrganization when a different org is selected', async () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'org2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(authStoreMock.switchOrganization).toHaveBeenCalledWith('org2');
  });

  it('does not call switchOrganization when the active org is selected', async () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'org1';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(authStoreMock.switchOrganization).not.toHaveBeenCalled();
  });
});
```

---

## Step 16: Verify Build and Tests

### Build verification command

```bash
cd /Users/LAPTOP-david-001/Development/apps/Angular/canvas-flow-frontend && yarn build 2>&1 | tail -30
```

### Test verification command

```bash
cd /Users/LAPTOP-david-001/Development/apps/Angular/canvas-flow-frontend && yarn test --watch=false --browsers=ChromeHeadless 2>&1 | tail -50
```

---

## Known Issues and Mitigations

### 1. `app.spec.ts` will fail after `app.html` is cleared

The existing `app.spec.ts` has a test asserting `h1` contains `Hello, canvas-flow-frontend`. Once `app.html` is replaced with just `<router-outlet />`, this test fails. The spec must be updated as described in Step 14.

### 2. `@tailwindcss/vite` plugin string in `angular.json`

The `plugins` field in `angular.json` under `@angular/build:application` accepts module specifier strings. At Angular 20 / `@angular/build ^20.3.26`, this is the documented way to inject Vite plugins. If a future `@angular/build` version changes this API, the build log will show a clear error about unrecognized option. In that case, remove the `plugins` key — the `@import "tailwindcss"` in `styles.css` will still apply Tailwind utilities through PostCSS.

### 3. `OrgSummary` missing `name` field

The `OrgSummary` domain model defined in the task spec only has `id` and `role`. The `OrgSwitcher` component cannot display a human-readable organization name. The `org-switcher.html` template should show `org.id` as a fallback. A follow-up task is needed to either extend the model or fetch org details separately.

### 4. No `/auth/select-org` route

The `LoginComponent` navigates to `/auth/select-org` when `hasMultipleOrgs()` is true. This route does not exist in Phase 1. The router wildcard `{ path: '**', redirectTo: 'dashboard' }` catches it, so no 404 occurs, but the user will land on the dashboard without choosing an org. Phase 2 must add this route and its component.

### 5. Token persistence on page reload

`AuthStore` signals reset to their initial values on every page load. There is no `ngOnInit`-equivalent for a root injectable. Call `authStore.loadContextFromToken()` somewhere during app bootstrap — either in `App` component's constructor or in an `APP_INITIALIZER`. This is not in the Phase 1 spec but will be needed before any protected route works after a page refresh.

### 6. `HttpClientTestingModule` vs `provideHttpClientTesting()`

In Angular 18+, `HttpClientTestingModule` is deprecated. Use `provideHttpClientTesting()` from `@angular/common/http/testing` instead. All spec files in this plan use the modern approach.

### 7. `RouterTestingModule` vs `provideRouter()`

`RouterTestingModule` is deprecated since Angular 16. All spec files in this plan use `provideRouter([])` with `RouterTestingHarness` where needed.

---

## Complete File List

Files to **create** (new):

| Path | Type |
|------|------|
| `src/environments/environment.ts` | New file |
| `src/environments/environment.prod.ts` | New file |
| `src/app/domain/models/user.model.ts` | New file |
| `src/app/domain/models/organization.model.ts` | New file |
| `src/app/domain/models/workspace.model.ts` | New file |
| `src/app/domain/models/project.model.ts` | New file |
| `src/app/domain/models/layer.model.ts` | New file |
| `src/app/domain/models/asset.model.ts` | New file |
| `src/app/domain/enums/org-role.enum.ts` | New file |
| `src/app/domain/enums/workspace-role.enum.ts` | New file |
| `src/app/data/services/auth-api.service.ts` | New file |
| `src/app/core/services/token.service.ts` | New file |
| `src/app/core/interceptors/auth.interceptor.ts` | New file |
| `src/app/core/guards/auth.guard.ts` | New file |
| `src/app/core/guards/role.guard.ts` | New file |
| `src/app/business/stores/auth.store.ts` | New file |
| `src/app/ui/shared/components/coming-soon/coming-soon.ts` | New file |
| `src/app/ui/auth/pages/login/login.ts` | New file |
| `src/app/ui/auth/pages/login/login.html` | New file |
| `src/app/ui/auth/pages/login/login.css` | New file |
| `src/app/ui/auth/components/org-switcher/org-switcher.ts` | New file |
| `src/app/ui/auth/components/org-switcher/org-switcher.html` | New file |
| `src/app/core/services/token.service.spec.ts` | New file |
| `src/app/core/interceptors/auth.interceptor.spec.ts` | New file |
| `src/app/core/guards/auth.guard.spec.ts` | New file |
| `src/app/business/stores/auth.store.spec.ts` | New file |
| `src/app/ui/auth/pages/login/login.spec.ts` | New file |
| `src/app/ui/auth/components/org-switcher/org-switcher.spec.ts` | New file |

Files to **modify** (existing):

| Path | Change |
|------|--------|
| `src/styles.css` | Replace with `@import "tailwindcss";` |
| `angular.json` | Add `plugins` under build options; add `fileReplacements` in production config |
| `src/app/app.config.ts` | Add `provideHttpClient(withInterceptors([authInterceptor]))` |
| `src/app/app.routes.ts` | Replace with full route tree |
| `src/app/app.ts` | Replace with minimal router-outlet component |
| `src/app/app.html` | Replace with `<router-outlet />` (or delete and use inline template) |
| `src/app/app.css` | Clear contents |
| `src/app/app.spec.ts` | Update tests to not reference old `h1` content |
