export const CURRENT_FORMAT_VERSION = 3;

export interface SessionHeader {
  readonly type: 'session';
  readonly version: typeof CURRENT_FORMAT_VERSION;
  readonly id: string;
  readonly createdAt: number;
  readonly isSeeded: false;
  readonly delegationDepth: 0;
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

export interface StoredSession {
  readonly header: SessionHeader;
  readonly events: readonly SessionEvent[];
  readonly validBytes: number;
  readonly tornTailBytes: number;
}
