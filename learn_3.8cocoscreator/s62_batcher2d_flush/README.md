# 第 62 课：Creator 3.8 Batcher2D 与 DrawBatch

**本课问题：** 3.8 的 UI RenderData 怎样累积到一个 DrawBatch，哪些状态变化会结束当前合批段？

## 本版渲染路径

Batcher2D.commitComp() 收到组件 RenderData 后，比较 dataHash、Material 引用和 stencil stage；变化或 dataHash 为 0 时调用 autoMergeBatches()。合并会为当前索引范围创建 DrawBatch2D，保存 InputAssembler、材质 Pass、纹理和 sampler 等绘制数据。finishMergeBatches() 结束当前段。

## 源码位置

- [batcher-2d.ts](../../engine/3.8.7engine/cocos/2d/renderer/batcher-2d.ts)：commitComp()、autoMergeBatches() 和 finishMergeBatches() 负责累积与拆批。
- [draw-batch.ts](../../engine/3.8.7engine/cocos/2d/renderer/draw-batch.ts)：DrawBatch2D 保存 InputAssembler、Pass、纹理、sampler 和可见层。
- [i-batcher.ts](../../engine/3.8.7engine/cocos/2d/renderer/i-batcher.ts)：定义 commitComp()、commitIA()、commitModel() 等提交入口。
- [render-data.ts](../../engine/3.8.7engine/cocos/2d/renderer/render-data.ts)：RenderData 持有 dataHash 和 MeshBuffer 数据。

## 独立代码与简化

src/cocos/2d/renderer/ 只保留 RenderData、Batcher2D 和 DrawBatch2D 的数据流。示例用日志表示索引范围和状态边界，不创建 GFX InputAssembler、DescriptorSet 或实际绘制命令。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/。前两个兼容组件进入同一个 DrawBatch；模板阶段或材质变化时，前一段先生成 DrawBatch。
