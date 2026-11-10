# 第 32 课（ENG04）：Application、AppDelegate 与初始化

**目标：** 沿着 `Application::run()` 进入默认模板的 `AppDelegate::applicationDidFinishLaunching()`，梳理 Director、GLView、设计分辨率与首个 Scene 的初始化顺序。

## 本课范围

本课基于本地 Cocos2d-x 4.0 的默认 C++ 模板。它从平台已创建或准备创建 `Application` 的位置继续，跟到首个 Scene 交给 Director；不展开 Director 内部场景切换规则（ENG05），也不展开平台帧循环（ENG06）。

证据来自本地 C++ / Objective-C 源码和平台 `Application` 实现。本课没有配置或构建工程，也没有运行应用，因此不判断窗口是否出现、首帧是否绘制或启动时序是否符合预期。

## 进入 AppDelegate 初始化回调

第 31 课追踪到平台调用 `Application::run()`。平台实现会调用 `applicationDidFinishLaunching()`，默认模板在 [`Classes/AppDelegate.cpp`](../../engine/cocos2d-x-4/templates/cpp-template-default/Classes/AppDelegate.cpp) 覆写该回调：

~~~text
Application::run()
  → AppDelegate::applicationDidFinishLaunching()
      → Director::getInstance()
      → 复用已有 GLView，或按平台创建 GLView
      → 设置帧率显示、动画间隔和设计分辨率
      → 计算 contentScaleFactor
      → register_all_packages()（模板默认是空实现）
      → HelloWorld::createScene()
      → Director::runWithScene(scene)
      → return true
~~~

初始化所需的 OpenGL 属性由模板的 [`AppDelegate::initGLContextAttrs()`](../../engine/cocos2d-x-4/templates/cpp-template-default/Classes/AppDelegate.cpp) 提供，颜色/透明度、深度缓冲、模板缓冲和多重采样参数为 `{8, 8, 8, 8, 24, 8, 0}`。这些属性由平台入口在创建图形上下文前调用；调用位置随平台而不同。

## GLView 由谁创建

`applicationDidFinishLaunching()` 先用 `Director::getInstance()` 获取 Director，再读取 `director->getOpenGLView()`：

- 如果平台桥接已设置 GLView，模板复用现有对象。
- 如果还没有 GLView，桌面宏分支用 `GLViewImpl::createWithRect()` 建立窗口视图；其他分支用 `GLViewImpl::create()`。
- 只有新建时才调用 `director->setOpenGLView(glview)`。

默认模板中的平台分工如下：

| 平台 | `initGLContextAttrs()` 和 GLView 的接线 | 本地证据 |
| --- | --- | --- |
| macOS / Linux / Windows | 平台 `Application::run()` 先调用 `initGLContextAttrs()`；默认模板在回调中按需创建桌面 GLView | [macOS `Application::run`](../../engine/cocos2d-x-4/cocos/platform/mac/CCApplication-mac.mm)、[Linux](../../engine/cocos2d-x-4/cocos/platform/linux/CCApplication-linux.cpp)、[Windows](../../engine/cocos2d-x-4/cocos/platform/win32/CCApplication-win32.cpp) |
| iOS | [`AppController.mm`](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.ios_mac/ios/AppController.mm) 先设置 GL 属性、创建 UIKit 窗口和 GLView，再调用 `Application::run()` | AppController 生命周期回调与 [iOS `Application::run`](../../engine/cocos2d-x-4/cocos/platform/ios/CCApplication-ios.mm) |
| Android | JNI `getGLContextAttrs()` 调用 `initGLContextAttrs()`；首次 `nativeInit()` 创建并设置 GLView，再调用 `Application::run()` | [`javaactivity-android.cpp`](../../engine/cocos2d-x-4/cocos/platform/android/javaactivity-android.cpp) 及 [Android `Application::run`](../../engine/cocos2d-x-4/cocos/platform/android/CCApplication-android.cpp) |

