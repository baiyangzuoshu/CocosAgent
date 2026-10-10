# Cocos Creator 2.4.15 原生内存桥接案例

## 选择的问题

阶段 4 的 Web 压力探针能读 JavaScript heap、Asset Cache、资源 `refCount` 和生命周期，但这些数据不能说明 Mac 原生进程的驻留内存，也不包含 GPU 纹理内存。原生已有的红蓝资源替换轨迹证明旧 JS 资源对象会失效，却没有原生侧的内存读数。本切片将这个**观测缺口**作为源码改造问题；它不是性能优化或已确认的内存泄漏修复。

## 引擎来源与构建边界

Creator 2.4.15 安装包包含配套原生源码：

| 项目 | 本机证据 |
| --- | --- |
| Native 引擎 | `/Applications/Cocos/Creator/2.4.15/CocosCreator.app/Contents/Resources/cocos2d-x/` |
| Native package | `package.json` 名称 `cocos2d-x-lite`，版本 `2.4.15`，仓库 `https://github.com/cocos-creator/cocos2d-x-lite.git` |
| 上游说明 | 该目录 `README.md` 说明它基于 cocos2d-x 3.9；它是 Creator 的裁剪版，不能等同于通用 cocos2d-x 3.9 |
| 2.4 JS 引擎 | 本仓库 `2.4.15engine/`，`package.json` 版本 `2.4.15`；这是 JS 引擎，不含 Native C++ 源码 |
| 示例工程链接 | 生成的 `hello_world.xcodeproj` 以绝对路径引用安装包里的 `build/cocos2d_libs.xcodeproj` |

安装包没有 `.git` 元数据，因此只能确认 Creator 安装版本、package 来源 URL 和本地源码指纹，**不能确认其上游 Git commit**。关键本机文件 SHA-256：`package.json` 为 `8d03a7336f9a97f5213b4184287a1f47f4e12c5b30e5f59f8022e2b30727496f`；原始 `jsb_module_register.cpp` 为 `7237a871dc347b2dcb32c8d5572a7be3acbf22475df5c8be61e85d8b98c09039`。

本实验没有把 Creator 安装包中约 1.2 GB 的整套依赖复制进 Git。构建脚本只在 `2.4.15NewProject/build/cocos-agent-native-engine-overlay/` 建立可丢弃的源码 overlay：复制 `cocos/`、`extensions/` 和 Xcode 项目，`external/` 指向 Creator 安装包的只读依赖；脚本把示例 Xcode 项目的原生引擎引用临时改到 overlay，构建后恢复生成项目文件。仓库内保留桥接头文件和构建脚本，源码改动可复现、可审阅。

安装包的 Mac 静态库是 x86_64。当前主机 `uname -m` 为 `arm64`，所以构建脚本显式传入 `ARCHS=x86_64`，以匹配现有依赖；本结果不是 arm64 原生性能数据。该安装包内的外部库也不是通用的本机重编译基线。

