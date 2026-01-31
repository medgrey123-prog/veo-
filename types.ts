export interface SceneState {
  id: string;
  index: number;
  startImage: string; // Base64
  endImage: string;   // Base64
  script: string;
  
  // New Director Controls
  movementDescription: string;
  expressionDescription: string;

  // Analysis Data
  recommendedDuration: string | null; // e.g. "4.5s"

  // Settings
  targetResolution: '1080p' | '4k';

  // New fields for image regeneration
  endFrameActionPrompt: string; 
  isRegeneratingImage: boolean;

  generatedVideoUrl?: string;
  isProcessing: boolean;
  status: 'idle' | 'analyzing_script' | 'generating_video' | 'complete' | 'error';
  errorMessage?: string;
}

export type ImageGenerationModel = 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image';

export interface GenerationConfig {
  mainImage: string | null;
  faceReference: string | null;
  numFrames: number;
  selectedModel: ImageGenerationModel;
  poseDescription: string; // New field for global pose constraint
}

export interface AppState {
  step: 'upload' | 'generating_frames' | 'sequencing';
  config: GenerationConfig;
  scenes: SceneState[];
  isApiKeySelected: boolean;
}