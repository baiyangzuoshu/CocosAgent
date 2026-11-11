# 第 61 课：2.x GLProgram、ShaderCache 与 Uniform

**本课问题：** 2.x 如何缓存 GLProgram，并在绘制时把 Uniform 值送入当前程序？

## 本版渲染路径

CCShaderCache 创建默认程序，配置属性位置后链接并更新 Uniform 信息，再按键保存 CCGLProgram。Sprite 的绘制准备使用程序；CCGLProgram 提供 Uniform location 查询和 glUniform* 写入入口。本课聚焦程序准备与参数路径。

## 源码位置

- [CCShaderCache.cpp](../../engine/cocos2d-x-2/cocos2dx/shaders/CCShaderCache.cpp)：loadDefaultShader() 创建默认 GLProgram，链接后调用 updateUniforms() 并保存缓存。
- [CCGLProgram.cpp](../../engine/cocos2d-x-2/cocos2dx/shaders/CCGLProgram.cpp)：编译、addAttribute()、link()、updateUniforms()、Uniform 查询和设置。
- [CCGLProgram.h](../../engine/cocos2d-x-2/cocos2dx/shaders/CCGLProgram.h)：程序与 Uniform 接口。
- [CCSprite.cpp](../../engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp)：CC_NODE_DRAW_SETUP() 是 Sprite 进入程序准备的入口。

## 独立代码与简化

src/cocos2dx/shaders/ 保留 ShaderCache 持有程序、GLProgram 配置属性/Uniform 和 Sprite 取程序的分层。编译、链接和 OpenGL 调用用日志表示，Uniform location 只模拟一个值。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/shaders/CCGLProgram.cpp src/cocos2dx/shaders/CCShaderCache.cpp -o /tmp/cocos2d-2x-s61
/tmp/cocos2d-2x-s61
~~~

日志按顺序显示程序初始化、属性绑定、链接、内建 Uniform 更新、ShaderCache 保存、用户 Uniform location 查询和 glUniform4f() 参数写入。
