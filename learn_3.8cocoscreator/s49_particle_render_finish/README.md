# 第 49 课：粒子绘制与结束

**本课问题：** 3.8 如何把活动粒子写入 RenderData 并提交给批处理器？

## 观察结果

Simulator 把粒子写入 MeshRenderData，准备顶点属性、材质和 SpriteFrame。组件通过 `IBatcher.commitComp` 提交；停止后 `_canRender` 阻止继续绘制，但模拟仍会排空剩余粒子。结束回调再按配置移除节点并释放 RenderData。

## 源码位置

- [Simulator 写 RenderData 并准备属性](../../engine/3.8.7engine/cocos/particle-2d/particle-simulator-2d.ts#L472)；[检测模拟结束](../../engine/3.8.7engine/cocos/particle-2d/particle-simulator-2d.ts#L476)；[组件停止发射](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L892)；[停止时阻止绘制](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L1227)。
- [销毁 RenderData](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L839)；[结束处理与自动移除](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L1222)；[IBatcher 提交](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L1231)。

独立代码：[ParticleSystem2D](src/cocos/particle-2d/particle-system-2d.ts)、[RenderData 与 Batcher](src/cocos/particle-2d/particle-renderer.ts)、[Simulator](src/cocos/particle-2d/particle-simulator-2d.ts) 和 [浏览器入口](src/main.ts)。

## 简化范围

保留 RenderData、组件提交与停止/结束职责；使用本地 Batcher 计数器代替引擎渲染队列和 GPU。示例在第三帧停止，继续模拟已有粒子，直到销毁 RenderData。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，观察停止后提交次数保持不变，而活动粒子继续减少。
