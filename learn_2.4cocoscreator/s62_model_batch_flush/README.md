# 第 62 课：Creator 2.4 ModelBatcher 与 flush 边界

**本课问题：** 2.4 的 WebGL ModelBatcher 什么时候把一段 Sprite 顶点变成 Model 和 InputAssembler？

## 本版渲染路径

RenderFlow 遍历渲染组件时调用 RenderComponent._checkBacth()。材质哈希或 cullingMask 改变时，ModelBatcher 先 flush 当前索引范围；MeshBuffer 达到顶点上限或切换缓冲时也会上传、flush 并切换。渲染结束时 terminate() flush 最后一段并上传缓冲。

## 源码位置

- [render-flow.js](../../engine/2.4.15engine/cocos2d/core/renderer/render-flow.js)：render() 开始 ModelBatcher 遍历，遍历后调用 terminate()。
- [CCRenderComponent.js](../../engine/2.4.15engine/cocos2d/core/components/CCRenderComponent.js)：_checkBacth() 比较材质哈希和 cullingMask。
- [model-batcher.js](../../engine/2.4.15engine/cocos2d/core/renderer/webgl/model-batcher.js)：_flush() 用当前索引范围创建 InputAssembler 和 Model；terminate() flush 并上传。
- [mesh-buffer.js](../../engine/2.4.15engine/cocos2d/core/renderer/webgl/mesh-buffer.js)：checkAndSwitchBuffer() 在顶点数量超限时先上传、flush、换缓冲。

## 独立代码与简化

src/cocos2d/core/ 按 RenderFlow、RenderComponent、ModelBatcher 和 MeshBuffer 分层。每个 Sprite 简化为 4 顶点/6 索引；示例把引擎的 65535 顶点阈值降为 8，方便看到容量 flush，不创建真实 WebGL Buffer 或 draw。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/。日志会显示相同材质先共用索引范围，再分别因缓冲容量、材质哈希和裁剪掩码变化结束批次。
