import type CCLabel from "../components/CCLabel.ts";

export default class LabelAssembler {
  updateRenderData(label: CCLabel): void {
    const data = label.renderData;
    // 教学模型：用固定字宽近似测量；引擎会按字体和字形生成顶点。
    data.text = label.string;
    data.width = label.string.length * 12;
    data.dirty = false;
  }
}
