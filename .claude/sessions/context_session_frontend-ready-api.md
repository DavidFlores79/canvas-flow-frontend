# Context Session: Frontend-Ready API Fixes

## Problem Statement
The Canvas Flow backend has 4 critical gaps that block the frontend completely:

1. **No org context on sign-in** — JWT has no `organizationId`/`orgRole`, so every org-scoped endpoint returns 403
2. **No file upload endpoint** — `POST /assets` requires a pre-existing Cloudinary public ID; frontend has no way to upload files
3. **No transform endpoint** — Cloudinary transformations (bg removal, resize, filters, format) unreachable from HTTP
4. **No AI generation endpoint** — `LeonardoService` has no controller; AI image generation impossible

## Branch Strategy
- **Branch**: `feat/frontend-ready-api`
- **Base branch**: `feat/media-platform-backend-core` (branch from here, not develop — changes build on Phase 3)
- **Target branch**: `develop`
- **PR**: 1 reviewer required

---

## Fix 1: Auto org context on sign-in

**Decision**: Auto-select first org membership (ordered by `_id` asc) AND return full org list in session response (Option C).

### Files to modify
- `src/auth/service/AuthService.ts` — query first org membership after password check; pass to `generateTokensForUser()`; query all memberships for session response
- `src/auth/dto/UserSessionDto.ts` — add `organizationId?: string` and `organizations?: OrgSummaryDto[]`
- `src/auth/dto/OrgSummaryDto.ts` — NEW: `{ id, name, slug, role }`
- `src/auth/service/AuthService.spec.ts` — update signIn tests

### Implementation detail
```typescript
// In AuthService.signIn(), after password check:
const memberships = await this.orgMemberModel
  .find({ userId: new Types.ObjectId(user.id) })
  .populate('organizationId')  // if needed for name/slug
  .sort({ _id: 1 })
  .lean()
  .exec();

const firstMembership = memberships[0] ?? undefined;

const { accessToken, refreshToken, kid } = await this.generateTokensForUser(
  user,
  undefined,
  firstMembership,
);

// Build session response
userSession.organizationId = firstMembership?.organizationId?.toString();
userSession.organizations = memberships.map(m => ({
  id: m.organizationId.toString(),
  role: m.role,
}));
```

**Note**: `orgMemberModel` is already injected in `AuthService` constructor. No new dependency needed.

**UserSessionDto additions**:
```typescript
@ApiPropertyOptional({ description: 'Active organization ID embedded in JWT' })
organizationId?: string;

@ApiPropertyOptional({ type: [OrgSummaryDto], description: 'All orgs the user belongs to' })
organizations?: OrgSummaryDto[];
```

---

## Fix 2: File upload endpoint

**Endpoint**: `POST /assets/upload` (multipart/form-data)

### Files to modify
- `src/assets/controller/AssetController.ts` — add `upload()` action with `FileInterceptor`
- `src/assets/service/AssetService.ts` — add `upload(file, dto, orgId)` method
- `src/assets/dto/UploadAssetPayloadDto.ts` — NEW
- `src/assets/AssetsModule.ts` — import `CloudinaryModule`
- `src/assets/controller/AssetController.spec.ts` — add upload tests
- `src/assets/service/AssetService.spec.ts` — add upload tests

### DTO
```typescript
// src/assets/dto/UploadAssetPayloadDto.ts
export class UploadAssetPayloadDto {
  @IsMongoId()
  workspaceId: string;

  @IsOptional()
  @IsIn(['image', 'video', 'document'])
  type?: string; // fallback: derived from Cloudinary resourceType
}
```

### Controller endpoint
```typescript
@Post('upload')
@HttpCode(HttpStatus.CREATED)
@UseGuards(JwtAuthGuard, TenantGuard, PoliciesGuard)
@CheckPolicies((a: AppAbility) => a.can('create', 'Asset'))
@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
@ApiConsumes('multipart/form-data')
async upload(
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: UploadAssetPayloadDto,
  @Request() req: RequestWithUser,
): Promise<AssetDto>
```

### Service method
```typescript
async upload(file: Express.Multer.File, dto: UploadAssetPayloadDto, orgId: string): Promise<Asset> {
  const uploaded = await this.cloudinaryService.uploadFile(file, `canvas-flow/${orgId}`);
  return this.create({
    workspaceId: dto.workspaceId,
    cloudinaryPublicId: uploaded.publicId,
    url: uploaded.url,
    type: dto.type ?? uploaded.resourceType ?? 'image',
  }, orgId);
}
```

