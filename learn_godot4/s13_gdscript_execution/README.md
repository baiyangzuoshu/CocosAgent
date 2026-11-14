# 第 13 课：GDScript 实例化与引擎对象调用

**目标：** 跟踪 Godot 4.7 的 GDScript 实例创建、属性访问、callp 分派与 VM 函数入口。

## 本课问题

Resource.new() 创建的对象如何绑定脚本？Object.set/get/call 在哪一层落到 GDScriptInstance？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-4.7/` 快照。
- `engine/godot-4.7/modules/gdscript/gdscript.cpp:154-208, 406-425, 1536-1607, 1609-1694, 1948-1966`：摘录包含本课的关键函数实现。
- `engine/godot-4.7/modules/gdscript/gdscript_vm.cpp:499-545`：摘录包含本课的关键函数实现。

调用链：`GDScript::_create_instance / instance_create → GDScriptInstance::set/get/callp → GDScriptFunction::call VM`

## 源码阅读顺序

1. `GDScript::_create_instance` / `instance_create` 负责实例创建和 ScriptInstance 关联；先分清脚本 Resource 与实例 Object。
2. `GDScriptInstance::set/get/callp` 将 Object 的动态属性和方法访问映射到脚本成员/函数。
3. `GDScriptFunction::call` 是 VM 执行入口；沿参数准备、栈初始化和指令分派读一次 `target.call()` 的调用。Godot 4 的暂停式异步流程使用 await，不再返回 Godot 3 的 FunctionState。

GDScript 资源创建实例后，ScriptInstance 接口负责成员 set/get 和 callp。callp 查找脚本函数，再把执行交给 VM 的 GDScriptFunction::call。Godot 4 使用 await，不再沿用 Godot 3 的 yield/FunctionState 机制。

## 最小 Godot/GDScript 实验

独立 payload.gd 声明 score 和 twice(value)。主脚本加载 GDScript 资源，new 一个实例，用 Object.set/get/call 访问成员和函数。Godot 3 额外启动一个 idle_frame yield 流程。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`execution_probe.gd`](execution_probe.gd)
- [`payload.gd`](payload.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期 score 读回 21、twice 返回 42；Godot 3 还会在跨过一帧后打印恢复标记。

**动手改一处：** 将 score 初值改为 30，并把 twice 改成三倍，预测 set/get 与动态 call 的结果。Godot 3 可把 idle_frame 改为 timer timeout。

## 简化与边界

只观察一个脚本类和一次方法调用；不覆盖继承、静态成员、setter/getter、await/yield 错误恢复或调试器堆栈。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [gdscript.cpp](src/upstream/modules/gdscript/gdscript.cpp.excerpt) | `engine/godot-4.7/modules/gdscript/gdscript.cpp` | 154-208, 406-425, 1536-1607, 1609-1694, 1948-1966 |
| [gdscript_vm.cpp](src/upstream/modules/gdscript/gdscript_vm.cpp.excerpt) | `engine/godot-4.7/modules/gdscript/gdscript_vm.cpp` | 499-545 |

## 下一课

[第 14 课：Node 父子关系、路径与 owner](../s14_node_hierarchy/README.md)
