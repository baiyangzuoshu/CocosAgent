export interface BlendState {
  enabled: boolean;
  src: number;
  dst: number;
}

export class Pass {
  constructor(
    readonly name: string,
    readonly programName: string,
    readonly blend: BlendState,
  ) {}

  setBlend(enabled: boolean, src = this.blend.src, dst = this.blend.dst): void {
    this.blend.enabled = enabled;
    this.blend.src = src;
    this.blend.dst = dst;
  }

  clone(): Pass {
    return new Pass(this.name, this.programName, { ...this.blend });
  }
}
