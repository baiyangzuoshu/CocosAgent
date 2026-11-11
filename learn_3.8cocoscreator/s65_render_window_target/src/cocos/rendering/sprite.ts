export class Sprite {
  renderTexture(texture: string | null): void {
    console.log("Sprite material samples", texture ?? "no texture");
  }
}
