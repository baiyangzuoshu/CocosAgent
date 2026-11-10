# 第 51 课：代码与引擎构建

**本课问题：** Cocos2d-x 1.x 怎样先生成引擎库，再把游戏链接到它？

## 观察结果

Linux Makefile 把引擎源文件编译成对象文件并链接为 `libcocos2d.so`；游戏工程再编译自己的对象文件，链接该共享库生成 `HelloWorld`。`build-linux.sh` 先构建并拷贝引擎库，游戏目标由独立 Makefile 管理。

## 源码位置

- [引擎库目标](../../engine/cocos2d-x-1/cocos2dx/proj.linux/Makefile#L3)；[对象文件链接为 `libcocos2d.so`](../../engine/cocos2d-x-1/cocos2dx/proj.linux/Makefile#L128)。
- [游戏目标和 `-DLINUX`](../../engine/cocos2d-x-1/HelloWorld/linux/Makefile#L3)；[链接 `-lcocos2d`](../../engine/cocos2d-x-1/HelloWorld/linux/Makefile#L22)。
- [`build-linux.sh` 调用 Make](../../engine/cocos2d-x-1/build-linux.sh#L53) 并[拷贝引擎库](../../engine/cocos2d-x-1/build-linux.sh#L54)。

独立代码：[Make 目标依赖图](src/build/BuildGraph.h) 和 [图输出程序](src/main.cpp)。

## 简化范围

程序只打印引擎库与游戏目标的依赖，不运行旧版 Linux 构建，也不包含音频、Box2D 等其他库的构建步骤。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-1x-s51
/tmp/cocos2d-1x-s51
~~~
