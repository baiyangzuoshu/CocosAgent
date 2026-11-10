# 第 52 课：资源处理与产物结构

**本课问题：** Cocos2d-x 4.x 如何在构建目标前同步 `Resources/`？

## 观察结果

模板登记 `Resources` 文件夹，并为 Linux/Windows app 创建 `SYNC_RESOURCE-<target>` 依赖目标。该目标调用 `sync_folder.py` 将资源同步到 app 的资源目录；这一步由 CMake helper 接线，不是引擎库链接的一部分。

## 源码位置

- [模板声明资源文件夹](../../engine/cocos2d-x-4/templates/cpp-template-default/CMakeLists.txt#L50)；[运行目录与同步目标接线](../../engine/cocos2d-x-4/templates/cpp-template-default/CMakeLists.txt#L158)。
- [`cocos_def_copy_resource_target` 建立依赖](../../engine/cocos2d-x-4/cmake/Modules/CocosBuildHelpers.cmake#L28)；[`sync_folder.py` 同步源目录和目标目录](../../engine/cocos2d-x-4/cmake/Modules/CocosBuildHelpers.cmake#L20)。

独立代码：[资源同步目标模型](src/resource/ResourceSyncPlan.h) 和 [输出示例](src/main.cpp)。

## 简化范围

程序只展示 Linux/Windows 目标的同步接线，不运行 CMake 或同步实际文件；其他平台和完整 app 包结构不在本课验收范围。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-4x-s52
/tmp/cocos2d-4x-s52
~~~
