# 第 12 课：Sprite 四边形几何与浏览器绘制

**目标：** 看清一个节点如何从四个顶点进入一次 WebGL 绘制。

## 本课增量

RenderFlow 遍历到带 Sprite 数据的节点后，组装器生成四个位置顶点和六个索引；ModelBatcher 将它们提交给 WebGL，页面画出一个彩色四边形。父节点移动时，四边形跟着移动。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/renderer/webgl/assemblers/sprite/2d/simple.js:28-85`：更新 Sprite UV 和四角顶点。
- `engine/2.4.15engine/cocos2d/core/renderer/webgl/model-batcher.js:135-164,187-200`：组装 InputAssembler / Model，并上传缓冲数据。
- `engine/2.4.15engine/cocos2d/core/renderer/webgl/quad-buffer.js:49-58`：更新四边形顶点缓冲。

## 本课必须保留的机制

保留 Sprite assembler 生成四个顶点/六个索引、ModelBatcher 准备绘制缓冲，以及 WebGL `drawElements` 实际提交一个 quad。

## 最小观察宿主

浏览器 canvas、一个纯色 quad、最小 WebGL 设备封装和状态栏；页面显示顶点数、索引数与 draw call。

## 模型化简化与 Creator Runtime 边界

本课会调用浏览器 WebGL 绘制，但只画一个纯色四边形；省略 SpriteFrame 贴图、材质切换、动态合批和 GPU 资源复用。它是精简 WebGL 路径，不是完整 Creator Renderer/场景渲染 Runtime。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，观察画布中的四边形以及状态栏中的“4 个顶点、6 个索引、1 次 draw call”。本课入口只演示 Quad 生成与 WebGL 提交，不再复演组件调度、脏变换或资源缓存。
