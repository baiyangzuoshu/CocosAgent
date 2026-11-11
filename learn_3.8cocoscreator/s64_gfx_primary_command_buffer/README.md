# 第 64 课：Creator 3.8 Root 到 WebGL2 PrimaryCommandBuffer

**本课问题：** 3.8 默认管线怎样从相机绘制走到浏览器 WebGL2？

## 本版渲染路径

Root 收集并排序 Camera，调用默认 RenderPipeline.render，最后 present。RenderPipeline 通过 ForwardStage 走 GFX CommandBuffer 接口。WebGL2 使用 PrimaryCommandBuffer：它的 draw 在当前 render pass 中应用状态并立即调用 WebGL2 draw 函数；随后 WebGL2Queue.submit 汇总绘制统计。这个 WebGL2 路径不是延迟保存一串 GL 命令再统一执行。自定义 WebPipeline/Executor 是 Root 可选的另一条管线，本课聚焦默认管线。

## 源码位置

- [root.ts](../../engine/3.8.7engine/cocos/root.ts)：_frameMoveEnd 调用管线并在结束后 present；setRenderPipeline 默认选择 legacy pipeline。
- [render-pipeline.ts](../../engine/3.8.7engine/cocos/rendering/render-pipeline.ts)：按相机执行各 Flow，结束后调用 GFX Queue.submit。
- [forward-stage.ts](../../engine/3.8.7engine/cocos/rendering/forward/forward-stage.ts)：准备 Pass、InputAssembler 和 CommandBuffer.draw。
- [webgl2-primary-command-buffer.ts](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-primary-command-buffer.ts)：draw 在 render pass 内即时调用 WebGL2 draw 函数。
- [webgl2-commands.ts](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts)：WebGL2CmdFuncDraw 选择 drawElements/drawArrays。
- [webgl2-queue.ts](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-queue.ts)：submit 汇总 CommandBuffer 的 draw 统计。

## 独立代码与简化

src/cocos/ 分别保留 Root、RenderPipeline、ForwardStage、WebGL2 PrimaryCommandBuffer 和 Queue。示例用一个相机和索引网格输出调用顺序；Device 以日志代替浏览器 WebGL2 上下文，不创建真实 GPU 资源。

## 运行

~~~
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/。输出中 gl.drawElements 出现在 queue.submit 之前，体现 WebGL2 PrimaryCommandBuffer.draw 的即时执行。
