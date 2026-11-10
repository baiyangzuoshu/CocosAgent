# 第 31 课（ENG03）：平台入口与应用创建

**目标：** 从默认 C++ 模板的 CMake 平台分支出发，找到桌面、iOS 和 Android 的启动入口，并说明各平台怎样创建 `AppDelegate`，再通过 `Application::getInstance()` 取得应用对象。

## 本课代码快照

src/main.cpp 独立模拟桌面 main 与 Android JNI 钩子两种入口。两个路径最终都通过 Application::getInstance() 调用 AppDelegate 的启动回调；它不冒充真实平台入口或 JNI 实现。

源码： [src/main.cpp](src/main.cpp)；课程结构参考 [Creator 第 2 课](../../learn_3.8cocoscreator/s02_game_startup/README.md)。

在本课目录编译并运行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror src/main.cpp -o /tmp/learn-cpp-s31
/tmp/learn-cpp-s31
/tmp/learn-cpp-s31 android
~~~

预期观察：默认路径先显示 desktop main，android 参数路径显示 Android JNI hook；两条路径都会进入 Application::run 和 AppDelegate 回调。

本次已用 Apple Clang 21 按 C++17 严格警告选项编译并运行该教学示例；这验证的是独立课程代码，不是 Cocos2d-x 引擎运行。

## 本课范围

观察对象是本地 `engine/cocos2d-x-4/templates/cpp-template-default/`。本课从模板目标选择一路跟到平台入口、应用对象和 `Application::run()` 的回调边界；`AppDelegate` 如何配置 Director、创建首个场景留到 ENG04，帧循环留到 ENG06。

本课基于本地 CMake、C++、Objective-C/Java 和 JNI 源码做静态追踪，没有配置、构建或启动任何平台工程。

## CMake 选择平台入口

默认模板的 [`CMakeLists.txt`](../../engine/cocos2d-x-4/templates/cpp-template-default/CMakeLists.txt) 按目标平台把不同文件加入 `GAME_SOURCE`：

| 平台分支 | 模板入口文件 | 构建目标形态 |
| --- | --- | --- |
| macOS desktop | [`proj.ios_mac/mac/main.cpp`](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.ios_mac/mac/main.cpp) | CMake 可执行程序 |
| Linux | [`proj.linux/main.cpp`](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.linux/main.cpp) | CMake 可执行程序 |
| Windows | [`proj.win32/main.cpp`](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.win32/main.cpp) | CMake 可执行程序 |
| iOS | [`proj.ios_mac/ios/main.m`](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.ios_mac/ios/main.m)、`AppController.mm` | iOS 应用目标；由 UIKit 生命周期启动 |
| Android | [`proj.android/app/jni/hellocpp/main.cpp`](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.android/app/jni/hellocpp/main.cpp) | Android JNI 共享库，不是带普通 C++ `main()` 的可执行程序 |

模板 CMake 文件在 Android 分支用 `add_library(... SHARED ...)`，其他分支用 `add_executable(...)`。因此，不能只找一个叫 `main.cpp` 的文件来代表所有平台：CMake 选择源文件，平台宿主再调用相应入口或桥接层。

## 五条启动路径

### macOS、Linux 与 Windows desktop

这三条桌面路径都是 C++ 进程入口，随后创建一个局部 `AppDelegate`：

~~~cpp
#include "AppDelegate.h"
#include "cocos2d.h"

USING_NS_CC;

int main(int argc, char* argv[])
{
    AppDelegate app;
    return Application::getInstance()->run();
}
~~~

- macOS 和 Linux 使用 `main()`；Windows 模板用 `_tWinMain()`。
- `app` 是自动存储期对象，活在入口函数调用期间。它私有继承 `cocos2d::Application`；基类构造函数把当前对象注册为 `Application` 的共享实例。
- `Application::getInstance()` 返回已注册的基类指针，然后进入该平台的 `Application::run()`。

可对照 [macOS 入口](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.ios_mac/mac/main.cpp)、[Linux 入口](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.linux/main.cpp)、[Windows 入口](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.win32/main.cpp) 和 [`AppDelegate` 声明](../../engine/cocos2d-x-4/templates/cpp-template-default/Classes/AppDelegate.h)。平台 `Application` 的构造函数分别位于 [macOS](../../engine/cocos2d-x-4/cocos/platform/mac/CCApplication-mac.mm)、[Linux](../../engine/cocos2d-x-4/cocos/platform/linux/CCApplication-linux.cpp) 与 [Windows](../../engine/cocos2d-x-4/cocos/platform/win32/CCApplication-win32.cpp) 实现中。

