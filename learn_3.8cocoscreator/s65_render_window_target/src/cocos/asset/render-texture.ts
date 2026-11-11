export interface RenderWindow {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly framebuffer: {
    readonly renderPass: string;
    readonly colorTextures: readonly string[];
  };
}

export class RenderTexture {
  window: RenderWindow | null = null;

  initialize(name: string, width: number, height: number): void {
    this.window = {
      name: name + "-window",
      width,
      height,
      framebuffer: {
        renderPass: name + "-render-pass",
        colorTextures: [name + "-color-texture"],
      },
    };
    console.log("RenderTexture.initialize -> Root.createWindow", this.window.name);
    console.log("RenderWindow creates RenderPass and GFX Framebuffer");
  }

  getGFXTexture(): string | null {
    return this.window?.framebuffer.colorTextures[0] ?? null;
  }
}
