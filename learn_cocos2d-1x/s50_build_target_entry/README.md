# 第 50 课：目标选择与构建入口

**本课问题：** 1.x 如何从目标平台找到对应工程入口和编译配置？

## 观察结果

1.x 按平台拆分工程文件，而不是统一调用一个跨平台构建器。Linux 示例从 `HelloWorld/linux/Makefile` 进入，定义 `LINUX` 并列出编译器 flags 与库目录；Win32 使用独立的 Visual Studio 项目。先选平台，再进入对应工程配置。

## 源码位置

- [Linux Makefile 的编译器和 flags](../../engine/cocos2d-x-1/HelloWorld/linux/Makefile#L1)；[`-DLINUX` 与链接库目录](../../engine/cocos2d-x-1/HelloWorld/linux/Makefile#L15)；[链接目标](../../engine/cocos2d-x-1/HelloWorld/linux/Makefile#L26)。
- [Win32 项目入口](../../engine/cocos2d-x-1/HelloWorld/win32/HelloWorld.win32.vcxproj)。

独立代码：[目标到工程入口的映射](src/build/BuildProfile.h) 和 [配置摘要程序](src/main.cpp)。默认 profile 对应 Linux Makefile。

## 简化范围

课程程序只打印平台工程入口和配置要点，不编译引擎或游戏项目。旧工程的 Debug/Release 选项属于各自 IDE/Makefile；示例保留 Linux Makefile 中实际出现的 `-g -O2`，不把它强行归类成统一模式。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-1x-s50
/tmp/cocos2d-1x-s50 linux
/tmp/cocos2d-1x-s50 win32
~~~
