# Cocos2d-x 4 与 Creator 2.4.15 对照 Demo

## Demo 目标

用最小首屏比较两套工程从入口进入场景、构造 Sprite/Label 并开始帧循环的路径。首轮在 macOS 桌面分别运行；Cocos2d-x 为 x86_64 原生 app（Apple Silicon 经 Rosetta），Creator 为浏览器 WebGL 预览。两边画面约 960×640；运行时可对照，但不将其用于性能排名。

Creator 工程中的独立对照场景为 `2.4.15NewProject/assets/Scene/Cocos2dComparison.fire`。它包含 Canvas、Main Camera、background、cocos Sprite 和 label，复用 Creator 默认示例资源；原 `helloworld.fire` 和 `settings/project.json` 保持不变。Cocos2d-x 对照源使用 `cocos2d-x-4/templates/cpp-template-default/Classes/HelloWorldScene.cpp` 与 `AppDelegate.cpp`，示例同样创建 Scene、Sprite 和 Label。

## Cocos2d-x 构建

仓库顶层 CMake 当前注释掉了模板目录，因此可用临时 wrapper 把引擎库和模板作为同一 CMake 工程构建。wrapper 位于 `/private/tmp/cocos2d-x4-hellocpp-wrapper/CMakeLists.txt`；配置和构建命令：

```sh
PYTHONPATH=/private/tmp/cocos-cmake-runtime \
  /private/tmp/cocos-cmake-runtime/bin/cmake \
  -S /private/tmp/cocos2d-x4-hellocpp-wrapper \
  -B /private/tmp/cocos2d-x4-hellocpp-wrapper-build-x86_64 \
  -DCMAKE_OSX_ARCHITECTURES=x86_64 \
  -DCMAKE_DISABLE_PRECOMPILE_HEADERS=ON

PYTHONPATH=/private/tmp/cocos-cmake-runtime \
  /private/tmp/cocos-cmake-runtime/bin/cmake \
  --build /private/tmp/cocos2d-x4-hellocpp-wrapper-build-x86_64 \
  --target HelloCpp -j4
```

当前产物位于 `/private/tmp/cocos2d-x4-hellocpp-wrapper-build-x86_64/bin/HelloCpp/HelloCpp.app`，其 Mach-O 为 x86_64。构建成功。命令行直接启动曾在 GLFW/macOS `NSApplication` 注册阶段 abort；从桌面会话打开 app bundle 后，`HelloCpp` 成功运行并显示默认 Cocos2d-x 图标、`Hello World` 标签和帧统计。构建依赖与源码窄修正见[架构对照记录](comparisons/cocos2d-x-4-vs-creator-2.4.md#demo-构建与运行状态2026-10-17)。

## Creator 场景

先按仓库 `AGENTS.md` 的身份核验流程确认 Dashboard 工程条目、Editor 版本和工程路径一致，再在 Creator 资源管理器双击 `assets/Scene/Cocos2dComparison.fire`。当前已确认 Dashboard 与 Editor 都对应 Creator 2.4.15 工程 `/Users/youjunmao/WORK/Cocos_Engine/2.4.15NewProject`，并且场景编辑器显示独立场景中的 Sprite 和 Label。

Creator 浏览器预览默认使用 `settings/project.json` 中的 `start-scene`。本轮没有改动这个默认值，也没有改动原 `helloworld.fire`。在 Creator 顶部预览场景下拉框选择 `Cocos2dComparison` 后启动，浏览器运行画面已确认显示独立场景中的 Cocos Sprite、`Label` 和深色背景。运行前按仓库 `AGENTS.md` 核对 Dashboard 条目、Creator 2.4.15 窗口标题和工程路径 `/Users/youjunmao/WORK/Cocos_Engine/2.4.15NewProject`。

## 运行时对照（2026-10-17）

| 项目 | Cocos2d-x 4 `HelloCpp` | Creator 2.4.15 `Cocos2dComparison` |
| --- | --- | --- |
| 启动方式 | 桌面会话打开 macOS app bundle | Creator 预览入口选择场景并启动 Chrome |
| 运行后端 | C++ 原生 GLFW/OpenGL，x86_64（Rosetta） | Creator JS runtime / Chrome WebGL |
| 画面 | 黑底、Cocos2d-x 标志、`Hello World` | 深色背景、Cocos Sprite、`Label` |
| 画面尺寸 | 约 960×640 | 约 960×640 |
| 运行状态 | 窗口成功启动并持续绘制 | 浏览器预览成功启动并持续绘制 |

现场统计面板曾分别显示约 57 FPS 和 116 FPS；这是一次截图时的短时状态读数。两端运行后端和宿主刷新机制不同，不能据此判断谁更快。尚未完成统一原生后端/相同素材与构建模式下的性能基准。

## 比较限制与下一步

- 已完成：Cocos2d-x `cpp-tests` 引擎冒烟运行；`HelloCpp` 模板构建和原生启动；Creator 对照场景的编辑器加载与浏览器运行；运行链路、首屏内容和画面尺寸观察。
- 未完成：同后端/同架构/同素材 Release 构建、稳定帧时间采样、启动耗时基准。当前 FPS 现场读数不构成性能结论。
- 后续若要比较性能，应先把 Creator 也构建为 macOS 原生目标，并统一分辨率、资产、帧率限制、窗口尺寸与 Release 配置，再记录多轮预热后的平均值和分位帧时间。
