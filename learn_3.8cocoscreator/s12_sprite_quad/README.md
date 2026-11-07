# 第 12 课：Sprite 四边形几何与 Batcher2D

**目标：** 看清 RenderFlow 如何把 Sprite 顶点交给 Batcher2D，再提交一次 WebGL 绘制。

## 本课增量

Sprite 组装器创建四个顶点和六个索引。RenderFlow 遍历活动场景时更新 Sprite 顶点并交给 Batcher2D；本课的最小 WebGL 后端绘制一个彩色四边形。父节点移动后，节点变换更新，几何位置也随之变化。

## 源码位置

- `engine/3.8.7engine/cocos/2d/assembler/sprite/simple.ts:37-65`：创建 Sprite RenderData 并更新数据。
- `engine/3.8.7engine/cocos/2d/assembler/sprite/simple.ts:98-129`：fillBuffers 将顶点和索引写入批次。
- `engine/3.8.7engine/cocos/2d/renderer/batcher-2d.ts:420-485`：接收渲染组件数据并准备绘制批次。

## 简化

只画一个纯色四边形；省略 SpriteFrame、贴图、材质合批、相机裁剪和动态顶点缓冲复用。本课保留 RenderFlow → assembler → Batcher2D 的职责顺序。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，观察画布中的四边形、父节点移动效果和状态栏的顶点/索引/draw call 数。
