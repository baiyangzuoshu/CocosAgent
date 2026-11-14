# 第 13 课：GDScript 实例成员访问与虚方法调用

**目标：** 追踪 GDScript Resource 如何创建 GDInstance，并把脚本属性 get/set 与方法 call 交给实例对象。

## 本课问题

脚本资源 new()、宿主实例化、动态属性访问和方法调用分别经过哪些 C++ 接口？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-2.1/` 快照。
- `engine/godot-2.1/modules/gdscript/gd_script.cpp:90-122, 261-301, 850-887, 889-941, 1105-1119`：摘录包含本课的关键函数实现。
- `engine/godot-2.1/modules/gdscript/gd_function.cpp:164-205`：摘录包含本课的关键函数实现。

调用链：`GDScript::_create_instance / instance_create → GDInstance::set/get/call → GDFunction::call`

## 源码阅读顺序

1. `GDScript::_create_instance` 与 `instance_create` 建立脚本实例并关联宿主 Object，实例持有成员值和函数访问入口。
2. `GDInstance::set/get` 把动态属性读写映射到脚本成员；对照未知成员时的返回值和错误处理。
3. `GDInstance::call` 找到脚本函数后进入 `GDFunction::call`；跟随函数指令循环和参数/返回值栈，解释 `target.call()` 的去向。

脚本资源保存类定义与函数实现；实例创建时建立成员存储并关联宿主 Object。Object 的属性访问进入 ScriptInstance 的 set/get，方法调用进入实例 call，再由 GDFunction 解释执行代码。动态 API 暴露调用结果，实例化细节留在本代 GDScript 源码。

## 最小 Godot/GDScript 实验

独立 payload.gd 声明 score 和 twice(value)。主脚本加载 GDScript 资源，new 一个实例，用 Object.set/get/call 访问成员和函数。Godot 3 额外启动一个 idle_frame yield 流程。

实验文件：

- [`engine.cfg`](engine.cfg)
- [`main.tscn`](main.tscn)
- [`execution_probe.gd`](execution_probe.gd)
- [`payload.gd`](payload.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot -path .
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
| [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | `engine/godot-2.1/modules/gdscript/gd_script.cpp` | 90-122, 261-301, 850-887, 889-941, 1105-1119 |
| [gd_function.cpp](src/upstream/modules/gdscript/gd_function.cpp.excerpt) | `engine/godot-2.1/modules/gdscript/gd_function.cpp` | 164-205 |

## 下一课

[第 14 课：Node 父子树、NodePath 与 owner](../s14_node_tree_owner/README.md)
