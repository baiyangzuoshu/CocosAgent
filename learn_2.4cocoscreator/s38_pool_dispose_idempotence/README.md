# 第 38 课：重复 dispose 保持同一终态

**目标：** 验证对象池重复关闭时，状态保持不变。

## 本课增量

第一次 `dispose()` 标记终态并清池；后续调用应直接返回，不再清理。演示连续调用两次，比较两次调用后的池大小和 `isDisposed()`。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- [CCNodePool.js:100-105](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L100)：引擎 `clear()` 会销毁池中节点，但没有 `dispose()`。
- 本课裁剪代码：[CCNodePool.ts:66-70](src/extensions/ccpool/CCNodePool.ts#L66)：终态检查、标记和首次清池的顺序。
- 演示调用：[main.ts](src/main.ts) 的 `pool-dispose-demo` 处理器。

## 简化与运行

重复关闭的结果不变；C++ 示例还观察池引用只释放一次。

~~~sh
deno task check
deno task build
deno task serve
~~~
