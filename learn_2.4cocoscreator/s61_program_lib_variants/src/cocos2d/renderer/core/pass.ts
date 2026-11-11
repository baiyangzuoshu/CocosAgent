export class Pass {
  constructor(
    readonly name: string,
    readonly programName: string,
    readonly defines: Record<string, boolean | number>,
    readonly properties: Record<string, Float32Array>,
  ) {}
}
