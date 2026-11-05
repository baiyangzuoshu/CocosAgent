# 第 10 课：Director 到渲染入口

**目标：** 看清 Director 怎样把每帧工作交给 Root，再进入 RenderPipeline。

## 本课增量

Director 更新组件后调用 Root.frameMove。Root 在帧尾将相机列表交给 RenderPipeline，管线再调用 RenderFlow。本例用一个指向 MainScene 的相机，页面显示场景已进入渲染流程。

## 源码位置

- `engine/3.8.7engine/cocos/game/director.ts:797-801`：Director 每帧更新后调用 `Root.frameMove`。
- `engine/3.8.7engine/cocos/root.ts:764-801`：Root 收集相机，并在帧尾调用 RenderPipeline。
- `engine/3.8.7engine/cocos/rendering/render-pipeline.ts:476-502`：RenderPipeline 按相机执行 RenderFlow，随后提交命令缓冲。
- `engine/3.8.7engine/cocos/rendering/render-flow.ts:139-143`：RenderFlow 依次运行启用的 RenderStage。

## 简化

保留 `Director → Root → RenderPipeline → RenderFlow` 入口。用单个相机代表浏览器视图；省略真实窗口、图形设备、剔除、RenderStage 内容和 GPU 命令提交。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，页面的渲染入口行会显示 MainScene 已经进入 RenderFlow。
