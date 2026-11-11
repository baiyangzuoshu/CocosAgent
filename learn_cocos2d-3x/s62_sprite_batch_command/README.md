# 第 62 课：3.x SpriteBatchNode 与 BatchCommand

**本课问题：** 3.x 怎样把一个 SpriteBatchNode 的 TextureAtlas 封装成 Renderer 命令？

## 本版渲染路径

SpriteBatchNode.draw() 更新后代变换，用全图集的纹理、混合状态和 GLProgram 初始化一个 BatchCommand，然后交给 Renderer。Renderer 执行该命令时应用程序、内建 Uniform、纹理与混合状态，再调用 TextureAtlas.drawQuads()。

## 源码位置

- [CCSpriteBatchNode.cpp](../../engine/cocos2d-x-3/cocos/2d/CCSpriteBatchNode.cpp)：draw() 将完整 TextureAtlas 包装为 BatchCommand 并加入 Renderer。
- [CCBatchCommand.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCBatchCommand.cpp)：init() 保存绘制状态，execute() 应用状态并绘制 TextureAtlas。
- [CCTextureAtlas.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCTextureAtlas.cpp)：drawQuads() 提交图集 quad。

## 独立代码与简化

src/cocos/ 分别保留 SpriteBatchNode、BatchCommand、Renderer 和 TextureAtlas。示例用一个 BatchCommand 代表一个完整图集；日志模拟 OpenGL 状态，不展开 Sprite 的 atlasIndex 更新或真实三角形缓冲。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSpriteBatchNode.cpp src/cocos/renderer/CCBatchCommand.cpp src/cocos/renderer/CCRenderer.cpp src/cocos/renderer/CCTextureAtlas.cpp -o /tmp/cocos2d-3x-s62
/tmp/cocos2d-3x-s62
~~~

Renderer 队列中只有一个 BatchCommand；执行时一次绘制图集中的全部 quad。
