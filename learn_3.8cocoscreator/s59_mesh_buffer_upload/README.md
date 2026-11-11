# 第 59 课：Creator 3.8 MeshBuffer 更新 GFX Buffer

**本课问题：** Batcher2D 的顶点和索引如何经 BufferAccessor 进入图形后端缓冲？

## 本版渲染路径

Creator 3.8 使用自己的 LinearBufferAccessor/MeshBuffer 结构。Accessor 把几何写入 CPU staging 数组、记录批次并驱动 MeshBuffer.uploadBuffers；MeshBuffer 将活动区域转成 Float32Array、Uint16Array，检查容量后调用 GFX Buffer.resize 和 update。WebGL 后端再把更新交给 WebGL 命令函数；GFX InputAssembler 引用 VB、IB。本课沿这条链，不复用 Creator 2.4 的 RenderFlow 或 InputAssembler 类。

## 源码位置

- [buffer-accessor.ts](../../engine/3.8.7engine/cocos/2d/renderer/buffer-accessor.ts)：2D 缓冲访问器基类与上传接口。
- [linear-buffer-accessor.ts](../../engine/3.8.7engine/cocos/2d/renderer/linear-buffer-accessor.ts)：追加顶点/索引、记录 IA 并刷新所有 MeshBuffer。
- [mesh-buffer.ts](../../engine/3.8.7engine/cocos/2d/renderer/mesh-buffer.ts)：uploadBuffers、容量检查、IA 池及 VB/IB 更新。
- [batcher-2d.ts](../../engine/3.8.7engine/cocos/2d/renderer/batcher-2d.ts)：刷新批次缓冲的入口。
- [buffer.ts](../../engine/3.8.7engine/cocos/gfx/base/buffer.ts)：GFX Buffer 的 resize/update 抽象。
- [webgl-buffer.ts](../../engine/3.8.7engine/cocos/gfx/webgl/webgl-buffer.ts) 与 [webgl-commands.ts](../../engine/3.8.7engine/cocos/gfx/webgl/webgl-commands.ts)：WebGL 后端执行缓冲更新。

## 独立代码与简化

src/cocos/ 展示 BufferAccessor → MeshBuffer → GFX Buffer → WebGL Buffer，浏览器真实分配并更新缓冲区。保留容量扩展与 InputAssembler 引用关系；不创建材质、RenderPass，也不执行绘制。课程代码只模拟 3.8 的职责结构，不是引擎类的逐行移植。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/。可看到 GFX Buffer 扩容时的 bufferData，以及更新顶点和索引时的 bufferSubData。
