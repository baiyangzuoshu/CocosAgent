# 第 100 课：宏变体与平台边界

**本课问题：** 宏开关变化时，程序缓存怎样决定复用旧 Program 还是创建新变体？

## 先看输入

本课把同一 Shader 请求三次：`USE_TINT=1`、`USE_TINT=0`、再一次 `USE_TINT=1`。不同宏会让编译后的程序包含不同分支。

## 顺着代码读

入口是 `src/main.cpp`；本课逻辑在 `src/cocos2dx/shaders/ShaderLesson.h`。这两个文件是本课独立小模型，不是从引擎复制出的可运行子集。

1. `get()` 把 Shader 名和宏值组合成课程模型的 key。
2. 第一次请求创建 `program-1`；第二个宏值不同，因此创建 `program-2`。
3. 第三次 key 与第一次相同，命中模型缓存，复用 `program-1`。
4. 所以结果应是两个不同 Program ID，第三次与第一次相同，缓存大小为 2。

## 输出说明

这个例子只解释“不同编译输入需要区分、相同输入可以复用”的概念。它的 `name + defines` 是教学模型，**不代表本版引擎必然用相同 key 规则**。本版源码的缓存边界是：`CCShaderCache` 以调用者传入的 key 管理程序；内置程序使用各自的符号 key。课程模型把宏加入 key 是为了演示原则。宏语法与图形平台限制也要按本版 Shader 和后端核对。

## 对照 Cocos2d-x 2.x 2.2.6 源码

- [`cocos2dx/shaders/CCShaderCache.cpp`](../../engine/cocos2d-x-2/cocos2dx/shaders/CCShaderCache.cpp)
- [`cocos2dx/shaders/ccShaders.cpp`](../../engine/cocos2d-x-2/cocos2dx/shaders/ccShaders.cpp)
- [`cocos2dx/shaders/CCGLProgram.cpp`](../../engine/cocos2d-x-2/cocos2dx/shaders/CCGLProgram.cpp)

Cocos2d-x 2.2.6 沿 CCGLProgram/CCShaderCache 和直接 OpenGL 绘制；不引入 3.x Renderer 命令队列。


## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp -o /tmp/cocos-shader-2x-s100
/tmp/cocos-shader-2x-s100
~~~

只使用 C++11 标准库。这里的代码是职责/数据流模型，不会创建真实 OpenGL 或 Metal 上下文；Shader 语法与引擎职责请对照上面的本地源码和样例 Shader。

下一课：Sprite 接入与调试。
