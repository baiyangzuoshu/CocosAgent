import { Device, type InputAssembler } from "../gfx/device.ts";

export interface DrawItem {
  readonly name: string;
  readonly vertexBuffer: string;
  readonly indexBuffer: string;
  readonly program: string;
  readonly pass: string;
  readonly assembler: InputAssembler;
}

export class BaseRenderer {
  constructor(private readonly device: Device) {}

  protected _draw(item: DrawItem): void {
    console.log("BaseRenderer._draw", item.name);
    this.device.setVertexBuffer(item.vertexBuffer);
    this.device.setIndexBuffer(item.indexBuffer);
    this.device.setProgram(item.program);
    this.device.setPassState(item.pass);
    this.device.draw(item.assembler);
  }
}
