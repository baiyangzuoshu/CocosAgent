import CCNode, { type TouchPayload } from "../CCNode.ts";

export enum State { NORMAL, HOVER, PRESSED, DISABLED }
export type ClickHandler = () => void;

/** 组件只接 Node 触摸事件；命中筛选已由输入/事件路径完成。 */
export default class CCButton {
  public interactable = true;
  public enabledInHierarchy = true;
  public readonly clickEvents: ClickHandler[] = [];
  private _pressed = false;
  private _state = State.NORMAL;

  constructor(private readonly node: CCNode) {}

  onEnable(): void {
    this.node.on("touch-start", this._onTouchBegan);
    this.node.on("touch-move", this._onTouchMove);
    this.node.on("touch-end", this._onTouchEnded);
    this.node.on("touch-cancel", this._onTouchCancel);
    this._updateState();
  }

  onDisable(): void {
    this._resetState();
    this.node.off("touch-start", this._onTouchBegan);
    this.node.off("touch-move", this._onTouchMove);
    this.node.off("touch-end", this._onTouchEnded);
    this.node.off("touch-cancel", this._onTouchCancel);
  }

  get state(): State { return this._state; }

  private _onTouchBegan = (_event: TouchPayload): void => {
    if (!this.interactable || !this.enabledInHierarchy) return;
    this._pressed = true;
    this._updateState();
  };

  private _onTouchMove = (event: TouchPayload): void => {
    if (!this.interactable || !this.enabledInHierarchy || !this._pressed) return;
    this._state = event.inside ? State.PRESSED : State.NORMAL;
  };

  private _onTouchEnded = (_event: TouchPayload): void => {
    if (!this.interactable || !this.enabledInHierarchy) return;
    if (this._pressed) {
      for (const callback of this.clickEvents) callback();
      this.node.emit("click", { inside: true });
    }
    this._pressed = false;
    this._updateState();
  };

  private _onTouchCancel = (_event: TouchPayload): void => {
    if (!this.interactable || !this.enabledInHierarchy) return;
    this._pressed = false;
    this._updateState();
  };

  private _resetState(): void {
    this._pressed = false;
    this._updateState();
  }

  private _updateState(): void {
    this._state = !this.interactable ? State.DISABLED : this._pressed ? State.PRESSED : State.NORMAL;
  }
}
