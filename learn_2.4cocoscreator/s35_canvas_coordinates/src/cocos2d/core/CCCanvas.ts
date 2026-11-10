import CCNode from "./CCNode.ts";
import CCView, { type ResolutionPolicy } from "./CCView.ts";

export default class CCCanvas {
  designResolution = { width: 960, height: 640 };
  fitWidth = true;
  fitHeight = true;

  constructor(private readonly view: CCView, readonly node: CCNode) {}

  applySettings(): ResolutionPolicy {
    if (!this.fitWidth || !this.fitHeight) {
      throw new Error("本课示例固定使用 fitWidth + fitHeight");
    }
    const policy: ResolutionPolicy = "SHOW_ALL";

    this.view.setDesignResolutionSize(
      this.designResolution.width,
      this.designResolution.height,
      policy,
    );
    this.node.setContentSize(this.designResolution);
    this.node.setPosition(
      this.designResolution.width / 2,
      this.designResolution.height / 2,
    );
    return policy;
  }
}
