import {
  type ActivationComponent,
  type ActivationNode,
  type ActivationTask,
  type Invoker,
  IsOnLoadCalled,
  NodeActivator,
} from "../src/NodeActivator.ts";

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`期望 ${expected}，实际 ${actual}`);
}

function createNode(name: string, active = true): ActivationNode {
  return {
    name,
    _objFlags: 0,
    _active: active,
    _activeInHierarchy: false,
    _components: [],
    _children: [],
    _childArrivalOrder: 0,
    _localZOrder: 0,
    _opacity: 255,
    _onPostActivated() {},
    emit() {},
  };
}

Deno.test("递归激活活跃子节点，分阶段执行组件调用；停用后重启不重复 onLoad", () => {
  const log: string[] = [];
  const root = createNode("root"),
    child = createNode("child"),
    inactive = createNode("inactive", false);
  root._children = [child, inactive];
  function component(node: ActivationNode): ActivationComponent {
    const comp: ActivationComponent = {
      node,
      _objFlags: 0,
      _enabled: true,
      __preload() {
        log.push(`preload:${node.name}`);
      },
      onLoad() {
        log.push(`load:${node.name}`);
      },
    };
    node._components.push(comp);
    return comp;
  }
  const rootComp = component(root), childComp = component(child);

  function invoker(kind: "preload" | "onLoad" | "onEnable"): Invoker {
    const queue: ActivationComponent[] = [];
    return {
      add(comp) {
        queue.push(comp);
      },
      invoke() {
        for (const comp of queue) {
          if (kind === "preload") comp.__preload?.();
          if (kind === "onLoad") {
            comp.onLoad?.();
            comp._objFlags |= IsOnLoadCalled;
          }
          if (kind === "onEnable") log.push(`enable:${comp.node.name}`);
        }
      },
      cancelInactive() {},
    };
  }
  const activator = new NodeActivator({
    acquireTask: (): ActivationTask => ({
      preload: invoker("preload"),
      onLoad: invoker("onLoad"),
      onEnable: invoker("onEnable"),
    }),
    releaseTask() {},
    isValid: () => true,
    enableComp(comp, queue) {
      queue?.add(comp);
    },
    disableComp(comp) {
      log.push(`disable:${comp.node.name}`);
    },
    reportReactivation() {
      throw new Error("不应触发重入保护");
    },
  });
  activator.activateNode(root, true);
  equal(root._activeInHierarchy, true);
  equal(child._activeInHierarchy, true);
  equal(inactive._activeInHierarchy, false);
  equal(root._childArrivalOrder, 2);
  equal(child._localZOrder & 0xffff, 1);
  equal(inactive._localZOrder & 0xffff, 2);
  equal(
    log.join(","),
    "preload:root,preload:child,load:root,load:child,enable:root,enable:child",
  );
  equal(Boolean(rootComp._objFlags & IsOnLoadCalled), true);
  equal(Boolean(childComp._objFlags & IsOnLoadCalled), true);
  activator.activateNode(root, false);
  equal(root._activeInHierarchy, false);
  equal(child._activeInHierarchy, false);
  activator.activateNode(root, true);
  equal(
    log.join(","),
    "preload:root,preload:child,load:root,load:child,enable:root,enable:child,disable:root,disable:child,enable:root,enable:child",
  );
});

Deno.test("停用发生在激活任务中时，通知所有待执行队列取消非活跃项", () => {
  const log: string[] = [];
  const root = createNode("root");
  const comp: ActivationComponent = {
    node: root,
    _objFlags: 0,
    _enabled: false,
    __preload() {
      activator.activateNode(root, false);
    },
  };
  root._components.push(comp);
  function queue(name: string): Invoker {
    const items: ActivationComponent[] = [];
    return {
      add(item) {
        items.push(item);
      },
      invoke() {
        if (name === "preload") items.forEach((item) => item.__preload?.());
      },
      cancelInactive(flag) {
        log.push(`${name}:${flag ?? "none"}`);
      },
    };
  }
  const activator = new NodeActivator({
    acquireTask: () => ({
      preload: queue("preload"),
      onLoad: queue("onLoad"),
      onEnable: queue("onEnable"),
    }),
    releaseTask() {},
    isValid: () => true,
    enableComp() {},
    disableComp() {},
    reportReactivation() {},
  });
  activator.activateNode(root, true);
  equal(root._activeInHierarchy, false);
  equal(log.join(","), `preload:${1 << 13},onLoad:${1 << 15},onEnable:none`);
});
