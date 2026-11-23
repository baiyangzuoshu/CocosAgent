import {
  type ActivationComponent,
  type ActivationNode,
  NodeActivator,
} from "./NodeActivator.ts";

// 保存遍历所需的最小节点数据；布局、变换、事件系统等留作边界。
export class Node implements ActivationNode {
  _objFlags = 0;
  // _active 是节点自身开关；_activeInHierarchy 反映节点在层级中的实际激活状态。
  _active = true;
  _activeInHierarchy = false;
  _components: ActivationComponent[] = [];
  _children: Node[] = [];
  _childArrivalOrder = 0;
  _localZOrder = 0;
  _opacity = 255;
  constructor(public name: string) {}
  addChild(node: Node): void {
    this._children.push(node);
  }
  addComponent(component: ActivationComponent): void {
    component.node = this;
    this._components.push(component);
  }
  _onPostActivated(_active: boolean): void {} // 渲染标记等由真实 Node 处理。
  emit(_type: string, _node: ActivationNode): void {} // 仅保留事件调用位置。
}

export class Scene extends Node {
  _load(): void {} // 真实引擎进行场景初始化。
  _activate(activator: NodeActivator, active = true): void {
    // 9. 将场景根节点交给激活器，递归处理子节点与组件。
    activator.activateNode(this, active);
  }
}
