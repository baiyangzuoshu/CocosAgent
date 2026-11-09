# 第 29 课：外部引用与对象池清理

**目标：** 看清池外变量引用节点时，`clear()` 是否仍会销毁它。

## 本课增量

点击“保留外部引用后清池”。Creator 的 `NodePool.clear()` 对池内节点调用 `destroy()`；即使脚本继续持有 `ExternalProbe` 变量，帧末后节点仍变为无效并触发 `onDestroy`。JS 引用保留的是对象句柄，不会撤销销毁请求。

Cocos2d-x 示例的应用层池持有一份 `retain`。池外调用方保留自己的引用时，`clear()` 只释放池的那一份；节点仍有效，可重新挂回场景，最终由调用方 `release()`。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)、[CCObject.ts](src/cocos2d/core/platform/CCObject.ts)。

## 源码位置

- [CCNodePool.js:100](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L100)：池清理时对每个节点调用 `destroy()`。
- [CCObject.js:278](../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js#L278)：`isValid` 只由销毁状态决定；[CCObject.js:305](../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js#L305)：`destroy()` 请求入队。
- Cocos2d-x 的池外引用走显式引用计数：1.x/2.x [CCObject.cpp](../../engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp#L74)、[2.x](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp#L79)；3.x/4.x [CCRef.cpp](../../engine/cocos2d-x-3/cocos/base/CCRef.cpp#L91)、[4.x](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp#L91)。

## 简化与运行

保留 `NodePool.clear()` 与延迟销毁队列；省略完整资源清理和编辑器撤销逻辑。

~~~sh
deno task check
deno task build
deno task serve
~~~

即时快照显示 `size=0`、`isValid=true`；下一帧显示无效和 `onDestroy=true`。