官方工作流说明 Creator 游戏引擎包含 JavaScript 引擎、定制版 Cocos2d-x 与平台适配器，并建议使用匹配分支定制：[Creator 2.4 引擎定制流程](https://docs.cocos.com/creator/2.4/manual/en/advanced-topics/engine-customization.html)。Native 构建文档说明安装目录包含 `cocos2d-x-lite` 源码：[Creator 2.4 Native 构建选项](https://docs.cocos.com/creator/2.4/manual/en/editor/publish/native-options.html)。

## 改造设计

修改点是 C++ JSB 注册层 `cocos/scripting/js-bindings/manual/jsb_module_register.cpp`：注册一个 Mac 专用函数 `jsb.getProcessMemoryInfo()`。JS 调用返回 `{ residentBytes, virtualBytes, unit: "bytes" }`，实现通过 Mach `task_info(MACH_TASK_BASIC_INFO)` 查询当前进程。它是只读诊断函数，不触碰场景、资源引用或构建状态。

实现位于 [`cocos-agent-memory-bridge-2.4.h`](native/cocos-agent-memory-bridge-2.4.h)；可复现的 overlay 与 Xcode 构建由 [`build-cocos-agent-memory-bridge-2.4.py`](probes/build-cocos-agent-memory-bridge-2.4.py) 完成。桥只在 `CC_TARGET_PLATFORM == CC_PLATFORM_MAC` 下注册；Android、iOS、GPU allocation 与纹理逐项字节数都不在本切片范围。

## 改造前后测量

两次都使用 Creator 2.4.15 `hello_world-desktop` 原生程序、同一 Mac 主机、同一个 127.0.0.1 PNG 服务和相同探针参数。每轮由唯一 URL 加载一张 1024×1024 红/蓝纹理（PNG 字节很小，解码后的 RGBA 像素约 4 MiB），共 24 轮；每轮显式持有新纹理、释放上一纹理并调用 `releaseUnusedAssets()`。外部 RSS 按进程命令行精确匹配应用可执行文件，剔除启动阶段低于 100 MiB 的样本。

| 指标 | 改造前：原 Creator Native | 改造后：C++ JSB 桥 |
| --- | ---: | ---: |
| `loadRemote` P50 / P95 | 124 / 125 ms | 124.5 / 125 ms |
| 24 轮完成时间 | 3.48 s | 3.66 s |
| Asset Cache | 25 → 25 | 25 → 25 |
| 上一纹理被观察为失效 | 23 / 23 次替换 | 23 / 23 次替换 |
| 原生内存 API | 不可从 JS 查询 | 可从 JS 查询驻留与虚拟字节 |
| 进程 RSS 峰值 / 清理后 | 247.0 / 224.7 MiB（`ps`） | 255.9 / 242.1 MiB（`ps`）；桥接清理读数 242.1 MiB |

改造前后加载 P95 均为 125 ms，单次采样不支持性能回归或性能提升结论。两次进程的 RSS 在启动、纹理分配和释放后的波动也不可归因于桥接函数；改造的直接效果是 Agent/游戏脚本可读到原生进程读数。改造后清理回调的 Mach `residentBytes=253906944`，外部 `ps` 在同一进程结束前也读到 `253906944` 字节，验证了桥接单位与进程 RSS 对齐。

完整轨迹：

- 改造前：[`cocos-native-content-stress-2.4-20261009T171555.jsonl`](traces/cocos-native-content-stress-2.4-20261009T171555.jsonl) 与 [RSS 采样](traces/cocos-native-content-stress-2.4-20261009T171555-rss.json)
- 改造后：[`cocos-native-content-stress-2.4-20261009T171612.jsonl`](traces/cocos-native-content-stress-2.4-20261009T171612.jsonl) 与 [RSS 采样](traces/cocos-native-content-stress-2.4-20261009T171612-rss.json)

可复跑步骤：

```sh
python3 docs/agent-foundation/probes/build-cocos-agent-memory-bridge-2.4.py
python3 docs/agent-foundation/probes/cocos-native-content-stress-2.4.py \
  --cycles 24 --size 1024 \
  --app-path 2.4.15NewProject/build/cocos-agent-native-memory-bridge/Build/Products/Debug/hello_world-desktop.app
```

压力探针会临时改写生成 `.app` 的 `main.js`，结束时恢复并核对 SHA-256；它启动一个临时 loopback HTTP 服务，运行过程只读本机进程 RSS。运行环境需允许绑定 `127.0.0.1` 和读取该进程的 RSS。

## 结论与后续

此案例展示从 JSB 注册入口把平台能力暴露给游戏脚本，以及如何用原生读数补齐 Web 指标的盲区。进程 RSS 不等于纹理分配或 GPU 显存；释放后的常驻页可能来自 allocator、驱动、引擎缓存或其他对象，不能单凭 RSS 增长判定纹理泄漏。下一步若要优化内存，先增加可归因的纹理/渲染器资源计数或 Instruments/Metal 侧测量，再从真实超预算样本定位 C++ 生命周期；不要先改纹理释放行为。

该代码是 Creator 2.4.15 Mac 目标的实验性桥接，不是通用跨平台 API；3.8 路径按当前范围暂停，不复用或声明支持。