### iOS

[`main.m`](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.ios_mac/ios/main.m) 调用 `UIApplicationMain()`，把控制权交给 UIKit。模板的 [`AppController.mm`](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.ios_mac/ios/AppController.mm) 在文件作用域持有 `static AppDelegate s_sharedApplication`；应用进入启动回调时，它通过 `Application::getInstance()` 获取该对象并调用 `run()`。这是 UIKit 生命周期接入，不是桌面版的 C++ `main()` 调用序列。

### Android

Android 的模板 C++ 文件提供的是 JNI 初始化钩子 `cocos_android_app_init(JNIEnv*)`。它通过文件作用域的 `std::unique_ptr<AppDelegate>` 创建并持有 `AppDelegate`。引擎的 [`javaactivity-android.cpp`](../../engine/cocos2d-x-4/cocos/platform/android/javaactivity-android.cpp) 在 `JNI_OnLoad()` 中调用这个钩子；之后 Java GL Renderer 在 `onSurfaceCreated()` 中调用 native `nativeInit()`，JNI 代码再取得 `Application` 实例并调用 `run()`。

模板 Java Activity [`AppActivity.java`](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.android/app/src/org/cocos2dx/cpp/AppActivity.java) 继承引擎的 `Cocos2dxActivity`。实际启动经过 Android Activity、GL Renderer 和 JNI 桥接；不能把 Android 的 JNI 钩子误认为进程入口 `main()`。

## `AppDelegate` 为什么能被 `getInstance()` 找到

模板中的 [`AppDelegate`](../../engine/cocos2d-x-4/templates/cpp-template-default/Classes/AppDelegate.h) 私有继承 `cocos2d::Application`。各平台 `Application` 构造函数把 `this` 存进静态共享指针，平台版 `Application::getInstance()` 再返回该指针。也就是说，`getInstance()` 不会另行创建一个 `Application`；返回的是启动代码已经创建的 `AppDelegate` 对象中的 `Application` 基类子对象。

创建和持有方式因平台而异：桌面入口函数中的局部对象、iOS 的文件作用域静态对象、Android 由 `unique_ptr` 管理的动态对象。对象储存期不同，但都在 `run()` 入口处汇合到 `Application` 接口。

`Application::run()` 会调用虚函数 `applicationDidFinishLaunching()`，由模板的 `AppDelegate` 覆写。此处是下一课 ENG04 的起点；不同平台如何驱动 Director 帧循环则留到 ENG06。

## 动手练习

1. 在模板 `CMakeLists.txt` 中找到五个平台的条件分支，记录每个分支加入了哪些入口文件，以及目标是可执行程序还是共享库。
2. 分别查看 macOS、Windows 和 Linux 的入口函数，标出 `AppDelegate` 对象的储存期和调用 `run()` 的语句。
3. 沿着 Android 的 `AppActivity`、`Cocos2dxRenderer.nativeInit()`、JNI `nativeInit()` 和 `cocos_android_app_init()` 写出启动顺序。
4. 对照 `AppDelegate.h` 和各平台 `CCApplication` 实现，解释 `Application::getInstance()` 返回的对象从何而来。
5. 标注哪些结论来自静态源码；不要据此推断目标设备的启动时序、首帧结果或帧率。

## 简化说明

- 本课只读默认 C++ 模板。本地游戏项目可能改过入口文件、应用类、平台工程或 JNI 接线，需以目标项目自身配置为准。
- CMake 条件、函数调用和类构造关系属于静态源码证据，不等于该平台工程已经成功编译或运行。
- 已有[启动与帧循环源码追踪](../../docs/cocos2d-x/01-startup-and-frame.md)重点记录默认 macOS desktop 路径；不能将其自动推广到 iOS、Android、Windows 或 Linux。

## 参考资料

- [Cocos2d-x 启动与帧循环专题 Skill](../../plugins/cocos2d-x-4/skills/cocos2d-x-4-startup-frame/SKILL.md)
- [仓库 Cocos2d-x 4.0 与 Creator 2.4.15 对照研究计划](../../docs/cocos2d-x-creator2x-source-study-plan.md)
- [默认 C++ 模板 CMake](../../engine/cocos2d-x-4/templates/cpp-template-default/CMakeLists.txt)
- [本地启动与帧循环源码追踪](../../docs/cocos2d-x/01-startup-and-frame.md)
