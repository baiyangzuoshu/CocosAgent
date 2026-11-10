# 第 53 课：启动与交付

**本课问题：** Cocos2d-x 2.x 的 Linux 入口怎样把应用交给首个 Scene？

## 观察结果

Linux main 调用 CCApplication::sharedApplication()->run()；应用回调进入 AppDelegate::applicationDidFinishLaunching，再让 CCDirector::runWithScene 启动场景。平台程序与 Resources 目录一起交付；Marmalade、Android、Win32 等目标有各自的工程入口。

## 源码位置

- [Linux main 调用 CCApplication::run](../../engine/cocos2d-x-2/template/multi-platform-cpp/proj.linux/main.cpp#L18)。
- [AppDelegate 配置 Director 并运行场景](../../engine/cocos2d-x-2/template/multi-platform-cpp/Classes/AppDelegate.cpp#L14)；[runWithScene 调用](../../engine/cocos2d-x-2/template/multi-platform-cpp/Classes/AppDelegate.cpp#L31)。
- [Marmalade 的平台工程与数据目录](../../engine/cocos2d-x-2/template/multi-platform-cpp/proj.marmalade/HelloCpp.mkb#L4)；前置课：[第 52 课：资源处理与产物结构](../s52_resource_artifacts/README.md)。

独立代码按 platform/main.cpp、platform/CCApplication.h、Classes/AppDelegate.cpp 和 cocos2d/core/CCDirector.h 分出平台入口、启动回调与 Director。

## 简化范围

示例只模拟 Linux 入口，不链接引擎、不复制资源或生成平台安装包。真实平台工程的宿主和包结构不同。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/platform/main.cpp src/Classes/AppDelegate.cpp -o /tmp/cocos2d-2x-s53
/tmp/cocos2d-2x-s53
~~~
