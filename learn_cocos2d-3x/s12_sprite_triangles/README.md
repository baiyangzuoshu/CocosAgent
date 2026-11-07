# 第 12 课：Sprite 几何数据进入三角形命令

**目标：** 看清 Sprite 如何把四边形拆成两个三角形，并交给 Renderer 排队。

## 本课增量

Sprite::draw 将几何数据作为三角形命令加入 Renderer。Renderer 按第 11 课的全局 Z 顺序提交命令，并统计其 4 个顶点、6 个索引。

## 源码位置

- `engine/cocos2d-x-3/cocos/2d/CCSprite.cpp:1048-1082`：用 Sprite 几何数据初始化 TrianglesCommand 并加入 Renderer。
- `engine/cocos2d-x-3/cocos/renderer/CCTrianglesCommand.cpp:46-60`：命令保存三角形数据并检查索引数。
- `engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp:383-405`：把 TrianglesCommand 放入三角形队列。
- `engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp:709-729`：复制顶点并偏移索引，准备批量绘制。

## 简化

样例用计数表示顶点/索引，不执行 OpenGL；省略材质、纹理、世界矩阵和 VBO 真实合批。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s12
/tmp/cocos2d-3x-s12
~~~

Renderer 输出 Player 的 triangles=2，并汇总为 4 个顶点、6 个索引。
