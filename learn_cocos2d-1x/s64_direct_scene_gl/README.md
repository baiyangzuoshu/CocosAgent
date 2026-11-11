# 第 64 课：Cocos2d-x 1.x 场景遍历直接绘制

**本课问题：** 1.x 的场景节点怎样把 Sprite 送到 OpenGL？

## 本版渲染路径

CCDirector::drawScene 直接调用运行场景 visit。CCNode::visit 按节点树调用 draw，再访问子节点；CCSprite::draw 绑定纹理、设置固定管线顶点/颜色/UV 指针并立即 glDrawArrays。这里没有 Renderer 队列或 Device 抽象。

## 源码位置

- [CCDirector.cpp](../../engine/cocos2d-x-1/cocos2dx/CCDirector.cpp)：drawScene 清屏后访问运行场景。
- [CCNode.cpp](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp)：visit 变换节点并按顺序绘制自己和子节点。
- [CCSprite.cpp](../../engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp)：draw 设置固定管线输入并提交 quad。
- [CCTextureAtlas.cpp](../../engine/cocos2d-x-1/cocos2dx/textures/CCTextureAtlas.cpp)：批处理分支由 drawQuads 直接 glDrawElements。

## 独立代码与简化

src/cocos2dx/ 保留 Director、Node 和 Sprite 的调用层次。OpenGL 函数用日志替代；本课只走独立 Sprite 路径，SpriteBatchNode/TextureAtlas 的批处理已在第 62 课说明。

## 编译运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCDirector.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp -o /tmp/cocos2d-1x-s64
/tmp/cocos2d-1x-s64
~~~

输出从 CCDirector 进入 Node.visit，最后在 CCSprite.draw 中直接调用 glDrawArrays。
