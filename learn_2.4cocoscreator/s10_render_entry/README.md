# 第 10 课：Director 到渲染流程

**目标：** 看清每帧更新结束后，当前场景怎样进入 Web 渲染器。

## 本课增量

Director 完成组件阶段后调用 Renderer；Renderer 把场景交给 RenderFlow。本课让页面显示进入流程的场景名，不遍历子节点、不生成绘制数据；节点遍历留到第 11 课。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/CCDirector.js:900-906`：Web 主循环更新后调用 `renderer.render(this._scene, deltaTime)`。
- `engine/2.4.15engine/cocos2d/core/renderer/index.js:175-180`：Renderer 将活动场景交给 `_flow.render`。
- `engine/2.4.15engine/cocos2d/core/renderer/render-flow.js:235-245`：RenderFlow 开始批处理、访问根节点并交给 ForwardRenderer。

## 简化

保留 `Director → Renderer → RenderFlow` 调用顺序。省略 Canvas/WebGL 设备、模型收集、剔除、批处理和 GPU 提交；本课只观察场景到达 RenderFlow。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，页面的渲染入口行会显示 `MainScene` 已到达 RenderFlow。
