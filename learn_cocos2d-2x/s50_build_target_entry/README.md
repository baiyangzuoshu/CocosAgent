# 第 50 课：目标选择与构建入口

**本课问题：** 2.x 如何从平台目标进入相应工程，并把配置交给该平台的构建系统？

## 观察结果

`multi-platform-cpp` 按平台提供工程目录。Linux 从 `proj.linux/Makefile` 进入并继续包含引擎的 `cocos2dx.mk`；Win32 则由 Visual Studio 项目承载配置。平台选择和 Debug/Release 设置分布在项目文件与构建系统中。

## 源码位置

- [Linux Makefile 的目标和源文件](../../engine/cocos2d-x-2/template/multi-platform-cpp/proj.linux/Makefile#L1)；[包含 `cocos2dx.mk`](../../engine/cocos2d-x-2/template/multi-platform-cpp/proj.linux/Makefile#L10)。
- [Win32 工程入口](../../engine/cocos2d-x-2/template/multi-platform-cpp/proj.win32/HelloCpp.vcxproj)；[平台目录在模板中的分布](../../engine/cocos2d-x-2/template/multi-platform-cpp)。

独立代码：[平台工程映射](src/build/BuildProfile.h) 和 [配置摘要程序](src/main.cpp)。

## 简化范围

程序只记录工程入口与配置来源，不调用 Make、Visual Studio 或完整引擎构建。它不假定不同平台共用同一套 flags。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-2x-s50
/tmp/cocos2d-2x-s50 linux
/tmp/cocos2d-2x-s50 win32
~~~
