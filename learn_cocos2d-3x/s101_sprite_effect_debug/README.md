# 第 101 课：Sprite 接入与调试

**本课问题：** 从 Sprite 的顶点、UV 和颜色开始，程序、Uniform、纹理如何一路走到 draw 调用？

## 先看输入

本课用一个 Sprite、一份顶点/UV/颜色数据、一张贴图和一个带 `u_tint` 的 Program。排查时依次确认：几何是否准备、Program 是否绑定、参数和纹理是否提交、最后有没有 draw。

## 顺着代码读

入口是 `src/main.cpp`；本课逻辑在 `src/cocos/2d/SpriteShaderLesson.h`。这两个文件是本课独立小模型，不是从引擎复制出的可运行子集。

1. 本版绘制顺序是：Sprite 生成 TrianglesCommand，Renderer 排队并执行；GLProgramState 在绘制阶段应用，再由 OpenGL 绘制三角形。
2. `main.cpp` 调用本课 Sprite 模型，按顺序打印上述节点。
3. 若日志在某一步停止，就从那一步对应的源码入口继续查；命令已提交但画面错误，再检查 Shader 输入、纹理、Uniform 和 Blend。

## 输出说明

本课输出的是一条可读的职责路径，帮助你把现象映射到源码。模型不创建图形上下文，也不声称一次终端输出就是实际 GPU 绘制。查看引擎时，从 Sprite 开始，沿本版 Renderer / Program 路径追到图形后端。

## 对照 Cocos2d-x 3.x 3.17.2 源码

- [`cocos/2d/CCSprite.cpp`](../../engine/cocos2d-x-3/cocos/2d/CCSprite.cpp)
- [`cocos/renderer/CCRenderer.cpp`](../../engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp)
- [`cocos/renderer/CCGLProgramState.cpp`](../../engine/cocos2d-x-3/cocos/renderer/CCGLProgramState.cpp)

Cocos2d-x 3.17.2 使用 GLProgram/GLProgramState 和 Renderer；不套用 4.0 backend ProgramState。


## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp -o /tmp/cocos-shader-3x-s101
/tmp/cocos-shader-3x-s101
~~~

只使用 C++11 标准库。这里的代码是职责/数据流模型，不会创建真实 OpenGL 或 Metal 上下文；Shader 语法与引擎职责请对照上面的本地源码和样例 Shader。

本课完成本阶段的 Sprite 接入链。