所以，不能假定 `AppDelegate` 在所有平台都负责新建窗口视图。模板代码先查询当前状态，只有视图为空才走本地创建分支。

## 设计分辨率与内容缩放

默认模板在 `AppDelegate.cpp` 中设定：设计分辨率 `480 × 320`，小尺寸参考 `480 × 320`、中尺寸参考 `1024 × 768`、大尺寸参考 `2048 × 1536`。回调执行以下步骤：

1. `director->setDisplayStats(true)` 打开统计信息显示。
2. `director->setAnimationInterval(1.0f / 60)` 设置模板希望采用的动画间隔。
3. `glview->setDesignResolutionSize(..., ResolutionPolicy::NO_BORDER)` 设置设计坐标尺寸与适配策略。
4. 读取 `glview->getFrameSize()`，依据帧高度选取小、中或大参考尺寸。
5. 用参考尺寸与设计分辨率的宽高比例较小值设置 `contentScaleFactor`。

分档条件和缩放公式如下：

| `frameSize.height` 条件 | 参考尺寸 | `contentScaleFactor` |
| --- | --- | --- |
| `> 768` | `2048 × 1536` | `MIN(1536 / 320, 2048 / 480)` |
| `> 320` 且不大于 `768` | `1024 × 768` | `MIN(768 / 320, 1024 / 480)` |
| 不大于 `320` | `480 × 320` | `MIN(320 / 320, 480 / 480)` |

这里能读出模板的选择条件与计算方式；屏幕适配后的视觉效果仍需在目标设备或模拟器观察。

## 首个 Scene 的准备

初始化末尾调用 [`HelloWorld::createScene()`](../../engine/cocos2d-x-4/templates/cpp-template-default/Classes/HelloWorldScene.cpp)，取得场景对象后交给 `director->runWithScene(scene)`。默认 `createScene()` 调用 `HelloWorld::create()`；其 `init()` 创建示例菜单、文字和 Sprite。最后回调返回 `true`，表示启动初始化成功并可继续。

如果回调返回 `false`，各平台的 `Application::run()` 会停止或跳过后续运行流程；具体返回值和事件循环行为由平台实现决定。本课只确认调用关系，不推导首帧时序。ENG05 会继续跟 Director 如何接收和切换 Scene。

## 动手练习

1. 从 `Application::run()` 找到 `applicationDidFinishLaunching()` 的调用点，比较桌面、iOS、Android 分别在回调前设置了哪些图形状态。
2. 在 `AppDelegate.cpp` 标出“取已有 GLView”“必要时创建”“设置到 Director”的条件路径，并解释为何模板会先查询。
3. 把设计分辨率、三档参考尺寸、高度判断条件和 `MIN` 比例计算整理成表格。
4. 从 `HelloWorld::createScene()` 追踪到 `runWithScene(scene)`，说明静态源码能确认哪些准备步骤，哪些仍需实际运行观察。

## 简化说明

- 只研究仓库默认模板；具体项目可能自定义 GLView、分辨率、启动回调和 Scene。
- `setAnimationInterval(1/60)` 是模板配置值，不构成目标设备达到 60 FPS 的证据。
- `runWithScene()` 被调用不等于画面已呈现；平台配置、构建、启动和首帧观察需分别验证。

## 参考资料

- [Cocos2d-x 启动与帧循环专题 Skill](../../plugins/cocos2d-x-4/skills/cocos2d-x-4-startup-frame/SKILL.md)
- [仓库 Cocos2d-x 4.0 与 Creator 2.4.15 对照研究计划](../../docs/cocos2d-x-creator2x-source-study-plan.md)
- [默认模板 AppDelegate](../../engine/cocos2d-x-4/templates/cpp-template-default/Classes/AppDelegate.cpp)
- [默认模板 HelloWorld Scene](../../engine/cocos2d-x-4/templates/cpp-template-default/Classes/HelloWorldScene.cpp)
- [本地启动与帧循环源码追踪](../../docs/cocos2d-x/01-startup-and-frame.md)
