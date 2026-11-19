import { CCInputManager } from "./cocos2d/core/platform/CCInputManager.ts";
import type { InputPoint } from "./cocos2d/core/platform/input-point.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!status) throw new Error("找不到状态节点 #status");
if (!canvas) throw new Error("找不到画布 #game");

const format = (value: number): string => value.toFixed(1);

const showPoint = (point: InputPoint): void => {
  const scale = `x: ${point.backingWidth} / ${format(point.rectWidth)} = ${format(point.scaleX)}；` +
    `y: ${point.backingHeight} / ${format(point.rectHeight)} = ${format(point.scaleY)}`;

  status.textContent = [
    `输入: ${point.source}；ID: ${point.id}`,
    `浏览器 client（视口 CSS 像素）: (${format(point.clientX)}, ${format(point.clientY)})`,
    `画布 CSS 区域: left=${format(point.rectLeft)} top=${format(point.rectTop)} ` +
      `size=${format(point.rectWidth)}×${format(point.rectHeight)}`,
    `画布内局部坐标（左上原点）: (${format(point.localX)}, ${format(point.localYTop)})`,
    `换到左下原点: y=${format(point.rectHeight)} - ${format(point.localYTop)} = ${format(point.localYBottom)}`,
    `backing-store / CSS 比例: ${scale}`,
    `最终画布坐标（左下原点）: (${format(point.x)}, ${format(point.y)}) / ` +
      `${point.backingWidth}×${point.backingHeight}`,
    "公式: x=(clientX-rect.left)×canvas.width/rect.width",
    "      y=(rect.bottom-clientY)×canvas.height/rect.height",
  ].join("\n");
};

status.textContent = [
  "点击或触摸画布后观察坐标换算：",
  "1. clientX/Y 是浏览器视口中的 CSS 像素。",
  "2. 减去画布 CSS 区域的位置，得到画布内局部坐标。",
  "3. 按 backing-store/CSS 尺寸比例缩放，并把 Y 轴翻转为左下原点。",
  "等待输入……",
].join("\n");

new CCInputManager().registerSystemEvent(canvas, showPoint);
