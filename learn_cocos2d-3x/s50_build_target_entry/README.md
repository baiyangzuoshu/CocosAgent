# 第 50 课：目标选择与构建入口

**本课问题：** 3.x 的 CMake 模板如何按目标选择入口文件、输出类型和构建模式？

## 观察结果

CMake 模板按 Android、Linux、Windows、Apple 分支加入平台入口；Android 输出共享库，其他示例目标创建可执行程序并链接 `cocos2d`。`CMAKE_BUILD_TYPE` 用于单配置生成器；Xcode/Visual Studio 生成多配置工程后，在 IDE 里选择 Debug/Release。

## 源码位置

- [CMakeLists 的平台分支和入口文件](../../engine/cocos2d-x-3/templates/cpp-template-default/CMakeLists.txt#L59)；[Android 与桌面输出类型](../../engine/cocos2d-x-3/templates/cpp-template-default/CMakeLists.txt#L116)；[链接引擎库](../../engine/cocos2d-x-3/templates/cpp-template-default/CMakeLists.txt#L124)。
- [`CMAKE_BUILD_TYPE` 选择模式](../../engine/cocos2d-x-3/cmake/README.md#L91)；[Xcode/Visual Studio 使用多配置](../../engine/cocos2d-x-3/cmake/README.md#L106)。

独立代码：[CMake profile 摘要](src/build/BuildProfile.h) 和 [目标选择程序](src/main.cpp)。

## 简化范围

程序把模板的目标分支映射成可读摘要，不调用 CMake、不链接 Cocos 引擎，也不声称 macOS/iOS/Android 等目标已构建。课程代码仅作为 profile 选择示例。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-3x-s50
/tmp/cocos2d-3x-s50 macos Debug
/tmp/cocos2d-3x-s50 android Release
~~~
