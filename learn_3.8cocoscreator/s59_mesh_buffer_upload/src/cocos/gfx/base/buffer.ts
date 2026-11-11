export interface GFXBuffer {
  readonly size: number;
  resize(size: number): void;
  update(data: Float32Array | Uint16Array): void;
}
