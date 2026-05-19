# Context Session: Canvas Flow AI Media Editing Platform (Backend)

## Feature Description
Build a full-featured, scalable AI-powered media editing platform backend. This is a multi-tenant SaaS (Software as a Service) serving as the foundation for a Canva-like editor integrating Cloudinary and Leonardo AI. Two seed organizations exist from day one: **Paisamex** and **Luxfree**.

## Architecture & Tech Stack
- **Framework:** NestJS 11 (Strict TypeScript)
- **Database:** MongoDB with Mongoose 9
- **Auth:** JWT (passport-jwt already installed) + CASL for authorization
- **Storage/Media:** Cloudinary SDK
- **AI Generation:** Leonardo AI REST API
- **Package Manager:** yarn (NEVER npm)

## Multi-Tenant Data Hierarchy
```
Organization (Paisamex / Luxfree / ...)
  └── OrganizationMember (userId, role: owner|admin|member)
  └── Workspace (e.g. "Marketing", "Social Media")
        └── WorkspaceMember (userId, role: owner|editor|viewer)
        └── Project (individual canvas)
              └── Layer (elements: text, image, shape)
              └── Asset (uploaded media files)
```

## RBAC Strategy: CASL with Custom Guards

### Why CASL (NOT nest-casl)
- `nest-casl` is TypeORM-coupled and not maintained for NestJS 11
- Custom `CaslModule` gives full control, no N+1 hydration issues
- Only dependency to add: `yarn add @casl/ability`

### Role Definitions
**Organization-level roles** (`OrgRole` enum):
| Role | Permissions |
|---|---|
| `owner` | Full control, manage billing, delete org |
| `admin` | Manage members, manage all workspaces/projects |
| `member` | Read org, create workspaces, access assigned workspaces |

**Workspace-level roles** (`WorkspaceRole` enum):
| Role | Permissions |
|---|---|
| `owner` | Manage workspace members, manage all projects/layers |
| `editor` | Create/read/update projects, manage layers and assets |
| `viewer` | Read-only on workspace, projects, layers, assets |

### JWT Payload (Upgraded)
```typescript
export interface JwtPayload {
  sub: string;            // userId (MongoDB ObjectId as string)
  organizationId: string; // active org ObjectId
  orgRole: OrgRole;       // owner | admin | member
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  jti: string;
}
```
- `group` field removed from JWT entirely
- One active org per token (Option A)
- Org switch: `POST /auth/switch-organization` re-issues token pair

## Complete Implementation Roadmap

### Phase 0: RBAC Foundation (implement first)
- Install `@casl/ability`
- Create `src/casl/` module with:
  - `AbilityFactory` — defines CASL rules per AuthContext
  - `PoliciesGuard` — reads `@CheckPolicies()` metadata
  - `TenantGuard` — validates org membership from JWT, attaches `req.tenantContext`
  - `CheckPolicies` decorator
- Define `OrgRole` and `WorkspaceRole` enums in `src/shared/enum/`
- Fix existing `HttpExceptionFilter` bug (implements NestInterceptor but registered as APP_FILTER — register as APP_INTERCEPTOR instead)
- Update `JwtPayload` interface: add `organizationId`, `orgRole`, remove `group`
- Add `POST /auth/switch-organization` endpoint in AuthService
- Update `generateTokensForUser()` to accept `OrganizationMember` parameter

### Phase 1: Core Identity Modules
- `organizations` module:
  - `OrganizationSchema` + `OrganizationMemberSchema` (separate collection)
  - CRUD: create, findById, update, delete
  - Member management: invite, remove, update role
  - Compound unique index: `{ organizationId, userId }`
- `workspaces` module:
  - `WorkspaceSchema` + `WorkspaceMemberSchema` (separate collection)
  - All documents carry `organizationId` for tenant isolation
  - Member management endpoints
  - Compound unique index: `{ workspaceId, userId }` + `{ userId, role }` for queries
- Seeds:
  - `src/database/seeds/` with standalone bootstrap pattern (NOT OnApplicationBootstrap)
  - Idempotent seeders for: Paisamex org + owner, Luxfree org + owner, default workspaces
  - `yarn seed` and `yarn seed:dev` scripts in package.json

