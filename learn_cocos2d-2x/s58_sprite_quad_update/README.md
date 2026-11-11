# 第 58 课：2.x Sprite quad 更新到 TextureAtlas

**本课问题：** 2.x 的 Sprite 批处理路径如何把 quad 的颜色变化同步到 TextureAtlas？

## 本版路径

Sprite 保存 V3F_C4B_T2F quad。颜色或透明度变化时，updateColor 更新四角；已分配 atlas index 的 Sprite 随即调用 TextureAtlas::updateQuad，将 quad 拷贝到 CPU 数组并标记 dirty。之后的 VBO 更新留给第 59 课。

## 源码位置

- engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp:315-359：纹理区域与自绘 quad 顶点。
- engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp:888-918：updateColor 更新 quad，并通知 TextureAtlas。
- engine/cocos2d-x-2/cocos2dx/textures/CCTextureAtlas.cpp:311-321：复制 quad 并设置 dirty。
- engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp:548-582：非批处理路径使用顶点属性指针绘制四顶点。
- 前置课：第 57 课：延迟排序与绘制顺序（../s57_node_draw_order/README.md）。

## 独立代码与简化

示例只保留 SpriteBatchNode 使用的 quad → TextureAtlas CPU 副本与 dirty 标记。它不执行 GL/VBO 上传；该阶段会在后续缓冲课程单独展开。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/textures/CCTextureAtlas.cpp -o /tmp/cocos2d-2x-s58
/tmp/cocos2d-2x-s58
~~~

输出显示 atlas 中的 quad 已变为半透明橙色，并等待后续缓冲刷新。
