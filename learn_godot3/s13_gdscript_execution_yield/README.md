# 第 13 课：GDScript 实例执行、函数状态与 yield

**目标：** 沿 GDScript::instance_create 和 GDScriptInstance 的 set/get/call 追踪脚本成员与 yield 函数状态。

## 本课问题

动态 set/get 如何映射脚本成员？方法调用怎样进入 GDScriptFunction？yield 后为什么返回 FunctionState？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-3.6/` 快照。
- `engine/godot-3.6/modules/gdscript/gdscript.cpp:96-138, 316-333, 992-1044, 1046-1094, 1213-1224`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/modules/gdscript/gdscript_function.cpp:254-292`：摘录包含本课的关键函数实现。

调用链：`GDScript::instance_create → GDScriptInstance::set/get/call → GDScriptFunction::call → optional GDScriptFunctionState`

## 源码阅读顺序

1. `GDScript::instance_create` 为脚本建立 GDScriptInstance，并初始化类成员。
2. `GDScriptInstance::set/get/call` 是 Object 与脚本字段/函数之间的动态分派边界；属性和方法共享同一脚本实例。
3. `GDScriptFunction::call` 解释执行函数指令；检查 CallState 分支怎样从保存的栈、指令位置恢复被 yield 的函数。

脚本实例通过 GDScriptInstance 暴露属性与函数；call 将参数送入 GDScriptFunction 执行。3.6 的 yield 会挂起执行并交付函数状态，后续信号/帧事件可恢复它。本课同时观察普通成员访问与一段 idle_frame yield。

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
| [gdscript.cpp](src/upstream/modules/gdscript/gdscript.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript.cpp` | 96-138, 316-333, 992-1044, 1046-1094, 1213-1224 |
| [gdscript_function.cpp](src/upstream/modules/gdscript/gdscript_function.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript_function.cpp` | 254-292 |

## 下一课

[第 14 课：Node 父子关系、NodePath 与 owner](../s14_node_hierarchy_owner/README.md)
