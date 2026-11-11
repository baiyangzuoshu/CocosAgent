import type { WebGL2PrimaryCommandBuffer } from "../../gfx/webgl2-primary-command-buffer.ts";

export interface DrawInfo {
  readonly model: string;
  readonly pipelineState: string;
  readonly inputAssembler: string;
  readonly indexCount: number;
}

export class ForwardStage {
  constructor(private readonly commandBuffer: WebGL2PrimaryCommandBuffer) {}

  render(info: DrawInfo): void {
    console.log("ForwardStage.bindPipelineState", info.pipelineState);
    console.log("ForwardStage.bindInputAssembler", info.inputAssembler);
    this.commandBuffer.beginRenderPass();
    this.commandBuffer.draw(info);
    this.commandBuffer.endRenderPass();
  }
}
