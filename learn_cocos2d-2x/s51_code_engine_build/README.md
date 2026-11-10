# 第 51 课：代码与引擎构建

**本课问题：** Cocos2d-x 2.x 的 Makefile 怎样让游戏依赖引擎共享库？

## 观察结果

`cocos2dx.mk` 负责引擎源文件到对象文件以及 `libcocos2d.so` 的规则。`HelloCpp` 的 Linux Makefile 包含这组规则，并显式声明游戏目标依赖引擎库，最终把游戏对象文件与 `-lcocos2d` 链接起来。

## 源码位置

- [引擎共享库目标](../../engine/cocos2d-x-2/cocos2dx/proj.linux/Makefile#L1)；[目标依赖对象文件](../../engine/cocos2d-x-2/cocos2dx/proj.linux/Makefile#L151)；[链接为共享库](../../engine/cocos2d-x-2/cocos2dx/proj.linux/Makefile#L153)。
- [游戏 Makefile 包含引擎规则](../../engine/cocos2d-x-2/template/multi-platform-cpp/proj.linux/Makefile#L9)；[游戏目标依赖引擎库](../../engine/cocos2d-x-2/template/multi-platform-cpp/proj.linux/Makefile#L15)；[链接 `-lcocos2d`](../../engine/cocos2d-x-2/template/multi-platform-cpp/proj.linux/Makefile#L17)。

独立代码：[Make 目标依赖图](src/build/BuildGraph.h) 和 [图输出程序](src/main.cpp)。

## 简化范围

程序只表达核心引擎库到游戏目标的依赖，不调用 Make，也不展开平台库、音频库和资源打包规则。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-2x-s51
/tmp/cocos2d-2x-s51
~~~
