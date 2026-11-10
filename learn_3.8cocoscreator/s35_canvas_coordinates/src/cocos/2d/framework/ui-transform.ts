export default class UITransform {
  width = 0;
  height = 0;
  anchorX = 0.5;
  anchorY = 0.5;

  setContentSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}
