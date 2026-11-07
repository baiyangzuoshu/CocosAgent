# 第 12 课：Sprite 几何数据进入三角形命令

**目标：** 看清 Sprite 如何把四边形拆成两个三角形，再交给 Renderer 提交。

## 本课增量

Sprite::draw 把四顶点、六索引的数据装入 TrianglesCommand。Renderer 依命令队列顺序提交，并把三角形数据合并到批量绘制统计中。

## 源码位置

- `engine/cocos2d-x-4/cocos/2d/CCSprite.cpp:1098-1127`：初始化 TrianglesCommand 并加入 Renderer。
- `engine/cocos2d-x-4/cocos/renderer/CCTrianglesCommand.cpp:38-58`：命令保存三角形数据并准备材质批次信息。
- `engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp:246-280`：接收三角形命令并排入队列。
- `engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp:528-550`：复制顶点、转换坐标并偏移索引。

## 简化

样例用计数表示顶点/索引，不执行 OpenGL；省略材质、纹理、变换矩阵和 GPU 缓冲区。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-x-s12
/tmp/cocos2d-x-s12
~~~

Renderer 输出 Player 的 triangles=2，并汇总为 4 个顶点、6 个索引。
