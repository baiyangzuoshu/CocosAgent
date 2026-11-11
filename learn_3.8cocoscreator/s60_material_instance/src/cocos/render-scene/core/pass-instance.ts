import { Pass } from "./pass.ts";

export class PassInstance extends Pass {
  constructor(readonly parentPass: Pass) {
    super(parentPass.name, {
      name: parentPass.name,
      blendState: { ...parentPass.state },
    });
  }
}
