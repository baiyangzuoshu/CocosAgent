export default class RenderRoot2D {
  protected enabled = false;

  onEnable(): void {
    this.enabled = true;
  }

  onDisable(): void {
    this.enabled = false;
  }
}
