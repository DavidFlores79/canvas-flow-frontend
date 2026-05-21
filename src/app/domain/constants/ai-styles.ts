export type AiStyleId = 'photorealistic' | 'hyperrealistic' | 'anime' | 'comic' | 'pixelart';
export type AiSizePresetId = 'square' | 'landscape-16-9' | 'portrait-9-16' | 'landscape-4-3' | 'portrait-3-4';

export interface AiStyle {
  id: AiStyleId;
  label: string;
  description: string;
  modelId: string;
  presetStyle?: string;
  promptPrefix?: string;
}

export interface AiSizePreset {
  id: AiSizePresetId;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

export const AI_STYLES: AiStyle[] = [
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    description: 'Natural photography look',
    modelId: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3',
  },
  {
    id: 'hyperrealistic',
    label: 'Hyperrealistic',
    description: 'Ultra-detailed, HDR quality',
    modelId: '7b592283-e8a7-4c5a-9ba6-d18c31f258b9',
  },
  {
    id: 'anime',
    label: 'Anime / Manga',
    description: 'Japanese animation style',
    modelId: 'e71a1c2f-4f80-4800-934f-2c68979d8cc8',
  },
  {
    id: 'comic',
    label: 'Comic / Cartoon',
    description: 'Illustrated, graphic novel style',
    modelId: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3',
    presetStyle: 'ILLUSTRATION',
  },
  {
    id: 'pixelart',
    label: 'Pixel Art',
    description: '8-bit retro game style',
    modelId: '7b592283-e8a7-4c5a-9ba6-d18c31f258b9',
    promptPrefix: 'pixel art, 8-bit, ',
  },
];

export const AI_SIZE_PRESETS: AiSizePreset[] = [
  { id: 'square', label: 'Square', ratio: '1:1', width: 1024, height: 1024 },
  { id: 'landscape-16-9', label: 'Landscape', ratio: '16:9', width: 1344, height: 768 },
  { id: 'portrait-9-16', label: 'Portrait', ratio: '9:16', width: 768, height: 1344 },
  { id: 'landscape-4-3', label: 'Landscape', ratio: '4:3', width: 1024, height: 768 },
  { id: 'portrait-3-4', label: 'Portrait', ratio: '3:4', width: 768, height: 1024 },
];
