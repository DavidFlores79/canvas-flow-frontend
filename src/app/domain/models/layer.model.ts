export interface LayerTransforms {
  removeBackground?: boolean;
  brightness?: number;
  contrast?: number;
  blur?: number;
  grayscale?: boolean;
  format?: 'original' | 'jpg' | 'png' | 'webp' | 'avif';
  width?: number;
  height?: number;
}

export interface LayerProperties {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly zIndex: number;
  readonly transforms?: LayerTransforms;
}

export interface Layer {
  readonly id: string;
  readonly type: 'text' | 'image' | 'shape';
  readonly properties: LayerProperties;
  readonly assetId?: string;
  readonly content?: string;
}
