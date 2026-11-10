# 第 53 课：启动与交付

**本课问题：** Cocos2d-x 4.x 的 Linux 程序如何从原生入口到达首个场景？

## 观察结果

Linux main 调用 Application::getInstance()->run()；运行时进入 AppDelegate::applicationDidFinishLaunching，配置 Director 后调用 runWithScene。桌面构建得到原生 app 目标，并在运行前同步 Resources；这与 Creator Web 静态站点的交付方式不同。

## 源码位置

- [Linux main 启动 Application](../../engine/cocos2d-x-4/templates/cpp-template-default/proj.linux/main.cpp#L38)。
- [AppDelegate 初始化并创建场景](../../engine/cocos2d-x-4/templates/cpp-template-default/Classes/AppDelegate.cpp#L69)；[Director::runWithScene](../../engine/cocos2d-x-4/templates/cpp-template-default/Classes/AppDelegate.cpp#L113)。
- [CMake 同步资源目标](../../engine/cocos2d-x-4/templates/cpp-template-default/CMakeLists.txt#L158)；[4.0 构建与平台证据边界](../../docs/cocos2d-x-creator2x-source-study-plan.md#L1)。
- 前置课：[第 52 课：资源处理与产物结构](../s52_resource_artifacts/README.md)。

独立代码拆分 platform/main.cpp、platform/Application.h、Classes/AppDelegate.cpp 和 cocos2d/core/Director.h。

## 简化范围

程序只模拟 Linux 桌面启动顺序，不运行 CMake、不同步实际资源、不生成 app 包。仓库的 4.0 构建证据不能外推到其他目标平台。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/platform/main.cpp src/Classes/AppDelegate.cpp -o /tmp/cocos2d-4x-s53
/tmp/cocos2d-4x-s53
~~~
