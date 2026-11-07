# 第 12 课：CCSprite 四顶点直接绘制

**目标：** 看清 1.x 的 CCSprite 如何把一个 Quad 直接交给 OpenGL。

## 本课增量

CCSprite 持有四个带位置与 UV 的顶点。节点访问到 Sprite 时，draw 绑定顶点属性并调用 triangle strip 绘制四角。示例把这些 OpenGL 调用打印出来，便于观察调用顺序。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCSprite.cpp:654-693`：CCSprite::draw 设置顶点/颜色/UV 数组并调用 glDrawArrays。
- `engine/cocos2d-x-1/cocos2dx/include/CCSprite.h`：Sprite 保存的 Quad 数据成员。

## 简化

样例只打印 OpenGL 提交轨迹，不创建真实 GL context；省略纹理、颜色状态、变换矩阵与 SpriteBatchNode。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-1x-s12
/tmp/cocos2d-1x-s12
~~~

输出中 Player 使用四顶点 Quad 和 `glDrawArrays(GL_TRIANGLE_STRIP, 0, 4)`；其他节点仍由场景树访问。
