# 第 60 课：1.x Sprite 混合与贴图状态

**本课问题：** 1.x 的 CCSprite 如何在直接 OpenGL 绘制前设置混合与纹理？

## 本版渲染路径

1.x 没有通用 Material、Technique、Pass 层。`CCSprite::draw()` 比较 Sprite 混合函数与默认值，需要时切换混合状态；随后绑定纹理、设置 quad 属性指针并绘制，最后恢复默认混合状态。

## 源码位置

- [CCSprite.cpp](../../engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp)：`CCSprite::draw()` 中混合状态、纹理绑定、顶点属性和 `glDrawArrays` 顺序。
- [CCSprite.h](../../engine/cocos2d-x-1/cocos2dx/include/CCSprite.h)：Sprite 保存的纹理和 BlendFunc。

## 独立代码与简化

`src/cocos2dx/sprite_nodes/CCSprite` 只保留直接绘制状态和四顶点绘制顺序。`GLState` 用日志代替真实 OpenGL；示例不创建纹理或图形上下文，也不添加后续版本的材质层。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp -o /tmp/cocos2d-1x-s60
/tmp/cocos2d-1x-s60
~~~

输出显示混合状态切换、纹理绑定、顶点属性设置、四顶点绘制和状态恢复。
