import { type ActivationNode } from "./NodeActivator.ts";

// 对照 renderer.render → RenderFlow.visitRootNode → _children；不绘制真实图形。
export class RenderFlow {
  constructor(private visit: (node: ActivationNode) => void) {}
  render(root: ActivationNode, _dt: number): void {
    this.resetBatcher();
    // 23. 从场景根节点开始渲染遍历。
    // 先遍历根节点及子树，再结束批次并进入后端渲染。
    this.visitRootNode(root);
    this.terminateBatcher();
    this.forwardRender(_dt);
  }
  visitRootNode(root: ActivationNode): void {
    this.visitNode(root);
  }
  private visitNode(node: ActivationNode): void {
    this.visit(node); // 观察节点进入流程；不代表一次 draw call。
    this._children(node);
  }
  private _children(node: ActivationNode): void {
    // 24. 逐个处理符合条件的子节点，递归进入其渲染流程。
    for (const child of node._children) {
      // 对照 2.4.15：不遍历未激活或自身透明度为 0 的子节点。
      if (!child._activeInHierarchy || child._opacity === 0) continue;
      this.visitNode(child);
    }
  }
  private resetBatcher(): void {}
  private terminateBatcher(): void {}
  private forwardRender(_dt: number): void {} // GPU 绘制边界。
}

export class Renderer {
  private flow: RenderFlow;
  constructor(visit: (node: ActivationNode) => void) {
    this.flow = new RenderFlow(visit);
  }
  render(scene: ActivationNode | null, dt: number): void {
    // 22. 场景存在时，把它交给 RenderFlow。
    this.resetDrawCalls();
    // 场景尚未加载完成时，本帧不会进入场景树渲染遍历。
    if (scene) this.flow.render(scene, dt);
  }
  private resetDrawCalls(): void {}
}
