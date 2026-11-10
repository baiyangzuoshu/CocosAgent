export default class Texture2D {
  private readonly _image = new Image();

  constructor(readonly url: string) {}

  load(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._image.onload = () => resolve();
      this._image.onerror = () => reject(new Error(`贴图加载失败: ${this.url}`));
      this._image.src = this.url;
    });
  }

  get image(): HTMLImageElement { return this._image; }
  get width(): number { return this._image.naturalWidth; }
  get height(): number { return this._image.naturalHeight; }
}
