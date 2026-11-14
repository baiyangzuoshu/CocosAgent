export class Pass {
  constructor(readonly uniforms: Record<string, Float32Array>) {}
  setColor(name: string, color: Float32Array): void {
    this.uniforms[name] = color;
  }
}
