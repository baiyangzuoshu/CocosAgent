# 第 53 课：启动与交付

**本课问题：** Cocos2d-x 3.x 的 Linux 程序从 Application::run 到首个场景经过哪些层？

## 观察结果

Linux main 进入 Application::getInstance()->run()，平台层再调用 AppDelegate::applicationDidFinishLaunching。AppDelegate 设置 GLView、注册包并调用 Director::runWithScene。桌面产物是原生可执行文件与构建后复制的 Resources；其他目标平台要走各自工程。

## 源码位置

- [Linux main 启动 Application](../../engine/cocos2d-x-3/templates/cpp-template-default/proj.linux/main.cpp#L38)。
- [AppDelegate 初始化并创建场景](../../engine/cocos2d-x-3/templates/cpp-template-default/Classes/AppDelegate.cpp#L80)；[Director::runWithScene](../../engine/cocos2d-x-3/templates/cpp-template-default/Classes/AppDelegate.cpp#L124)。
- [模板的构建后资源复制](../../engine/cocos2d-x-3/templates/cpp-template-default/CMakeLists.txt#L149)；前置课：[第 52 课：资源处理与产物结构](../s52_resource_artifacts/README.md)。

独立代码拆成 platform/main.cpp、platform/Application.h、Classes/AppDelegate.cpp 与 cocos2d/core/Director.h，展示平台启动与引擎场景入口的边界。

## 简化范围

代码只打印 Linux 桌面启动链，不运行 CMake、不复制文件、不打包或启动真实游戏。Windows、macOS、Android、iOS 的包结构不由此示例推断。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/platform/main.cpp src/Classes/AppDelegate.cpp -o /tmp/cocos2d-3x-s53
/tmp/cocos2d-3x-s53
~~~
