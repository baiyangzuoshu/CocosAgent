# 第 61 课：3.x GLProgramState 保存并应用 Uniform

**本课问题：** 3.x 如何先把 Uniform 值存在 GLProgramState，再在 Pass 绑定时应用到 GLProgram？

## 本版渲染路径

GLProgramState 初始化时根据 GLProgram 的反射结果建立 UniformValue。setUniformFloat() 只更新对应值；Pass::bind() 再调用 GLProgramState 应用程序和 UniformValue，最终由 GLProgram 发出 glUniform*。这条示例只展示 Uniform，不包含完整内建变量与顶点属性路径。

## 源码位置

- [CCGLProgramState.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCGLProgramState.cpp)：UniformValue::apply() 写入 Uniform；GLProgramState::apply()、applyUniforms() 应用程序参数。
- [CCGLProgramState.h](../../engine/cocos2d-x-3/cocos/renderer/CCGLProgramState.h)：GLProgramState 和 UniformValue 的数据职责。
- [CCGLProgram.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCGLProgram.cpp)：Shader 程序、Uniform 反射结果及 glUniform* 封装。
- [CCPass.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCPass.cpp)：Pass 绑定时应用 GLProgramState 与 RenderState。

## 独立代码与简化

src/cocos/renderer/ 保留 GLProgram、GLProgramState、UniformValue 和 Pass 的调用关系。Uniform 类型简化为 float，日志代替真实 OpenGL；不实现自动绑定、纹理 Uniform、属性缓存和 RenderState。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/renderer/CCGLProgram.cpp src/cocos/renderer/CCGLProgramState.cpp src/cocos/renderer/CCPass.cpp -o /tmp/cocos2d-3x-s61
/tmp/cocos2d-3x-s61
~~~

setUniformFloat() 后先输出“no GL uniform call before Pass::bind”；绑定 Pass 后才出现 GLProgram 使用和 Uniform 写入日志。
