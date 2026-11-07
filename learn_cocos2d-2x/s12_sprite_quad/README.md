# 第 12 课：CCSprite 四顶点直接绘制

**目标：** 看清 2.x 的 CCSprite 如何设置顶点属性并绘制一个 Quad。

## 本课增量

CCSprite 保存四个位置/UV 顶点。draw 设置 position、texCoord、color 顶点属性，再以 triangle strip 画出四角。样例打印关键调用；场景访问顺序沿用上一课。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp:548-582`：绑定纹理、设置 vertex attributes，并调用 glDrawArrays。
- `engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSpriteBatchNode.cpp:388-404`：批处理路径先更新 Sprite 变换，再绘制 TextureAtlas。

## 简化

样例只打印 OpenGL 提交轨迹，不创建真实 GL context；省略纹理、材质状态、变换矩阵和 Atlas 合批实现。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-2x-s12
/tmp/cocos2d-2x-s12
~~~

Player 的输出显示 4 个顶点经顶点属性提交，再由 triangle strip 绘制。