### Gotchas
- `pnpm add -D @types/multer` required for `Express.Multer.File` type
- Cloudinary folder: `canvas-flow/{orgId}` — scoped per tenant
- Memory storage (default) is correct since `CloudinaryService.uploadFile` reads `file.buffer`
- 10 MB file size limit via `FileInterceptor` options

---

## Fix 3: Image transform endpoint

**Endpoint**: `POST /assets/:id/transform`
**Behavior**: Always creates a NEW Asset (original preserved)

### Files to modify
- `src/assets/controller/AssetController.ts` — add `transform()` action
- `src/assets/service/AssetService.ts` — add `transform(id, dto, orgId)` method
- `src/cloudinary/service/CloudinaryService.ts` — add `fetchAndReupload(url, folder)` helper OR handle fetch inline in AssetService
- `src/assets/dto/TransformAssetPayloadDto.ts` — NEW
- Specs for both

### DTO
```typescript
// src/assets/dto/TransformAssetPayloadDto.ts
export class TransformAssetPayloadDto {
  @IsMongoId()
  workspaceId: string;

  @IsOptional() @IsBoolean()
  removeBackground?: boolean;       // e_background_removal

  @IsOptional() @IsInt() @Min(1)
  width?: number;

  @IsOptional() @IsInt() @Min(1)
  height?: number;

  @IsOptional() @IsIn(['fill', 'crop', 'scale', 'fit', 'thumb'])
  crop?: string;

  @IsOptional() @IsInt() @Min(-100) @Max(100)
  brightness?: number;              // e_brightness:N

  @IsOptional() @IsInt() @Min(-100) @Max(100)
  contrast?: number;                // e_contrast:N

  @IsOptional() @IsBoolean()
  grayscale?: boolean;              // e_grayscale

  @IsOptional() @IsInt() @Min(0) @Max(2000)
  blur?: number;                    // e_blur:N

  @IsOptional() @IsIn(['jpg', 'png', 'webp', 'avif'])
  format?: string;                  // f_X
}
```

### Cloudinary transform options builder (in AssetService)
```typescript
private buildTransformOptions(dto: TransformAssetPayloadDto): object {
  const effects: string[] = [];
  if (dto.removeBackground) effects.push('e_background_removal');
  if (dto.grayscale) effects.push('e_grayscale');
  if (dto.brightness !== undefined) effects.push(`e_brightness:${dto.brightness}`);
  if (dto.contrast !== undefined) effects.push(`e_contrast:${dto.contrast}`);
  if (dto.blur !== undefined) effects.push(`e_blur:${dto.blur}`);

  return {
    ...(dto.width && { width: dto.width }),
    ...(dto.height && { height: dto.height }),
    ...(dto.crop && { crop: dto.crop }),
    ...(dto.format && { fetch_format: dto.format }),
    ...(effects.length && { effect: effects.join(',') }),
    quality: 'auto',
  };
}
```

### Service method
```typescript
async transform(id: string, dto: TransformAssetPayloadDto, orgId: string): Promise<Asset> {
  const original = await this.findById(id);
  const transformOptions = this.buildTransformOptions(dto);
  const derivedUrl = this.cloudinaryService.getTransformUrl(
    original.cloudinaryPublicId, transformOptions
  );

  // Fetch derived bytes (native fetch, Node 18+)
  const response = await fetch(derivedUrl);
  if (!response.ok) throw new UnprocessableEntityException('Cloudinary transform failed');
  const buffer = Buffer.from(await response.arrayBuffer());

  const ext = dto.format ?? 'png';
  const uploaded = await this.cloudinaryService.uploadFile(
    { buffer, originalname: `transformed_${Date.now()}.${ext}`, mimetype: `image/${ext}` },
    `canvas-flow/${orgId}/transforms`,
  );

  return this.create({
    workspaceId: dto.workspaceId,
    cloudinaryPublicId: uploaded.publicId,
    url: uploaded.url,
    type: 'image',
    metadata: { sourceAssetId: id, transformations: dto as unknown as Record<string, unknown> },
  }, orgId);
}
```

### Gotcha: e_background_removal
- Cloudinary processes this async on first request — derived URL may return 423 on the first hit
- Mitigation: one retry after 2s delay before throwing. Document this limitation.

---

## Fix 4: AI generation endpoint

**New module**: `src/ai/`
**Endpoint**: `POST /ai/generate`
**Mode**: Synchronous server-side polling (60s max, 3s intervals)

