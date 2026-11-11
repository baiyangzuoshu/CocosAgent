# 第 60 课：2.x Sprite 绘制状态准备

**本课问题：** 2.x 的 CCSprite 如何先准备 GLProgram，再设置混合、纹理和顶点属性？

## 本版渲染路径

2.x 仍由 `CCSprite::draw()` 直接提交绘制，但增加了 `CC_NODE_DRAW_SETUP()`：宏先使用 GLProgram 并更新内建 Uniform；随后 Sprite 设置混合函数、绑定纹理、启用顶点属性并调用 `glDrawArrays`。本版尚无 3.x 的统一 Renderer 命令队列。

## 源码位置

- [CCSprite.cpp](../../engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp)：`CCSprite::draw()` 的程序准备和 OpenGL 调用顺序。
- [ccMacros.h](../../engine/cocos2d-x-2/cocos2dx/include/ccMacros.h)：`CC_NODE_DRAW_SETUP()` 宏定义。
- [CCSprite.h](../../engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.h)：Sprite 保存的 GLProgram、纹理与 BlendFunc。

## 独立代码与简化

`src/cocos2dx/sprite_nodes/CCSprite` 保留 2.x 的宏入口和直接绘制次序。GLProgram 与 GLState 仅记录调用，不编译 Shader 或触发真实 OpenGL；本例不增加 3.x/4.0 的 Material/Pass 层。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp -o /tmp/cocos2d-2x-s60
/tmp/cocos2d-2x-s60
~~~

观察 `CC_NODE_DRAW_SETUP` 的程序准备日志先于混合、贴图和顶点属性设置。
