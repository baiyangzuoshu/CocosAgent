export class Pipeline {
  constructor(readonly stages: string[]) {}

  describe(): string {
    return this.stages.join(" → ");
  }
}
