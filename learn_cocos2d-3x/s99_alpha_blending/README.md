# 第 99 课：Alpha 与混合

**本课问题：** 半透明颜色怎样与已经画好的背景合成？Shader 输出和 Blend 因子必须怎样配套？

## 先看输入

前景 RGBA 是 `(1,0.25,0.1,0.5)`，背景是 `(0.1,0.1,0.1,1)`。Alpha 为 `0.5`，表示前景覆盖一半。

## 顺着代码读

入口是 `src/main.cpp`；本课逻辑在 `src/cocos/renderer/ShaderLesson.h`。这两个文件是本课独立小模型，不是从引擎复制出的可运行子集。

1. 普通 Alpha 的 RGB 公式是 `src.rgb×src.a + dst.rgb×(1-src.a)`。
2. 代入前景和背景，结果为 `(0.55,0.175,0.1)`。
3. 预乘 Alpha 要先把前景 RGB 乘以 0.5，得到 `(0.5,0.125,0.05,0.5)`；对应公式变成 `src.rgb + dst.rgb×(1-src.a)`，结果相同。
4. 查看本版 Sprite/渲染状态如何提供 BlendFunc：Sprite 的 BlendFunc 随渲染命令进入 Renderer，执行时再应用到 OpenGL 状态。

## 输出说明

两种正确配对得到相同 RGB。若 Shader 已预乘 Alpha，却仍用普通 Alpha 的源因子，RGB 会被再次乘 0.5，边缘会变暗。透明颜色和 BlendFunc 必须配套。

## 对照 Cocos2d-x 3.x 3.17.2 源码

- [`cocos/2d/CCSprite.cpp`](../../engine/cocos2d-x-3/cocos/2d/CCSprite.cpp)
- [`cocos/renderer/CCRenderState.cpp`](../../engine/cocos2d-x-3/cocos/renderer/CCRenderState.cpp)

Cocos2d-x 3.17.2 使用 GLProgram/GLProgramState 和 Renderer；不套用 4.0 backend ProgramState。


## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp -o /tmp/cocos-shader-3x-s99
/tmp/cocos-shader-3x-s99
~~~

只使用 C++11 标准库。这里的代码是职责/数据流模型，不会创建真实 OpenGL 或 Metal 上下文；Shader 语法与引擎职责请对照上面的本地源码和样例 Shader。

下一课：宏变体与平台边界。
