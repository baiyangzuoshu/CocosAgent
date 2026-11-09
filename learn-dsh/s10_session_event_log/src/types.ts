export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface EventInput {
  readonly type: string;
  readonly data: JsonValue;
  readonly surfaceOp?: 'append';
}

export interface SessionEvent {
  readonly type: string;
  readonly seq: number;
  readonly time: number;
  readonly data: JsonValue;
  readonly surfaceOp?: 'append';
}