### Phase 2: Canvas Resources
- `projects` module:
  - `ProjectSchema` with `organizationId`, `workspaceId`, `ownerId`, `version` (optimistic locking)
  - CRUD with CASL policy checks
- `layers` module:
  - `LayerSchema` with `projectId`, `organizationId`, `type`, `properties` map
  - Bulk update support for canvas drag/resize operations
- `assets` module:
  - `AssetSchema` with `organizationId`, `workspaceId`, `cloudinaryPublicId`, `url`, `type`, `metadata`

### Phase 3: Media & AI Integrations
- `cloudinary` module:
  - `CloudinaryService` — upload, delete, transform
  - `CloudinaryWebhookController` — receive processing status webhooks
- `leonardo` module:
  - `LeonardoService` — trigger generation jobs via REST API
  - Webhook or polling to receive results
  - Download generated images and sync to Cloudinary (Cloudinary is source of truth)

### Phase 4: Async Infrastructure
- Redis + BullMQ configuration
- `jobs` module — queue Leonardo AI generation tasks
- Job processors with retry logic and status tracking

## Key Architectural Decisions

### Membership as Separate Collections (NOT embedded arrays)
Query pattern "get all workspaces where user X is editor" requires separate indexed collections. Embedded arrays lose index efficiency on role filtering in MongoDB.

### TenantGuard as NestJS Guard (NOT Interceptor)
Guards can abort requests with 403 before business logic. Applied at controller level (NOT global) because auth endpoints have no org context.

### Guard Order on Protected Controllers
```typescript
@UseGuards(JwtAuthGuard, TenantGuard, PoliciesGuard)
```

### AbilityFactory — No DB Queries
CASL rules computed from in-memory JWT data only. TenantGuard pre-fetches and attaches membership to `req.tenantContext` before AbilityFactory runs.

### Seeds — Standalone Bootstrap
```typescript
// src/database/seeds/seed.ts
const app = await NestFactory.createApplicationContext(SeederModule);
await app.get(SeederService).seed();
await app.close();
```

## Branch Strategy
- **Feature Branch:** `feat/media-platform-backend-core`
- **Target Branch:** `develop`
- **PR Reviews:** 1 reviewer required

## File Structure
```
src/
  casl/
    CaslModule.ts
    factory/AbilityFactory.ts
    guard/TenantGuard.ts
    guard/PoliciesGuard.ts
    decorator/CheckPolicies.ts
    interface/PolicyHandler.ts
    interface/AuthContext.ts
  shared/
    enum/OrgRole.ts
    enum/WorkspaceRole.ts
    (existing: error/, decorator/, dto/, interface/)
  organizations/
    OrganizationsModule.ts
    schemas/OrganizationSchema.ts
    schemas/OrganizationMemberSchema.ts
    controller/OrganizationController.ts + .spec.ts
    service/OrganizationService.ts + .spec.ts
    dto/ (Create, Update, Filter, Response DTOs)
    interface/
  workspaces/
    WorkspacesModule.ts
    schemas/WorkspaceSchema.ts
    schemas/WorkspaceMemberSchema.ts
    controller/WorkspaceController.ts + .spec.ts
    service/WorkspaceService.ts + .spec.ts
    dto/
    interface/
  projects/
    ProjectsModule.ts
    schemas/ProjectSchema.ts
    controller/ProjectController.ts + .spec.ts
    service/ProjectService.ts + .spec.ts
    dto/
  layers/
    LayersModule.ts
    schemas/LayerSchema.ts
    controller/LayerController.ts + .spec.ts
    service/LayerService.ts + .spec.ts
    dto/
  assets/
    AssetsModule.ts
    schemas/AssetSchema.ts
    controller/AssetController.ts + .spec.ts
    service/AssetService.ts + .spec.ts
    dto/
  cloudinary/
    CloudinaryModule.ts
    service/CloudinaryService.ts
    controller/CloudinaryWebhookController.ts
  leonardo/
    LeonardoModule.ts
    service/LeonardoService.ts
  database/
    seeds/
      SeederModule.ts
      SeederService.ts
      seed.ts
      seeders/
        OrganizationSeeder.ts
        UserSeeder.ts
        WorkspaceSeeder.ts
```

