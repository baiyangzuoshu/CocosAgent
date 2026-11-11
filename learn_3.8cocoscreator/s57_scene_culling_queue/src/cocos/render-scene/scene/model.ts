export interface RenderPass {
  phase: string;
  transparent: boolean;
  hash: number;
  depth: number;
  shaderId: number;
}

export interface Model {
  name: string;
  enabled: boolean;
  nodeLayer: number;
  visFlags: number;
  inFrustum: boolean;
  priority: number;
  passes: RenderPass[];
}
