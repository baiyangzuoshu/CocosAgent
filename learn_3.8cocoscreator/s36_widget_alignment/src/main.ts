import Node from "./cocos/scene-graph/node.ts";
import Widget from "./cocos/ui/widget.ts";
import WidgetManager from "./cocos/ui/widget-manager.ts";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("找不到演示节点：" + selector);
  return element;
}

const root = new Node("Canvas");
root.uiTransform.setContentSize({ width: 960, height: 640 });
root.setPosition(480, 320);
const button = new Node("Button", root);
button.uiTransform.setContentSize({ width: 160, height: 64 });

const manager = new WidgetManager();
const widget = new Widget(button, manager);
manager.add(widget);
manager.afterUpdate();
const before = { x: root.position.x + button.position.x, y: root.position.y + button.position.y };

manager.onDesignResolutionChanged(root, { width: 1280, height: 720 });
const stale = { x: root.position.x + button.position.x, y: root.position.y + button.position.y };
manager.afterUpdate();
const after = { x: root.position.x + button.position.x, y: root.position.y + button.position.y };

requireElement<HTMLElement>("#rule").textContent = "right = 24，垂直中心；alignMode = ON_WINDOW_RESIZE";
requireElement<HTMLElement>("#before").textContent = `(${before.x}, ${before.y})`;
requireElement<HTMLElement>("#stale").textContent = `(${stale.x}, ${stale.y})，Widget 已标脏`;
requireElement<HTMLElement>("#after").textContent = `(${after.x}, ${after.y})，对齐完成`;
