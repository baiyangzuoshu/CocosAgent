import Node from "./cocos/scene-graph/node.ts";
import Director from "./cocos/game/director.ts";
import Layout from "./cocos/ui/layout.ts";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("找不到演示节点：" + selector);
  return element;
}

function createItems(root: Node, widths: number[]): Node[] {
  return widths.map((width, index) => {
    const child = new Node("Item" + index);
    child.uiTransform.setContentSize({ width, height: 40 });
    root.addChild(child);
    return child;
  });
}

function drawRow(
  selector: string,
  widths: number[],
  positions: number[],
  containerWidth: number,
  pendingIndex = -1,
): void {
  const row = requireElement<HTMLElement>(selector);
  row.replaceChildren();
  row.style.width = containerWidth + "px";
  widths.forEach((width, index) => {
    const item = document.createElement("div");
    item.className = index === pendingIndex ? "item pending" : "item";
    item.textContent = "Item " + (index + 1);
    item.style.width = width + "px";
    const x = positions[index] ?? 0;
    item.style.left = "calc(50% " + (x < 0 ? "- " : "+ ") + Math.abs(x) + "px)";
    row.appendChild(item);
  });
}

function positions(children: Node[]): number[] {
  return children.map((child) => child.position.x);
}

const director = new Director();
const root = new Node("HorizontalLayout");
const layout = new Layout(root, director);
const widths = [64, 80, 96];
const children = createItems(root, widths);
director.afterUpdate();

const beforeWidth = root.uiTransform.contentSize.width;
const beforePositions = positions(children);
drawRow("#initial", widths, beforePositions, beforeWidth);

const fourth = createItems(root, [72])[0];
const allWidths = widths.concat([fourth.uiTransform.contentSize.width]);
const stalePositions = positions(children).concat([fourth.position.x]);
const staleWidth = root.uiTransform.contentSize.width;
drawRow("#stale", allWidths, stalePositions, staleWidth, 3);

director.afterUpdate();
const afterWidth = root.uiTransform.contentSize.width;
const afterPositions = positions(root.children);
drawRow("#updated", allWidths, afterPositions, afterWidth);

requireElement<HTMLElement>("#output").textContent =
  "初始：UITransform 宽 " + beforeWidth + "，中心 x = [" + beforePositions.join(", ") + "]\n"
  + "添加第四项后：dirty = " + layout.isDirty() + "，同步读取仍是宽 " + staleWidth
  + "，新项暂在 x = " + fourth.position.x + "\n"
  + "AFTER_UPDATE 后：UITransform 宽 " + afterWidth + "，中心 x = [" + afterPositions.join(", ") + "]";
