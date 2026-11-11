import { View } from "../core/view.ts";

export class RendererCamera {
  constructor(
    public readonly name: string,
    public readonly cullingMask: number,
    public readonly stages: readonly string[],
  ) {}

  extractView(): View {
    console.log(`${this.name}.extractView -> cullingMask=${this.cullingMask.toString(16)}`);
    return new View(this.name, this.cullingMask, this.stages);
  }
}
