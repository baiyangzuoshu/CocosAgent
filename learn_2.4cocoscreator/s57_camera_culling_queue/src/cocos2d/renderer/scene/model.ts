export interface Model {
  name: string;
  cullingMask: number;
  stages: readonly string[];
  cameraDepth: number;
}