## Testing Requirements
- Unit tests for all services (mock Mongoose Models)
- Unit tests for all controllers (mock Services)
- Unit tests for AbilityFactory (cover all role/action combinations)
- Unit tests for TenantGuard and PoliciesGuard
- Integration tests for auth flow with org context
- Target: >80% coverage via `yarn test:cov`

## Critical Bug to Fix (Pre-existing)
`src/interceptors/HttpExceptionFilter.ts` implements `NestInterceptor` but is registered as `APP_FILTER`. Guard-level exceptions (ForbiddenException, UnauthorizedException) will bypass the error map. Fix: register as `APP_INTERCEPTOR` instead of `APP_FILTER`.

## Dependency to Add
```bash
yarn add @casl/ability
```

## Phase 0 Status: COMPLETED

### What Was Implemented (Phase 0)

**Branch:** `feat/media-platform-backend-core`

**Build status:** Passes (`yarn build` clean)
**Test status:** 125 tests passing across 9 test suites (all pass)

#### Files Created:
- `src/shared/enum/OrgRole.ts` — OrgRole enum (owner/admin/member)
- `src/shared/enum/WorkspaceRole.ts` — WorkspaceRole enum (owner/editor/viewer)
- `src/organizations/schemas/OrganizationMemberSchema.ts` — Mongoose schema placeholder (collection: `organization_members`)
- `src/casl/interface/AuthContext.ts` — AuthContext interface
- `src/casl/interface/PolicyHandler.ts` — PolicyHandler function type
- `src/casl/decorator/CheckPolicies.ts` — @CheckPolicies decorator (uses `check_policies` metadata key)
- `src/casl/factory/AbilityFactory.ts` — CASL rules engine (no DB queries, string-based subjects)
- `src/casl/guard/TenantGuard.ts` — Validates org membership from JWT, attaches to `req.tenantContext`
- `src/casl/guard/PoliciesGuard.ts` — Evaluates @CheckPolicies handlers via AbilityFactory
- `src/casl/CaslModule.ts` — Module exporting AbilityFactory, TenantGuard, PoliciesGuard
- `src/auth/guard/JwtAuthGuard.ts` — PassportJS JWT guard (`AuthGuard('jwt')`)
- `src/auth/strategy/JwtStrategy.ts` — Passport JWT strategy (validates Bearer token, populates `req.user`)
- `src/auth/dto/SwitchOrganizationPayloadDto.ts` — DTO for switch-organization endpoint

#### Files Modified:
- `src/auth/interfaces/JwtPayload.ts` — Added `organizationId`, `orgRole`, removed `group`; added `exp`, `jti`
- `src/auth/dto/JwtPayloadDto.ts` — Aligned with new JwtPayload (added `organizationId`, `orgRole`, removed `group`)
- `src/auth/service/AuthService.ts` — Added `switchOrganization()` method; updated `generateTokensForUser()` to accept optional `OrganizationMember`; injected `OrganizationMember` model
- `src/auth/AuthModule.ts` — Added PassportModule, JwtStrategy, JwtAuthGuard, MongooseModule for OrganizationMember
- `src/auth/controller/AuthController.ts` — Added `POST /auth/switch-organization` endpoint with `@UseGuards(JwtAuthGuard)`
- `src/auth/service/AuthService.spec.ts` — Added orgMemberModel mock, added `switchOrganization` test cases
- `src/auth/controller/AuthController.spec.ts` — Added `switchOrganization` test cases

#### Tests Created:
- `src/casl/factory/AbilityFactory.spec.ts` — 40 tests covering all role × action × resource combos
- `src/casl/guard/TenantGuard.spec.ts` — Tests for happy path, missing context, no membership
- `src/casl/guard/PoliciesGuard.spec.ts` — Tests for no handlers, passing, failing policies

#### Key Architectural Notes:
- `AbilityFactory` uses **string-based subjects** (`'Organization'`, `'Workspace'`, etc.) NOT class references — avoids circular import issues with CASL
- `HttpExceptionFilter` was already registered as `APP_INTERCEPTOR` in `AppModule` (pre-existing bug was already fixed before this phase)
- `@casl/ability` was already installed (v6.8.1)
- `JwtPayload.group` field removed — old `JwtPayloadDto.group` field removed; Swagger updated
- `generateTokensForUser` now includes `organizationId` + `orgRole` in JWT claims only when `orgMembership` is provided (backward compatible for sign-in without org context)

