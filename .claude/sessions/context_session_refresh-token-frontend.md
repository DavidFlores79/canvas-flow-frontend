# Context Session: refresh-token-frontend

## Goal

Implement frontend support for backend refresh-token rotation in Angular so sessions renew automatically and securely.

## Backend Reality (verified 2026-05-20)

### Endpoints

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/v1/auth/refresh` | None | `{ refreshToken, audience? }` | `{ accessToken, refreshToken }` |
| POST | `/v1/auth/sign-in` | None | `{ email, password }` | `UserSessionDto` |
| POST | `/v1/auth/switch-organization` | Bearer JWT | `{ organizationId, audience? }` | `{ accessToken, refreshToken }` |

### Token Contracts

**Sign-in (`UserSessionDto`):**
```ts
{
  user: UserDto;
  kid: string;
  jwt: string;           // access token — field is "jwt" not "accessToken"
  refreshToken?: string;
  organizationId?: string;
  organizations?: OrgSummaryDto[];
}
```

**Refresh / Switch-org (`RefreshTokenResponseDto`):**
```ts
{
  accessToken: string;  // NOTE: field is "accessToken" not "jwt"
  refreshToken: string;
}
```

### Refresh Token Details

- Access token TTL: **30 minutes**
- Refresh token TTL: **24 hours** (configurable via `JWT_REFRESH_EXPIRY`)
- Signed with a separate key: `JWT_REFRESH_PRIVATE_KEY`
- Refresh token JWT claims include: `sub`, `jti`, `fid` (familyId)
- Backend validates: session exists in DB, not revoked/replaced, not expired, hash matches
- On replay detection: entire token family is revoked → backend throws `401`
- `audience` field on refresh: **optional** — omit it from standard refresh calls; `switchOrganization` may still pass it via its own flow

### Replay / Revocation Behaviour

- Each refresh **rotates** the token: old token is marked `revokedAt + replacedByJti`
- If a consumed token is replayed → `revokeRefreshFamily()` nukes the whole family → user is fully signed out
- Frontend must treat any `401` on `/auth/refresh` as a hard sign-out, no retry

---

## Current State (pre-implementation)

| File | Current State | Issue |
|---|---|---|
| `auth-api.service.ts` | `refreshToken()` exists, returns `TokenResponse` | `TokenResponse.jwt` does not exist on `RefreshTokenResponseDto` — **field name bug** |
| `auth.store.ts` | `switchOrganization()` reads `tokens.jwt` | Backend returns `accessToken` not `jwt` — **field name bug** |
| `auth.store.ts` | No `refreshSession()` method | Missing silent refresh capability |
| `auth.interceptor.ts` | Only injects `Authorization` header | No 401 handling, no retry, no in-flight lock |
| `auth-api.service.ts` | `TokenResponse` interface wrong | Must align field names with backend DTO |

---

## Frontend Scope

### 1. Fix field name alignment (`auth-api.service.ts`)

Replace `TokenResponse` interface to match `RefreshTokenResponseDto`:

```ts
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}
```

Update `refreshToken()` and `switchOrganization()` return types accordingly.

### 2. Add `refreshSession()` to `AuthStore`

```ts
async refreshSession(): Promise<boolean>
```

- Reads `cf_refresh_token` from localStorage
- If absent → calls `signOut()` → returns `false`
- Calls `authApi.refreshToken(token)` (no `audience` field)
- On success: stores new `cf_access_token` + `cf_refresh_token`, returns `true`
- On failure (any error): calls `signOut()`, returns `false`

### 3. In-flight refresh lock (`AuthStore`)

```ts
private refreshPromise: Promise<boolean> | null = null;
```

If `refreshSession()` is called concurrently, all callers await the same promise. Reset to `null` when done.

### 4. Fix `switchOrganization()` in `AuthStore`

Change `tokens.jwt` → `tokens.accessToken` to match the corrected interface.

### 5. 401-intercept with retry (`auth.interceptor.ts`)

Convert to a class-based interceptor (needed for `inject()` + RxJS chaining):

```
request → 401 response?
  → is /auth/refresh? → signOut(), do NOT retry
  → has refresh token? → authStore.refreshSession()
      success → retry original request once
      failure → already signed out by refreshSession()
  → no refresh token → signOut()
```

Key constraint: use the in-flight lock from step 3 — multiple concurrent 401s must share one refresh call.

---

## File Targets

| File | Change |
|---|---|
| `src/app/data/services/auth-api.service.ts` | Fix `TokenResponse` → `RefreshTokenResponse`, update method signatures |
| `src/app/application/stores/auth.store.ts` | Add `refreshSession()`, in-flight lock, fix `switchOrganization()` field name |
| `src/app/application/interceptors/auth.interceptor.ts` | Add 401 intercept with single retry and refresh-loop guard |
| `src/app/application/guards/auth.guard.ts` | (optional) Re-validate token on route entry using `isAuthenticated` signal |
| `src/app/application/stores/auth.store.spec.ts` | Unit tests for refresh success, failure, concurrent lock |
| `src/app/application/interceptors/auth.interceptor.spec.ts` | Unit tests for 401 retry, loop guard, no-retry on /auth/refresh |

---

## Acceptance Criteria

- [ ] Expired access token triggers one refresh call; original request is retried once with the new token
- [ ] Concurrent 401 responses trigger only **one** refresh request (in-flight lock)
- [ ] Rotated `refreshToken` is persisted in localStorage after each successful refresh
- [ ] Any failure on `/v1/auth/refresh` clears all tokens and redirects to `/login`
- [ ] Refresh payload contains only `{ refreshToken }` — no `audience` field
- [ ] 401 on `/auth/refresh` itself does NOT trigger another refresh (loop guard)
- [ ] `switchOrganization()` correctly reads `accessToken` from response
- [ ] All existing sign-in and sign-out flows continue to work

---

## Branch Strategy

- Branch name: `feat/frontend-refresh-token-rotation`
- Base branch: `develop`
- Target branch: `develop`
- Review: 1 reviewer required

---

## Testing Strategy

### Unit — `auth.store.spec.ts`

- `refreshSession()` success: stores new tokens, returns `true`
- `refreshSession()` API failure: calls `signOut()`, returns `false`
- `refreshSession()` no stored refresh token: calls `signOut()`, returns `false`
- Concurrent calls: second call awaits the same promise (spy called once)

### Unit — `auth.interceptor.spec.ts`

- Non-401 responses pass through unchanged
- 401 on regular request: triggers refresh → retries original once
- 401 on `/auth/refresh`: signs out, does NOT retry
- 401 retry also 401s: signs out, does NOT retry again

### Integration

- Auth guard allows access when `isAuthenticated` is true
- Auth guard redirects to `/login` when token is absent

---

## Implementation Order

1. Fix `TokenResponse` interface and method return types in `auth-api.service.ts`
2. Fix `switchOrganization()` field read in `auth.store.ts`
3. Add `refreshSession()` + in-flight lock to `auth.store.ts`
4. Upgrade `auth.interceptor.ts` to handle 401 → refresh → retry
5. Write unit tests for store and interceptor
6. Smoke-test against running backend

---

## Notes

- Do not introduce NgRx or any state library — signals only
- Keep interceptor changes minimal; no global error handling beyond auth
- `cf_access_token` / `cf_refresh_token` / `cf_org_id` are the canonical localStorage keys
- Backend `UserSessionDto.jwt` (sign-in) vs `RefreshTokenResponseDto.accessToken` (refresh/switch) is intentional — the two flows use different field names
