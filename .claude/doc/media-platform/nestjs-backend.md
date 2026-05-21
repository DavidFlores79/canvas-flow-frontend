# NestJS Backend Implementation Plan: Canvas Flow Media Platform

## 1. Database Schema Design (MongoDB / Mongoose)

### Collection: `organizations`
```typescript
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'organizations' })
export class Organization {
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: String, required: true, unique: true, trim: true }) slug: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) ownerId: Types.ObjectId;
}
```

### Collection: `organization_members`
```typescript
@Schema({ timestamps: true, collection: 'organization_members' })
export class OrganizationMember {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true }) organizationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: String, required: true, enum: OrgRole }) role: OrgRole;
}
// Compound unique index: { organizationId: 1, userId: 1 }
```

### Collection: `workspaces`
```typescript
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'workspaces' })
export class Workspace {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true }) organizationId: Types.ObjectId;
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) ownerId: Types.ObjectId;
}
```

### Collection: `workspace_members`
```typescript
@Schema({ timestamps: true, collection: 'workspace_members' })
export class WorkspaceMember {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true }) workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: String, required: true, enum: WorkspaceRole }) role: WorkspaceRole;
}
// Compound unique index: { workspaceId: 1, userId: 1 }
// Additional index: { userId: 1, role: 1 } for "find all workspaces where user is editor"
```

### Collection: `projects`
```typescript
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'projects' })
export class Project {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true }) organizationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true }) workspaceId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) ownerId: Types.ObjectId;
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: Number, default: 800 }) width: number;
  @Prop({ type: Number, default: 600 }) height: number;
  @Prop({ type: Number, default: 0 }) version: number;
}
```

### Collection: `layers`
```typescript
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'layers' })
export class Layer {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true }) projectId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true }) organizationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Asset' }) assetId?: Types.ObjectId;
  @Prop({ type: String, required: true, enum: ['text', 'image', 'shape'] }) type: string;
  @Prop({ type: Map, of: Object }) properties: Map<string, unknown>;
}
```

### Collection: `assets`
```typescript
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'assets' })
export class Asset {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true }) organizationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true }) workspaceId: Types.ObjectId;
  @Prop({ type: String, required: true }) cloudinaryPublicId: string;
  @Prop({ type: String, required: true }) url: string;
  @Prop({ type: String, required: true, enum: ['image', 'video', 'document'] }) type: string;
  @Prop({ type: Map, of: Object }) metadata: Map<string, unknown>;
}
```

---

## 2. Enums

```typescript
// src/shared/enum/OrgRole.ts
export enum OrgRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
}

// src/shared/enum/WorkspaceRole.ts
export enum WorkspaceRole {
  Owner = 'owner',
  Editor = 'editor',
  Viewer = 'viewer',
}
```

---

## 3. JWT Payload (Updated)

```typescript
// src/auth/interfaces/JwtPayload.ts
export interface JwtPayload {
  sub: string;             // userId
  organizationId: string;  // active org ObjectId
  orgRole: OrgRole;        // owner | admin | member
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  jti: string;
}
```

New endpoint: `POST /auth/switch-organization` — accepts `{ organizationId }`, verifies membership, re-issues token pair.

---

## 4. CASL Module Structure

### AbilityFactory
```typescript
// src/casl/factory/AbilityFactory.ts
export interface AuthContext {
  userId: string;
  organizationId: string;
  orgRole: OrgRole;
  workspaceRole?: WorkspaceRole;
}

@Injectable()
export class AbilityFactory {
  createForContext(ctx: AuthContext): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (ctx.orgRole === OrgRole.Owner) {
      can('manage', 'all');
    }

    if (ctx.orgRole === OrgRole.Admin) {
      can('manage', Organization, { _id: ctx.organizationId });
      can('manage', Workspace);
      can('manage', Project);
      can('manage', Layer);
      can('manage', Asset);
      can('invite', Organization);
      cannot('delete', Organization);
    }

    if (ctx.orgRole === OrgRole.Member) {
      can('read', Organization, { _id: ctx.organizationId });
      can('create', Workspace);
    }

    if (ctx.workspaceRole === WorkspaceRole.Owner) {
      can('manage', Workspace);
      can('manage', Project);
      can('manage', Layer);
      can('manage', Asset);
    }

    if (ctx.workspaceRole === WorkspaceRole.Editor) {
      can('read', Workspace);
      can(['create', 'read', 'update'], Project);
      can('manage', Layer);
      can('manage', Asset);
      cannot('delete', Workspace);
      cannot('delete', Project);
    }

    if (ctx.workspaceRole === WorkspaceRole.Viewer) {
      can('read', [Workspace, Project, Layer, Asset]);
    }

    return build({ detectSubjectType: (s) => s.constructor as any });
  }
}
```

