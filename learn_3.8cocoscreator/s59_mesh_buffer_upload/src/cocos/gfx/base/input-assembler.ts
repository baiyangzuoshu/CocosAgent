import type { GFXBuffer } from "./buffer.ts";

export class InputAssembler {
  readonly primitiveMode = "TRIANGLES";
  firstIndex = 0;
  indexCount = 0;

  constructor(
    readonly vertexBuffer: GFXBuffer,
    readonly indexBuffer: GFXBuffer,
  ) {}
}
