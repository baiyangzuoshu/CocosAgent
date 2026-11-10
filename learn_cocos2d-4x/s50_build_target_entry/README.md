# 第 50 课：目标选择与构建入口

**本课问题：** 4.0 的 CMake 模板怎样依据目标平台选择程序入口和输出类型？

## 观察结果

4.0 的模板按 Android、Linux、Windows、Apple 分支选择平台入口；Android 构建共享库，桌面/iOS 构建可执行目标并链接 `cocos2d`。Debug/Release 由 CMake 生成器和配置共同决定；Xcode/Visual Studio 属于多配置生成器。

## 源码位置

- [CMakeLists 的平台分支和入口文件](../../engine/cocos2d-x-4/templates/cpp-template-default/CMakeLists.txt#L67)；[Android 与桌面输出类型](../../engine/cocos2d-x-4/templates/cpp-template-default/CMakeLists.txt#L124)；[链接引擎库](../../engine/cocos2d-x-4/templates/cpp-template-default/CMakeLists.txt#L132)。
- [`CMAKE_BUILD_TYPE` 选择模式](../../engine/cocos2d-x-4/cmake/README.md#L159)；[Xcode/Visual Studio 使用多配置](../../engine/cocos2d-x-4/cmake/README.md#L174)。
- [仓库版本与构建证据边界](../../docs/cocos2d-x-creator2x-source-study-plan.md)：本地 Cocos2d-x 4.0 源码为准；桌面构建结果不能外推到其他平台。

独立代码：[CMake profile 摘要](src/build/BuildProfile.h) 和 [目标选择程序](src/main.cpp)。

## 简化范围

程序映射模板目标并打印入口/输出类型，不运行 CMake 或完整引擎构建。输出只代表 profile 示例，未验证相应平台工具链和生成物。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-4x-s50
/tmp/cocos2d-4x-s50 macos Debug
/tmp/cocos2d-4x-s50 android Release
~~~
