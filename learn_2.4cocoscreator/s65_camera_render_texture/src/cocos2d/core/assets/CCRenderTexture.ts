export interface FrameBuffer {
  readonly name: string;
  readonly colorTexture: string;
  readonly width: number;
  readonly height: number;
}

export class RenderTexture {
  texture = "";
  framebuffer: FrameBuffer | null = null;

  initWithSize(width: number, height: number): void {
    this.texture = "camera-color-texture";
    this.framebuffer = {
      name: "camera-framebuffer",
      colorTexture: this.texture,
      width,
      height,
    };
    console.log("RenderTexture.initWithSize -> create Texture and gfx.FrameBuffer");
  }
}
