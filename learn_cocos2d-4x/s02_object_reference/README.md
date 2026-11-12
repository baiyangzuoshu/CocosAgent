# 第 2 课：对象引用与回收

**目标：** 观察 `retain()`、`autorelease()` 与池清理怎样共同决定对象何时销毁。

## 源码位置

- `engine/cocos2d-x-4/cocos/base/CCRef.cpp:91`：`Ref::retain()` 增加引用数。
- `engine/cocos2d-x-4/cocos/base/CCRef.cpp:97`：`Ref::release()` 在引用数归零时销毁对象。
- `engine/cocos2d-x-4/cocos/base/CCRef.cpp:154`：`Ref::autorelease()` 将对象加入当前 pool。
- `engine/cocos2d-x-4/cocos/base/CCAutoreleasePool.cpp:59`、`:64`：pool 登记对象并在 `clear()` 时逐个调用 `release()`。
- 完整生命周期背景见[4.0 Scene、Node 与对象生命周期源码追踪](../../docs/cocos2d-x/02-objects-and-lifecycle.md)。

## 本课代码

对象创建时引用数为 1。示例先 `retain()` 变为 2，再用 `autorelease()` 登记到池中；`pool.clear()` 释放一份引用后变为 1，最后一次 `release()` 使引用数归零并析构对象。

## 观察结果

终端依次显示引用数 `2`、`1`，然后打印 `destroy Probe`。

## 简化

显式 `AutoreleasePool` 和线程局部当前池取代完整引擎中的 `PoolManager` 池栈；保留 `Ref` 的引用计数与池清理关系。不依赖完整 Cocos2d-x 工程。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCRef.cpp src/cocos/base/CCAutoreleasePool.cpp -o /tmp/cocos2d-x-4-s02
/tmp/cocos2d-x-4-s02
~~~
