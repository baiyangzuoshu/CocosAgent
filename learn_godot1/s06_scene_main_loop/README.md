# 第 6 课：`SceneTree` 更新、输入路由与退出

**目标：** 追踪 Godot 1.1 的 `SceneTree`（源码位于 `scene_main_loop.*`）如何实现 fixed/idle 更新、把输入交给 Viewport，并通过 quit 标记结束平台主循环。

## 本课问题

`Main::iteration()` 调用 `SceneTree::iteration()` 和 `idle()` 后，Node 的 fixed 与 idle 回调如何分派？输入事件如何到达 Viewport？`SceneTree.quit()` 如何离开主循环？

## C++ 源码追踪

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `scene/main/scene_main_loop.cpp:481-504`：`SceneTree::iteration()` 发出 `fixed_frame`，向 `fixed_process` 组发送 `NOTIFICATION_FIXED_PROCESS`，刷新更新队列并返回 `_quit`。
- `scene/main/scene_main_loop.cpp:506-546`：`idle()` 记录 idle delta、发出 `idle_frame`、向 idle 节点发送 `NOTIFICATION_PROCESS`，更新 Viewport 后清理删除队列。
- `scene/main/scene_main_loop.cpp:336-463`：输入事件先交给 `MainLoop::input_event()`，再路由到 Viewport 的 `_vp_input`；未处理事件进入 `_vp_unhandled_input`。
- `scene/main/scene_main_loop.cpp:548-576`：`quit()` 设置 `_quit`；`iteration()`/`idle()` 将退出状态返回给平台循环，`finish()` 再清理并卸下 root。
- `scene/main/node.cpp:451-455`、`1832-1842`、`1892-1899`：Node 暴露 process/input 开关，并注册 `_process`、`_fixed_process`、`_input` 等脚本虚方法。

调用摘要：平台事件送入 SceneTree → Viewport 执行输入/未处理输入路由；平台帧循环调用 fixed `iteration()` 和 idle `idle()` → SceneTree 按组发送 Node 通知 → `_quit` 逐层返回并触发 `finish()`。

## 最小实验

- `engine.cfg` 指向 Godot 1.1 XML 场景 `main.xml`。
- `tree_probe.gd` 启用 idle、fixed 和 input 回调，记录首次 delta；运行期间按键可观察 `_input`，约 5 秒后脚本调用 `get_tree().quit()`。
- 在本目录运行：

```sh
godot -path .
```

预期先看到首次 idle/fixed 回调；按键时看到输入回调，随后看到 quit 提示并结束进程。输出顺序取决于平台帧循环和输入到达时机。

## 简化与边界

不细分 Viewport 的 GUI 命中和未处理事件行为，也不测试 OS 窗口关闭、暂停或平台事件队列。`SceneTree` 类名与 `scene_main_loop.cpp` 文件名均为 Godot 1.1 快照事实；本课尚未运行项目。

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | godot-1.1/scene/main/node.cpp | 451-455 |
| [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | godot-1.1/scene/main/scene_main_loop.cpp | 336-463, 481-504, 506-546, 548-576 |
