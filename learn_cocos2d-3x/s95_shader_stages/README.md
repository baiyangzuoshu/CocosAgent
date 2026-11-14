# 第 95 课：Shader 源码与阶段

**本课问题：** 顶点 Shader 和片元 Shader 是两段不同程序，它们怎样组成一个可绘制的 Program？

## 先看输入

本课给程序两段字符串：顶点 Shader 有 `a_position` 并写 `gl_Position`；片元 Shader 输出固定蓝色。每段都需要自己的 `void main()`。

## 顺着代码读

入口是 `src/main.cpp`；本课逻辑在 `src/cocos/renderer/ShaderLesson.h`。这两个文件是本课独立小模型，不是从引擎复制出的可运行子集。

1. `main.cpp` 准备 vertex 和 fragment 两段源码。
2. `GLProgramCache` 按本版入口取得或登记程序对象。
3. `GLProgram` 分别处理顶点段和片元段；两段都成功后才可链接。
4. 观察输出中的两个阶段状态和链接状态。小模型只检查源码是否含 `void main`，不是真正的 GLSL 编译器。

## 输出说明

两段都通过时，输出 `link = ok`；删掉任一段的 `void main`，对应阶段或链接就失败。记住：Shader 是阶段源码，Program 是把阶段组合起来的对象。实际语法错误要看本版引擎调用的图形后端编译日志。

## 对照 Cocos2d-x 3.x 3.17.2 源码

- [`cocos/renderer/CCGLProgram.cpp`](../../engine/cocos2d-x-3/cocos/renderer/CCGLProgram.cpp)
- [`cocos/renderer/CCGLProgramCache.cpp`](../../engine/cocos2d-x-3/cocos/renderer/CCGLProgramCache.cpp)
- [`tests/cpp-tests/Resources/Shaders/`](../../engine/cocos2d-x-3/tests/cpp-tests/Resources/Shaders/)

Cocos2d-x 3.17.2 使用 GLProgram/GLProgramState 和 Renderer；不套用 4.0 backend ProgramState。


## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp -o /tmp/cocos-shader-3x-s95
/tmp/cocos-shader-3x-s95
~~~

只使用 C++11 标准库。这里的代码是职责/数据流模型，不会创建真实 OpenGL 或 Metal 上下文；Shader 语法与引擎职责请对照上面的本地源码和样例 Shader。

下一课：顶点输入与坐标变换。
