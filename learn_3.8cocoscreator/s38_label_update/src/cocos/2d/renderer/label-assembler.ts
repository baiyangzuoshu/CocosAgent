import type Label from "../components/label.ts";

export default class LabelAssembler {
  updateRenderData(label: Label): void {
    const data = label.renderData;
    // 教学模型：固定字宽近似字体测量；真实 assembler 还要准备字形和顶点。
    data.text = label.string;
    data.width = label.string.length * 12;
    data.vertDirty = false;
  }
}
