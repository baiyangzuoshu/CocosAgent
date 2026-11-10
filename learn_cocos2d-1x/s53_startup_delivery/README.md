# 第 53 课：启动与交付

**本课问题：** Cocos2d-x 1.x 的 Linux 程序怎样从可执行文件进入首个 Scene？

## 观察结果

Linux 的 main 函数进入 CCApplication::run；平台层随后调用 AppDelegate::applicationDidFinishLaunching。AppDelegate 建立 Director 和 OpenGL view，再调用 runWithScene。交付物是原生程序及平台资源目录；上课示例只模拟 Linux 启动链。

## 源码位置

- [Linux main 调用 sharedApplication().run()](../../engine/cocos2d-x-1/HelloWorld/linux/main.cpp#L10)。
- [AppDelegate 配置 Director 并运行 Scene](../../engine/cocos2d-x-1/HelloWorld/Classes/AppDelegate.cpp#L109)；[runWithScene 调用](../../engine/cocos2d-x-1/HelloWorld/Classes/AppDelegate.cpp#L130)。
- [Linux 资源根路径示例](../../engine/cocos2d-x-1/HelloWorld/Classes/AppDelegate.cpp#L61)；前置课：[第 52 课：资源处理与产物结构](../s52_resource_artifacts/README.md)。

独立代码按 platform/main.cpp、platform/CCApplication.h、Classes/AppDelegate.cpp 和 cocos2d/core/CCDirector.h 分出宿主入口、应用回调与场景入口。

## 简化范围

代码只打印 Linux 启动顺序，不链接引擎或制作可分发包。Android、iOS、Win32 等平台有各自的宿主入口和包格式，不能由 Linux 示例推断。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/platform/main.cpp src/Classes/AppDelegate.cpp -o /tmp/cocos2d-1x-s53
/tmp/cocos2d-1x-s53
~~~