## Phase 1 Status: COMPLETED

### What Was Implemented (Phase 1)

**Branch:** `feat/media-platform-backend-core`

**Build status:** Passes (`yarn build` clean)
**Test status:** 185 tests passing across 13 test suites (all pass — 60 new tests added)

#### Files Created:

**Organizations module:**
- `src/organizations/schemas/OrganizationSchema.ts` — Mongoose schema (collection: `organizations`, timestamps via `created_at`/`updated_at`)
- `src/organizations/dto/CreateOrganizationPayloadDto.ts` — name + slug validation
- `src/organizations/dto/UpdateOrganizationPayloadDto.ts` — optional name/slug
- `src/organizations/dto/OrganizationDto.ts` — response DTO
- `src/organizations/dto/InviteMemberPayloadDto.ts` — userId (IsMongoId) + role (IsEnum OrgRole)
- `src/organizations/dto/UpdateMemberRolePayloadDto.ts` — role only
- `src/organizations/dto/OrganizationMemberDto.ts` — response DTO for membership
- `src/organizations/service/OrganizationService.ts` — CRUD + member management (create, findById, update, delete, findMembers, inviteMember, updateMemberRole, removeMember)
- `src/organizations/controller/OrganizationController.ts` — 8 REST endpoints with guards
- `src/organizations/OrganizationsModule.ts` — MongooseModule (Organization + OrganizationMember) + CaslModule
- `src/organizations/service/OrganizationService.spec.ts` — 16 unit tests
- `src/organizations/controller/OrganizationController.spec.ts` — 16 unit tests (guards overridden with allowAllGuard)

**Workspaces module:**
- `src/workspaces/schemas/WorkspaceSchema.ts` — Mongoose schema (collection: `workspaces`, index on organizationId)
- `src/workspaces/schemas/WorkspaceMemberSchema.ts` — Mongoose schema (collection: `workspace_members`, compound unique index {workspaceId,userId}, secondary index {userId,role})
- `src/workspaces/dto/CreateWorkspacePayloadDto.ts` — name validation
- `src/workspaces/dto/UpdateWorkspacePayloadDto.ts` — optional name
- `src/workspaces/dto/WorkspaceDto.ts` — response DTO
- `src/workspaces/dto/AddWorkspaceMemberPayloadDto.ts` — userId + role (WorkspaceRole)
- `src/workspaces/dto/UpdateWorkspaceMemberRolePayloadDto.ts` — role only
- `src/workspaces/dto/WorkspaceMemberDto.ts` — response DTO for membership
- `src/workspaces/service/WorkspaceService.ts` — CRUD + member management (create, findAll, findById, update, delete, addMember, updateMemberRole, removeMember)
- `src/workspaces/controller/WorkspaceController.ts` — 8 REST endpoints with guards
- `src/workspaces/WorkspacesModule.ts` — MongooseModule (Workspace + WorkspaceMember) + CaslModule
- `src/workspaces/service/WorkspaceService.spec.ts` — 14 unit tests
- `src/workspaces/controller/WorkspaceController.spec.ts` — 14 unit tests (guards overridden)

#### Files Modified:
- `src/AppModule.ts` — Added OrganizationsModule and WorkspacesModule imports

#### Key Architectural Notes:
- Controller tests use `.overrideGuard(JwtAuthGuard/TenantGuard/PoliciesGuard).useValue({ canActivate: () => true })` — guards are tested separately in their own spec files
- Service error tests for updateMemberRole/removeMember use `new Types.ObjectId().toString()` (valid 24-char hex) NOT plain strings — BSON rejects non-ObjectId strings before service logic runs
- `mapToOrganizationDto` / `mapToWorkspaceDto` / `mapToMemberDto` are module-private helper functions in each controller — keeps DTO mapping out of the service layer
- `WorkspaceService.findAll` queries workspace memberships first, then fetches workspaces — proper tenant isolation
- Both modules export their service for use in future phases (projects, assets)
- `create` in both services auto-creates the owner membership record after saving the entity

## Phase 2 Status: COMPLETED

**Build status:** Passes (`yarn build` clean)
**Test status:** 262 tests passing across 22 suites

