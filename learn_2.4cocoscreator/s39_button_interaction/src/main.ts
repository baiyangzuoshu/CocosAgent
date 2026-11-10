import CCButton, { State } from "./cocos2d/core/components/CCButton.ts";
import CCNode from "./cocos2d/core/CCNode.ts";

function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error("缺少演示元素：" + selector);
  return result;
}

const node = new CCNode();
const button = new CCButton(node);
let count = 0;
let nodeClicks = 0;
button.clickEvents.push(() => count++);
node.on("click", () => nodeClicks++);
button.onEnable();
const buttonElement = element<HTMLButtonElement>("#button");
const output = element<HTMLElement>("#output");
let activePointer: number | null = null;

function render(message: string): void {
  const stateName = State[button.state];
  buttonElement.dataset.state = stateName;
  buttonElement.textContent = "点击计数：" + count;
  output.textContent = message + "\nButton state=" + stateName + "，clickEvents 次数=" + count + "，Node click=" + nodeClicks;
}

buttonElement.addEventListener("pointerdown", (event) => {
  activePointer = event.pointerId;
  buttonElement.setPointerCapture(event.pointerId);
  node.emit("touch-start", { inside: true });
  render("Node 命中后派发 TOUCH_START");
});
buttonElement.addEventListener("pointermove", (event) => {
  if (activePointer !== event.pointerId) return;
  const rect = buttonElement.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.bottom;
  node.emit("touch-move", { inside });
  render(inside ? "触点仍在按钮内" : "触点移出按钮，视觉状态回到 NORMAL");
});
buttonElement.addEventListener("pointerup", (event) => {
  if (activePointer !== event.pointerId) return;
  node.emit("touch-end", { inside: true });
  activePointer = null;
  render("TOUCH_END：执行 clickEvents，再恢复 NORMAL");
});
buttonElement.addEventListener("pointercancel", (event) => {
  if (activePointer !== event.pointerId) return;
  node.emit("touch-cancel", { inside: false });
  activePointer = null;
  render("TOUCH_CANCEL：清除按下状态，不调用 clickEvents");
});
element<HTMLButtonElement>("#cancel").addEventListener("click", () => {
  node.emit("touch-start", { inside: true });
  node.emit("touch-cancel", { inside: false });
  render("模拟 TOUCH_START → TOUCH_CANCEL：不调用 clickEvents");
});
render("等待触摸");
