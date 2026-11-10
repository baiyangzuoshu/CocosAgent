import Button, { State } from "./cocos/ui/button.ts";
import Node, { ButtonEventType, NodeEventType } from "./cocos/scene-graph/node.ts";

function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error("缺少演示元素：" + selector);
  return result;
}
const node = new Node();
const button = new Button(node);
let clickEventsCount = 0;
let nodeClickCount = 0;
button.clickEvents.push(() => clickEventsCount++);
node.on(ButtonEventType.CLICK, () => nodeClickCount++);
button.onEnable();
const buttonElement = element<HTMLButtonElement>("#button");
const output = element<HTMLElement>("#output");
let activePointer: number | null = null;
function render(message: string): void {
  const stateName = State[button.state];
  buttonElement.dataset.state = stateName;
  buttonElement.textContent = "点击计数：" + clickEventsCount;
  output.textContent = message + "\nButton state=" + stateName
    + "，clickEvents=" + clickEventsCount + "，Node click=" + nodeClickCount;
}
buttonElement.addEventListener("pointerdown", (event) => {
  activePointer = event.pointerId;
  buttonElement.setPointerCapture(event.pointerId);
  node.emit(NodeEventType.TOUCH_START, { inside: true });
  render("Node 命中后派发 TOUCH_START");
});
buttonElement.addEventListener("pointermove", (event) => {
  if (activePointer !== event.pointerId) return;
  const rect = buttonElement.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.bottom;
  node.emit(NodeEventType.TOUCH_MOVE, { inside });
  render(inside ? "触点仍在按钮内" : "触点移出按钮，状态视觉回到 NORMAL");
});
buttonElement.addEventListener("pointerup", (event) => {
  if (activePointer !== event.pointerId) return;
  node.emit(NodeEventType.TOUCH_END, { inside: true });
  activePointer = null;
  render("TOUCH_END：派发 clickEvents 和 Node click，再恢复 NORMAL");
});
buttonElement.addEventListener("pointercancel", (event) => {
  if (activePointer !== event.pointerId) return;
  node.emit(NodeEventType.TOUCH_CANCEL, { inside: false });
  activePointer = null;
  render("TOUCH_CANCEL：清除按下状态，不派发点击");
});
element<HTMLButtonElement>("#cancel").addEventListener("click", () => {
  node.emit(NodeEventType.TOUCH_START, { inside: true });
  node.emit(NodeEventType.TOUCH_CANCEL, { inside: false });
  render("模拟 TOUCH_START → TOUCH_CANCEL：不派发点击");
});
render("等待触摸");
