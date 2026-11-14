# 第 98 课：自定义 Uniform 与材质参数

**本课问题：** 游戏侧设置的 u_tint 怎样在绘制时到达片元 Shader？

## 先看输入

游戏侧设置 `u_tint=(0.25,0.65,1,1)`。它是一次绘制使用的参数，不是顶点字段，也不是贴图内容。

## 顺着代码读

入口是 `src/main.cpp`；本课逻辑在 `src/cocos/renderer/ShaderLesson.h`。这两个文件是本课独立小模型，不是从引擎复制出的可运行子集。

1. `GLProgramState::setUniformVec4()` 先把四个分量保存在状态对象中。
2. 小模型里的 `Pass::bind()` 再调用 `GLProgramState::apply()`；本版引擎侧可从 `GLProgramState::apply()` 追到 Uniform 更新。
3. 示例 Uniform 位置只是模型数据；对照输出中的颜色值，确认四个分量没有丢失或换序。

## 输出说明

模型只记录“游戏代码设置参数”与“绘制时把参数交给 Shader”两步，不执行真实 GPU Uniform 更新。检查源码时，重点找设置接口，以及哪一步把存储值提交给当前 Program。

## 对照 Cocos2d-x 3.x 3.17.2 源码

- [`cocos/renderer/CCGLProgramState.cpp`](../../engine/cocos2d-x-3/cocos/renderer/CCGLProgramState.cpp)
- [`cocos/renderer/CCGLProgramState.h`](../../engine/cocos2d-x-3/cocos/renderer/CCGLProgramState.h)

Cocos2d-x 3.17.2 使用 GLProgram/GLProgramState 和 Renderer；不套用 4.0 backend ProgramState。


## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp -o /tmp/cocos-shader-3x-s98
/tmp/cocos-shader-3x-s98
~~~

只使用 C++11 标准库。这里的代码是职责/数据流模型，不会创建真实 OpenGL 或 Metal 上下文；Shader 语法与引擎职责请对照上面的本地源码和样例 Shader。

下一课：Alpha 与混合。
