import CCCanvas from "./cocos2d/core/CCCanvas.ts";
import CCNode from "./cocos2d/core/CCNode.ts";
import CCView from "./cocos2d/core/CCView.ts";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("找不到演示节点：" + selector);
  return element;
}

const frame = requireElement<HTMLDivElement>("#design-frame");
const scaleLabel = requireElement<HTMLElement>("#scale");
const viewportLabel = requireElement<HTMLElement>("#viewport-rect");
const canvasLabel = requireElement<HTMLElement>("#canvas");
const centerLabel = requireElement<HTMLElement>("#screen-center");

const view = new CCView({ width: 1280, height: 720 });
const canvasNode = new CCNode("Canvas");
const canvas = new CCCanvas(view, canvasNode);
const policy = canvas.applySettings();
const centerOnScreen = view.designToScreen(canvasNode.position);

frame.style.transform =
  "translate(-50%, -50%) scale(" + (view.scaleX * 0.5) + ")";
scaleLabel.textContent = view.scaleX.toFixed(3) + " × " + view.scaleY.toFixed(3)
  + " · " + policy;
viewportLabel.textContent =
  "(" + view.viewport.x.toFixed(0) + ", " + view.viewport.y.toFixed(0) + ") "
  + view.viewport.width.toFixed(0) + " × " + view.viewport.height.toFixed(0);
canvasLabel.textContent =
  canvasNode.contentSize.width + " × " + canvasNode.contentSize.height
  + " · (" + canvasNode.position.x + ", " + canvasNode.position.y + ")";
centerLabel.textContent =
  "(" + centerOnScreen.x.toFixed(0) + ", " + centerOnScreen.y.toFixed(0) + ")";
