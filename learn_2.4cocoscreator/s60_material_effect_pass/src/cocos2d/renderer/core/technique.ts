import { Pass } from "./pass.ts";

export class Technique {
  constructor(readonly name: string, readonly passes: Pass[]) {}

  clone(): Technique {
    return new Technique(this.name, this.passes.map((pass) => pass.clone()));
  }
}
