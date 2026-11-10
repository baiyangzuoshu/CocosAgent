import Label from "./cocos/2d/components/label.ts";
import LabelAssembler from "./cocos/2d/renderer/label-assembler.ts";
import UIRendererManager from "./cocos/2d/framework/ui-renderer-manager.ts";

const manager = new UIRendererManager();
const label = new Label(manager, new LabelAssembler());
const output = document.querySelector<HTMLElement>("#output")!;
const canvasLabel = document.querySelector<HTMLElement>("#label")!;
const pipeline = document.querySelector<HTMLElement>("#pipeline")!;

function show(): void {
  canvasLabel.textContent = label.renderData.text;
  canvasLabel.style.minWidth = label.renderData.width + "px";
}

label.string = "Score 9";
manager.update();
show();
output.textContent = "首次渲染：" + label.renderData.text + "，估算宽度 " + label.renderData.width + "px";

(document.querySelector("#change") as HTMLButtonElement).addEventListener("click", () => {
  label.string = "Score 10";
  pipeline.textContent = "string setter → _markForUpdateRenderData → manager → updateRenderData → assembler";
  output.textContent = "赋值后、渲染更新前：界面仍显示「" + label.renderData.text + "」，vertDirty=" + label.renderData.vertDirty;
  manager.update();
  show();
  output.textContent = "渲染更新后：" + label.renderData.text + "，估算宽度 " + label.renderData.width + "px，vertDirty=" + label.renderData.vertDirty;
});
