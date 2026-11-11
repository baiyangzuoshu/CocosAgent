export class View {
  constructor(
    public readonly cameraName: string,
    public readonly cullingMask: number,
    public readonly stages: readonly string[],
  ) {}
}
