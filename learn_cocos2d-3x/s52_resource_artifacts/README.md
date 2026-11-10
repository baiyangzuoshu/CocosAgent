# 第 52 课：资源处理与产物结构

**本课问题：** Cocos2d-x 3.x 的 CMake 如何把 `Resources/` 放进运行目录？

## 观察结果

模板把 `Resources` 记为游戏资源文件夹。Linux/Windows 目标构建后，`cocos_copy_target_res` 用 `copy_if_different` 复制到可执行文件旁的 `Resources/`，并保留子目录相对路径。

## 源码位置

- [模板声明资源文件夹并登记资源](../../engine/cocos2d-x-3/templates/cpp-template-default/CMakeLists.txt#L42)；[构建后复制到目标目录](../../engine/cocos2d-x-3/templates/cpp-template-default/CMakeLists.txt#L149)。
- [`cocos_copy_target_res` 复制资源并保留相对路径](../../engine/cocos2d-x-3/cmake/Modules/CocosBuildHelpers.cmake#L28)；[遍历资源文件夹](../../engine/cocos2d-x-3/cmake/Modules/CocosBuildHelpers.cmake#L20)。

独立代码：[资源复制计划模型](src/resource/ResourceCopyPlan.h) 和 [输出目录示例](src/main.cpp)。

## 简化范围

程序只演示 Linux/Windows 桌面目标的目录映射，不调用 CMake 或复制文件；Apple、Android 等平台由各自构建流程处理。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-3x-s52
/tmp/cocos2d-3x-s52
~~~