### New files
- `src/ai/AiModule.ts`
- `src/ai/controller/AiController.ts`
- `src/ai/service/AiService.ts`
- `src/ai/dto/AiGeneratePayloadDto.ts`
- `src/ai/dto/AiGenerateResultDto.ts`
- `src/ai/controller/AiController.spec.ts`
- `src/ai/service/AiService.spec.ts`

### Files to modify
- `src/AppModule.ts` — import `AiModule`
- `src/main.ts` — `server.setTimeout(90_000)` to avoid HTTP timeout cutting 60s poll
- `src/leonardo/LeonardoModule.ts` — must export `LeonardoService`

### DTOs
```typescript
// src/ai/dto/AiGeneratePayloadDto.ts
export class AiGeneratePayloadDto {
  @IsString() @IsNotEmpty()
  prompt: string;

  @IsString() @IsNotEmpty()
  modelId: string;

  @IsMongoId()
  workspaceId: string;

  @IsOptional() @IsInt() @Min(32) @Max(1536)
  width?: number;

  @IsOptional() @IsInt() @Min(32) @Max(1536)
  height?: number;

  @IsOptional() @IsInt() @Min(1) @Max(4)
  numImages?: number;
}

// src/ai/dto/AiGenerateResultDto.ts
export class AiGenerateResultDto {
  @ApiProperty({ type: [AssetDto] })
  assets: AssetDto[];
}
```

### AiModule
```typescript
@Module({
  imports: [LeonardoModule, CloudinaryModule, AssetsModule, CaslModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
```

### AiService.generate() logic
```typescript
async generate(dto: AiGeneratePayloadDto, orgId: string): Promise<Asset[]> {
  const { generationId } = await this.leonardoService.createGeneration(
    dto.prompt, dto.modelId,
    { width: dto.width, height: dto.height, numImages: dto.numImages },
  );

  // Poll max 20 × 3s = 60s
  let result: LeonardoGenerationResult | null = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const poll = await this.leonardoService.getGeneration(generationId);
    if (poll.status === 'COMPLETE') { result = poll; break; }
    if (poll.status === 'FAILED') throw new UnprocessableEntityException('Leonardo generation failed');
  }
  if (!result) throw new UnprocessableEntityException('AI generation timed out');

  // Download each image, upload to Cloudinary, save Asset
  const assets: Asset[] = [];
  for (const img of result.images) {
    const resp = await fetch(img.url);
    const buffer = Buffer.from(await resp.arrayBuffer());
    const uploaded = await this.cloudinaryService.uploadFile(
      { buffer, originalname: `ai_${img.id}.jpg`, mimetype: 'image/jpeg' },
      `canvas-flow/${orgId}/ai-generated`,
    );
    const asset = await this.assetService.create({
      workspaceId: dto.workspaceId,
      cloudinaryPublicId: uploaded.publicId,
      url: uploaded.url,
      type: 'image',
      metadata: { generationId, leonardoImageId: img.id, prompt: dto.prompt } as Record<string, unknown>,
    }, orgId);
    assets.push(asset);
  }
  return assets;
}
```

---

## Cloudinary Folder Convention
| Content type        | Folder path                          |
|---------------------|--------------------------------------|
| User uploads        | `canvas-flow/{orgId}`                |
| Transformed images  | `canvas-flow/{orgId}/transforms`     |
| AI-generated images | `canvas-flow/{orgId}/ai-generated`   |

---

## API Contract Summary (for frontend)

| Method | Endpoint              | Auth         | Description                                 |
|--------|-----------------------|--------------|---------------------------------------------|
| POST   | `/v1/auth/sign-in`    | Public       | Returns JWT + organizationId + organizations[] |
| POST   | `/assets/upload`      | JWT+Tenant   | Multipart upload → Cloudinary → Asset       |
| POST   | `/assets/:id/transform` | JWT+Tenant | Transform existing asset → new Asset        |
| POST   | `/ai/generate`        | JWT+Tenant   | AI image generation → Asset(s)              |

---

## Testing Strategy
- All service methods: unit tests with mocked CloudinaryService, LeonardoService, AssetService
- All controller actions: unit tests with guards overridden
- Target: maintain >80% statement coverage
- `pnpm test:cov` before PR

---

## Dependencies to install
```bash
pnpm add -D @types/multer
```

---

## Status
- [x] Plan finalized
- [ ] Fix 1: Org context on sign-in
- [ ] Fix 2: Upload endpoint
- [ ] Fix 3: Transform endpoint
- [ ] Fix 4: AI generation endpoint
- [ ] Tests passing
- [ ] PR to develop
