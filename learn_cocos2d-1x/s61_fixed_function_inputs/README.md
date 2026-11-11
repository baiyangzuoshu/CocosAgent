# 第 61 课：1.x 固定管线绘制输入

**本课问题：** 1.x 如何把纹理与顶点数据交给固定管线？本版的 Shader 边界在哪里？

## 本版渲染路径

CCTexture2D::drawAtPoint() 在 CPU 上准备四个顶点和 UV，绑定纹理，调用 glVertexPointer()、glTexCoordPointer() 并提交 glDrawArrays()。这份 1.x 快照没有独立的 GLProgram、Shader 缓存或 Uniform 参数层。

## 源码位置

- [CCTexture2D.cpp](../../engine/cocos2d-x-1/cocos2dx/textures/CCTexture2D.cpp)：drawAtPoint() 准备顶点/UV 数组并直接调用 OpenGL。
- [CCTexture2D.h](../../engine/cocos2d-x-1/cocos2dx/include/CCTexture2D.h)：纹理绘制入口声明。
- [CCSprite.cpp](../../engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp)：Sprite 使用客户端顶点属性指针绘制的路径。

## 独立代码与简化

src/cocos2dx/textures/CCTexture2D.cpp 保留 CPU 数组、纹理绑定、顶点/UV 指针和四顶点条带的顺序。GLClientState 用日志代替图形上下文；示例不添加本版快照中不存在的 Shader 抽象。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/textures/CCTexture2D.cpp -o /tmp/cocos2d-1x-s61
/tmp/cocos2d-1x-s61
~~~

输出显示纹理绑定、顶点指针、UV 指针和四顶点绘制调用。