### TenantGuard
```typescript
// src/casl/guard/TenantGuard.ts
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { sub, organizationId } = request.user;

    const membership = await this.memberModel.findOne({
      userId: new Types.ObjectId(sub),
      organizationId: new Types.ObjectId(organizationId),
    }).lean().exec();

    if (!membership) throw new ForbiddenException('Not a member of this organization');

    request.tenantContext = membership;
    return true;
  }
}
```

### Controller Usage Pattern
```typescript
@UseGuards(JwtAuthGuard, TenantGuard, PoliciesGuard)
@CheckPolicies((ability: AppAbility) => ability.can('delete', Project))
@Delete(':id')
async deleteProject(@Param('id') id: string) { ... }
```

---

## 5. Seeds Pattern

```
src/database/seeds/
  SeederModule.ts       # Imports DatabaseModule + all schema modules
  SeederService.ts      # Orchestrates all seeders
  seed.ts               # CLI entry point (ts-node)
  seeders/
    OrganizationSeeder.ts
    UserSeeder.ts
    WorkspaceSeeder.ts
```

**Seed data:**
- Paisamex organization + owner user + "Default" workspace
- Luxfree organization + owner user + "Default" workspace

**Package.json scripts to add:**
```json
"seed": "ts-node -r tsconfig-paths/register src/database/seeds/seed.ts",
"seed:dev": "DEPLOY_ENV=local pnpm seed"
```

All seeders must be **idempotent** (check before insert).

---

## 6. API Endpoints

### Auth (additions to existing)
- `POST /auth/switch-organization` — re-issue tokens for a different org

### Organizations
- `POST /organizations` — create org (auto-assigns caller as owner)
- `GET /organizations/:id` — get org details
- `PATCH /organizations/:id` — update org
- `DELETE /organizations/:id` — delete org (owner only)
- `GET /organizations/:id/members` — list members
- `POST /organizations/:id/members` — invite member
- `PATCH /organizations/:id/members/:userId` — update member role
- `DELETE /organizations/:id/members/:userId` — remove member

### Workspaces
- `POST /workspaces` — create workspace in active org
- `GET /workspaces` — list workspaces in active org (filtered by membership)
- `GET /workspaces/:id` — get workspace details
- `PATCH /workspaces/:id` — update workspace
- `DELETE /workspaces/:id` — delete workspace
- `POST /workspaces/:id/members` — add member
- `PATCH /workspaces/:id/members/:userId` — update member role
- `DELETE /workspaces/:id/members/:userId` — remove member

### Projects
- `POST /projects` — create project in workspace
- `GET /projects` — list projects in workspace (query param: `workspaceId`)
- `GET /projects/:id` — get project
- `PATCH /projects/:id` — update project (version check for optimistic locking)
- `DELETE /projects/:id` — delete project

### Layers
- `POST /projects/:projectId/layers` — create layer
- `GET /projects/:projectId/layers` — list layers
- `PATCH /projects/:projectId/layers/:id` — update layer
- `DELETE /projects/:projectId/layers/:id` — delete layer

### Assets
- `POST /assets/upload` — upload to Cloudinary
- `GET /assets` — list assets in workspace
- `DELETE /assets/:id` — delete asset

---

## 7. Error Handling
Use existing custom errors from `src/shared/error/`:
- `NotFoundEntityError` — org/workspace/project not found
- `DuplicateEntityError` — duplicate slug, duplicate membership
- `OutdatedEntityVersionError` — version mismatch on project update

---

## 8. Testing Requirements
- **Service tests**: Mock Mongoose Models via `getModelToken()`
- **Controller tests**: Mock Services. Test CASL policy enforcement.
- **AbilityFactory tests**: Cover all role × action × resource combinations
- **TenantGuard tests**: Test missing membership throws ForbiddenException
- **Target coverage**: >80% via `pnpm test:cov`

---

## 9. Critical Pre-existing Bug to Fix
`src/interceptors/HttpExceptionFilter.ts` implements `NestInterceptor` but `AppModule` registers it as `APP_FILTER`. Guard-thrown exceptions (ForbiddenException, UnauthorizedException) will bypass the custom error map.

**Fix**: In `AppModule`, change `APP_FILTER` to `APP_INTERCEPTOR` for `HttpExceptionFilter`.

---

## 10. New Dependency
```bash
pnpm add @casl/ability
```
