# 第 2 课：`Main::setup()` 参数解析、项目路径和启动模式

**目标：** 追踪 Godot 3.6 如何在 `Main::setup()` 中建立核心对象、选择项目路径、解析启动选项并区分项目初始化与第二阶段初始化。

## 本课增量

加入 Godot 3 的 --path 参数扫描和 main_args 透传；这个快照没有 Godot 4 的 --/++ user_args 分界。

## 本课问题

`--path` 与 `--upwards` 修改什么状态？未识别参数如何进入脚本可读列表？`setup2()` 是否总在 `setup()` 内执行？

## 源码调用链

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `main/main.cpp:418-461`：初始化 OS、创建 `Engine`、注册核心类型并准备 `ProjectSettings`，随后建立 `args` 和 `main_args`。
- `main/main.cpp:481`、`831-845`：默认项目路径是 `.`；`--path <目录>` 设置工作目录/项目路径，`--upwards` 请求向父目录查找项目。
- `main/main.cpp:982-984`：没有匹配到专用处理分支的参数进入 `main_args`。
- `main/main.cpp:1018-1028`、`1162`：读取项目设置；之后 `OS::set_cmdline(execpath, main_args)` 将筛选后的参数存入 OS。
- `main/main.cpp:1357-1361`：`p_second_phase` 为真时调用 `setup2()`；否则 `setup()` 在核心阶段结束后返回。
- `core/os/os.cpp:503-506`、`core/os/os.h:386`、`core/bind/core_bind.cpp:573-580`、`1434`：OS 保存参数列表，脚本包装层将其复制为 `Vector<String>` 并绑定 `OS.get_cmdline_args()`。

调用摘要：解析参数与项目路径 → `ProjectSettings::setup()` → 保存 `main_args` → 根据入口参数进入 `setup2()`。这里的 `OS.get_cmdline_args()` 是 `Main::setup()` 处理后交给 OS 的列表；`Main::start()` 还会处理一部分命令行选项。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [摘录](src/upstream/core/bind/core_bind.cpp.excerpt) | `engine/godot-3.6/core/bind/core_bind.cpp` | 573-580 |
| 2 | [os.cpp](src/upstream/core/os/os.cpp) | [摘录](src/upstream/core/os/os.cpp.excerpt) | `engine/godot-3.6/core/os/os.cpp` | 503-506 |
| 3 | [os.h](src/upstream/core/os/os.h) | [摘录](src/upstream/core/os/os.h.excerpt) | `engine/godot-3.6/core/os/os.h` | 386-386 |
| 4 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-3.6/main/main.cpp` | 418-461 |

## GDScript 源码复刻与 C++ 对照

模型复现 Godot 3 的 --path 与 main_args 参数传递。该快照没有 Godot 4 的 --/++ 用户参数分界，未消费项仍进入 OS 命令行参数。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| Main::setup() 参数循环 | _parse_args() | 识别项目路径、引擎开关、-- 后脚本参数和缺值错误 |
| OS command line / 项目设置 | _main_setup() | 记录参数分流和 setup 状态 |
| setup / setup2 阶段边界 | _main_setup() | 保留初始化阶段及错误提前返回 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：args_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
## 最小 Godot/GDScript 实验

- `project.godot`：Godot 3.6 项目入口，配置版本 4。
- `main.tscn`：format 2 文本场景。
- `args_probe.gd`：在 `_ready()` 逐项打印 `OS.get_cmdline_args()`。

在本目录运行：

```sh
godot --path . --course-probe
```

预期列表包含 `--course-probe`。`--path` 由 `Main::setup()` 消费，未知参数被转交至 `main_args`；项目由脚本观察到的是后者。

## 简化与边界

只验证一个未知选项的转交路径，不把它当作自定义 CLI 框架，也不覆盖导出、编辑器、远程文件系统或其他平台参数。Godot 3.6 的旧场景和 `VisualServer` 等边界不套用到 Godot 4。本课完成静态源码和项目文件核对，尚未运行。

## 下一课

继续阅读 [s03_engine_server_init](../s03_engine_server_init/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
