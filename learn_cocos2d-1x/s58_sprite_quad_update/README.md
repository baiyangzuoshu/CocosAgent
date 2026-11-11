# 第 58 课：1.x Sprite quad 属性更新

**本课问题：** 1.x 的 Sprite 如何把纹理区域、局部顶点和颜色写进 quad，再直接交给 OpenGL？

## 本版路径

CCSprite::setTextureRect 更新 m_sQuad 的局部顶点与 UV；updateColor 将显示颜色和透明度写入四个角。独立绘制时 draw 直接为位置、颜色、UV 设置数组指针，再用 Triangle Strip 绘制。本版不经过后续版本的 Renderer 命令队列。

## 源码位置

- engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp:371-417：纹理区域生成本地顶点与纹理坐标。
- engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp:950-975：颜色和透明度更新 quad 四角。
- engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp:654-693：直接提交顶点、颜色和 UV 数组。
- 前置课：第 57 课：子节点 Z 顺序与访问顺序（../s57_node_draw_order/README.md）。

## 独立代码与简化

示例保留 m_sQuad 的 V3F_C4B_T2F 结构和 direct draw 顺序，以日志替代 OpenGL 调用。只覆盖非 BatchNode 的 Sprite；没有 Renderer、三角形命令或 GPU 缓冲区。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp -o /tmp/cocos2d-1x-s58
/tmp/cocos2d-1x-s58
~~~

输出显示四个顶点共用更新后的颜色和透明度，然后由 Triangle Strip 提交。
