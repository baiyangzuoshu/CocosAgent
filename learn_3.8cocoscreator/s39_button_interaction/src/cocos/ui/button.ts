import Node, { ButtonEventType, NodeEventType, type TouchPayload } from "../scene-graph/node.ts";

export enum State { NORMAL, HOVER, PRESSED, DISABLED }
export type ClickHandler = () => void;

/** Button registers node touch events; the input system has already hit-tested the Node. */
export default class Button {
  public interactable = true;
  public enabledInHierarchy = true;
  public readonly clickEvents: ClickHandler[] = [];
  private _pressed = false;
  private _state = State.NORMAL;
  constructor(private readonly node: Node) {}
  onEnable(): void { this._registerNodeEvent(); this._updateState(); }
  onDisable(): void { this._resetState(); this._unregisterNodeEvent(); }
  get state(): State { return this._state; }
  private _registerNodeEvent(): void {
    this.node.on(NodeEventType.TOUCH_START, this._onTouchBegan);
    this.node.on(NodeEventType.TOUCH_MOVE, this._onTouchMove);
    this.node.on(NodeEventType.TOUCH_END, this._onTouchEnded);
    this.node.on(NodeEventType.TOUCH_CANCEL, this._onTouchCancel);
  }
  private _unregisterNodeEvent(): void {
    this.node.off(NodeEventType.TOUCH_START, this._onTouchBegan);
    this.node.off(NodeEventType.TOUCH_MOVE, this._onTouchMove);
    this.node.off(NodeEventType.TOUCH_END, this._onTouchEnded);
    this.node.off(NodeEventType.TOUCH_CANCEL, this._onTouchCancel);
  }
  private _onTouchBegan = (_event: TouchPayload | unknown): void => {
    if (!this.interactable || !this.enabledInHierarchy) return;
    this._pressed = true;
    this._updateState();
  };
  private _onTouchMove = (payload: TouchPayload | unknown): void => {
    if (!this.interactable || !this.enabledInHierarchy || !this._pressed) return;
    const event = payload as TouchPayload;
    this._state = event.inside ? State.PRESSED : State.NORMAL;
  };
  private _onTouchEnded = (_event: TouchPayload | unknown): void => {
    if (!this.interactable || !this.enabledInHierarchy) return;
    if (this._pressed) {
      for (const callback of this.clickEvents) callback();
      this.node.emit(ButtonEventType.CLICK, this);
    }
    this._pressed = false;
    this._updateState();
  };
  private _onTouchCancel = (_event: TouchPayload | unknown): void => {
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
