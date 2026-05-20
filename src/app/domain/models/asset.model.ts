export interface Asset {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly cloudinaryPublicId: string;
  readonly url: string;
  readonly type: 'image' | 'video' | 'document';
  readonly metadata?: Record<string, unknown>;
}

export interface TransformPayload {
  workspaceId: string;
  removeBackground?: boolean;
  width?: number;
  height?: number;
  brightness?: number;
  contrast?: number;
  grayscale?: boolean;
  blur?: number;
  format?: 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'tiff';
}

export interface AiGeneratePayload {
  prompt: string;
  modelId: string;
  workspaceId: string;
  width?: number;
  height?: number;
  numImages?: number;
}
