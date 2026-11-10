# 第 51 课：代码与引擎构建

**本课问题：** Cocos2d-x 3.x 的 CMake 怎样把引擎库接到游戏目标？

## 观察结果

模板通过 `add_subdirectory` 纳入引擎 CMake；引擎创建 `cocos2d` 库目标，游戏再按平台创建可执行文件或 Android 共享库，并链接 `cocos2d`。CMake 根据目标依赖安排构建，不是课程程序手动编译源码。

## 源码位置

- [模板加入引擎子目录](../../engine/cocos2d-x-3/templates/cpp-template-default/CMakeLists.txt#L36)；[桌面/Android 游戏目标类型](../../engine/cocos2d-x-3/templates/cpp-template-default/CMakeLists.txt#L116)；[游戏链接 `cocos2d`](../../engine/cocos2d-x-3/templates/cpp-template-default/CMakeLists.txt#L124)。
- [引擎 `cocos2d` 库目标](../../engine/cocos2d-x-3/cocos/CMakeLists.txt#L120)；[引擎链接 external](../../engine/cocos2d-x-3/cocos/CMakeLists.txt#L124)。

独立代码：[CMake 目标图](src/build/BuildGraph.h) 和 [目标输出程序](src/main.cpp)。

## 简化范围

程序展示目标与依赖边，不调用 CMake 或完整引擎构建；`desktop` 只代表非 Android 目标，不宣称任一桌面平台已验收。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-3x-s51
/tmp/cocos2d-3x-s51 desktop
/tmp/cocos2d-3x-s51 android
~~~
