import type { PassInfo } from "../../asset/assets/effect-asset.ts";

export class Pass {
  readonly state: { enabled: boolean; src: string; dst: string };

  constructor(readonly name: string, info: PassInfo) {
    this.state = { ...info.blendState };
  }

  overridePipelineStates(overrides: Partial<Pass["state"]>): void {
    Object.assign(this.state, overrides);
  }

}
