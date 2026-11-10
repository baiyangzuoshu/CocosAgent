import CCLabel from "./cocos2d/core/components/CCLabel.ts";
import LabelAssembler from "./cocos2d/core/renderer/label-assembler.ts";
import RenderFlow from "./cocos2d/core/renderer/render-flow.ts";

const flow = new RenderFlow();
const label = new CCLabel(flow, new LabelAssembler());
const output = document.querySelector<HTMLElement>("#output")!;
const canvasLabel = document.querySelector<HTMLElement>("#label")!;
const pipeline = document.querySelector<HTMLElement>("#pipeline")!;

function show(): void {
  canvasLabel.textContent = label.renderData.text;
  canvasLabel.style.minWidth = label.renderData.width + "px";
}

label.string = "Score 9";
flow.render();
show();
output.textContent = "首次渲染：" + label.renderData.text + "，估算宽度 " + label.renderData.width + "px";

(document.querySelector("#change") as HTMLButtonElement).addEventListener("click", () => {
  label.string = "Score 10";
  pipeline.textContent = "set string → render data dirty → render-flow → assembler";
  output.textContent = "赋值后、渲染前：界面仍显示「" + label.renderData.text + "」，dirty=" + label.renderData.dirty;
  flow.render();
  show();
  output.textContent = "渲染流程执行后：" + label.renderData.text + "，估算宽度 " + label.renderData.width + "px，dirty=" + label.renderData.dirty;
});
