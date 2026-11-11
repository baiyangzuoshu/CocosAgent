# 第 62 课：2.x SpriteBatchNode 排序与图集重排

**本课问题：** 2.x 如何在子节点 zOrder 改变后同步重排 TextureAtlas 中的 quad？

## 本版渲染路径

addChild() 检查 Sprite 纹理与 batch node 纹理一致，把 Sprite 及其 quad 追加到 descendants 和 TextureAtlas。visit() 排序子节点；当顺序需要更新时，sortAllChildren() 重建 atlasIndex 并同步重排 quad，随后 draw() 一次提交图集。

## 源码位置

- [CCSpriteBatchNode.cpp](../../engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSpriteBatchNode.cpp)：addChild()/appendChild()、sortAllChildren()、updateAtlasIndex() 和 draw()。
- [CCTextureAtlas.cpp](../../engine/cocos2d-x-2/cocos2dx/textures/CCTextureAtlas.cpp)：重排 quad 数据及 drawQuads()。

## 独立代码与简化

src/cocos2dx/ 按 SpriteBatchNode 的子节点顺序和 TextureAtlas 的 quad 顺序分文件。示例只处理平面 Sprite 列表，用稳定排序和整表重排表示 atlasIndex 更新；VAO/VBO 上传已在前课说明。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSpriteBatchNode.cpp src/cocos2dx/textures/CCTextureAtlas.cpp -o /tmp/cocos2d-2x-s62
/tmp/cocos2d-2x-s62
~~~

Sprite 加入顺序与 zOrder 相反；visit() 重排 atlas quad，之后一次调用绘制两个 quad。
