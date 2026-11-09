export interface TextBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface Message {
  readonly role: string;
  readonly content: readonly TextBlock[];
}

export type SurfaceOp = 'append' | {
  readonly op: 'replace';
  readonly startSeq: number;
  readonly endSeq: number;
};

export interface EventInput {
  readonly type: string;
  readonly data: unknown;
  readonly surfaceOp?: SurfaceOp;
  readonly sourceEventSeqs?: readonly number[];
}

export interface SessionEvent extends EventInput {
  readonly seq: number;
  readonly time: number;
}

export interface SurfaceReplacement {
  readonly seq: number;
  readonly shadowedSeqs: readonly number[];
}

export interface SurfaceFold {
  readonly nodes: readonly number[];
  readonly replacements: readonly SurfaceReplacement[];
}

export interface SearchResult {
  readonly seq: number;
  readonly type: string;
  readonly surface: 'current' | 'shadowed' | 'log-only';
  readonly text: string;
}

export interface PricedNode {
  readonly seq: number;
  readonly text: string;
  readonly units: number;
}

export interface Measurement {
  readonly nodes: readonly PricedNode[];
  readonly totalUnits: number;
}