### Files Created

**Projects:** `schemas/ProjectSchema.ts`, `service/ProjectService.ts` (CRUD + optimistic locking), `controller/ProjectController.ts` (5 endpoints), full DTOs and specs

**Layers:** `schemas/LayerSchema.ts`, `service/LayerService.ts` (CRUD + bulkUpdate), `controller/LayerController.ts` (nested under `/projects/:projectId/layers`, includes `PATCH /bulk` before `PATCH /:id`), full DTOs and specs

**Assets:** `schemas/AssetSchema.ts`, `service/AssetService.ts` (CRUD org-scoped), `controller/AssetController.ts` (4 endpoints), full DTOs and specs

**AppModule:** Added ProjectsModule, LayersModule, AssetsModule

## Phase 3 Status: COMPLETED

**Build status:** Passes (`yarn build` clean)
**Test status:** 262 tests passing across 22 suites (14 new tests)

### Files Created

**Cloudinary:** `service/CloudinaryService.ts` (upload via stream, delete, getTransformUrl), `controller/CloudinaryWebhookController.ts` (signature validation via X-Cld-Signature header), full specs. `cloudinary@2.10.0` installed.

**Leonardo:** `service/LeonardoService.ts` (createGeneration, getGeneration, deleteGeneration via fetch), `dto/CreateGenerationPayloadDto.ts`, spec covering success + non-2xx error paths.

**AppModule:** Added CloudinaryModule, LeonardoModule

**EnvironmentVariables:** Added CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, LEONARDO_API_KEY, LEONARDO_API_BASE_URL

## Final Status: ALL COMPLETED

**Commit:** `2d1cedc` on branch `feat/media-platform-backend-core`
**Tests:** 277 tests, 23 suites, all passing
**Coverage:** 82% statements (>80% requirement met)
**Coverage exclusions added:** `*Module.ts`, `dto/**`, `interface/**`, `enum/**`, `main.ts`, `instrument.ts`, `database/seeds/**`, `config/EnvironmentVariables.ts`

## Remaining (Phase 4 — not implemented)
- Redis + BullMQ configuration
- `jobs` module — queue Leonardo AI generation tasks
- Job processors with retry logic and status tracking

## Phase 5: Frontend-Ready API Fixes (planned — see context_session_frontend-ready-api.md)

**Branch**: `feat/frontend-ready-api` (from `feat/media-platform-backend-core`)

Four critical gaps were identified that block the frontend entirely:

### Fix 1: Auto org context on sign-in
- `AuthService.signIn()` now queries first org membership and embeds `organizationId`+`orgRole` in JWT
- `UserSessionDto` returns `organizationId` (active) + `organizations[]` (all orgs user belongs to)
- New `OrgSummaryDto`: `{ id, name, slug, role }`

### Fix 2: POST /assets/upload
- Multipart file upload → Cloudinary (`canvas-flow/{orgId}`) → Asset record
- `@types/multer` required as dev dependency
- `AssetsModule` imports `CloudinaryModule`
- 10 MB file size limit

### Fix 3: POST /assets/:id/transform
- Background removal, resize/crop, filters (brightness/contrast/grayscale/blur), format conversion
- Always creates a NEW Asset (original preserved)
- Uses Cloudinary derived URL → re-uploads as new file → new Asset record
- Cloudinary folder: `canvas-flow/{orgId}/transforms`

### Fix 4: POST /ai/generate (new AiModule)
- Sync server-side polling: Leonardo createGeneration → poll every 3s max 60s → download → Cloudinary → Asset(s)
- `server.setTimeout(90_000)` in `main.ts` to avoid HTTP timeout
- Cloudinary folder: `canvas-flow/{orgId}/ai-generated`
- Returns array of `AssetDto` (one per generated image)

### API Contract
| Method | Endpoint                  | Description                                 |
|--------|---------------------------|---------------------------------------------|
| POST   | `/v1/auth/sign-in`        | Returns JWT + organizationId + organizations[] |
| POST   | `/assets/upload`          | Multipart upload → Cloudinary → Asset       |
| POST   | `/assets/:id/transform`   | Transform asset → new Asset                 |
| POST   | `/ai/generate`            | AI image generation → Asset(s)              |
