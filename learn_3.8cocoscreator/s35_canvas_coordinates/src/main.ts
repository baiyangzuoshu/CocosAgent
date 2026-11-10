import Canvas from "./cocos/2d/framework/canvas.ts";
import Camera from "./cocos/misc/camera-component.ts";
import Node from "./cocos/scene-graph/node.ts";
import View from "./cocos/ui/view.ts";

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

const view = new View({ width: 1280, height: 720 });
view.setDesignResolutionSize(960, 640, "SHOW_ALL");
const canvasNode = new Node("Canvas");
canvasNode.uiTransform.setContentSize(960, 640);
canvasNode.setPosition(480, 320);
const camera = new Camera();
const canvas = new Canvas(canvasNode, view, camera);
canvas.onEnable();
const policy = "SHOW_ALL";
const centerOnScreen = view.designToScreen(canvasNode.position);

frame.style.transform =
  "translate(-50%, -50%) scale(" + (view.scaleX * 0.5) + ")";
scaleLabel.textContent = view.scaleX.toFixed(3) + " × " + view.scaleY.toFixed(3)
  + " · " + policy;
viewportLabel.textContent =
  "(" + view.viewport.x.toFixed(0) + ", " + view.viewport.y.toFixed(0) + ") "
  + view.viewport.width.toFixed(0) + " × " + view.viewport.height.toFixed(0);
canvasLabel.textContent =
  canvasNode.uiTransform.width + " × " + canvasNode.uiTransform.height
  + " · (" + canvasNode.position.x + ", " + canvasNode.position.y + ")";
centerLabel.textContent =
  "(" + centerOnScreen.x.toFixed(0) + ", " + centerOnScreen.y.toFixed(0) + ")";
