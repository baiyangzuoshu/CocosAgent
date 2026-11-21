import { CCAsset } from "./CCAsset.ts";

export interface CompressedTextureData {
  _compressed: true;
  _data: Uint8Array;
  format?: number;
  width: number;
  height: number;
}

export type TextureSource = CompressedTextureData | HTMLImageElement;

/** Cropped source model of cc.Texture2D native-asset initialization. */
export class Texture2D extends CCAsset {
  private _image: HTMLImageElement | Uint8Array | null = null;
  private _format = 0;
  width = 0;
  height = 0;

  get nativeAsset(): HTMLImageElement | Uint8Array | null {
    return this._image;
  }

  set nativeAsset(data: TextureSource) {
    if ("_compressed" in data && data._compressed && data._data) {
      const format = data.format ? data.format : this._format;
      this.initWithData(data._data, format, data.width, data.height);
    } else {
      this.initWithElement(data as HTMLImageElement);
    }
  }

  private initWithData(data: Uint8Array, format: number, width: number, height: number): void {
    this._image = data;
    this._format = format;
    this.width = width;
    this.height = height;
  }

  private initWithElement(image: HTMLImageElement): void {
    this._image = image;
    this.width = image.naturalWidth;
    this.height = image.naturalHeight;
  }
}
