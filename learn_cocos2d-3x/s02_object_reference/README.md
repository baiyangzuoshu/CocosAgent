# 第 2 课：对象引用与回收

**目标：** 观察 retain、autorelease 与池清理怎样共同决定对象何时销毁。

## 源码位置

- `engine/cocos2d-x-3/cocos/base/CCRef.cpp:91`：Ref::retain()：增加引用数。
- `engine/cocos2d-x-3/cocos/base/CCRef.cpp:97`：Ref::release()：引用减到零时销毁对象。
- `engine/cocos2d-x-3/cocos/base/CCRef.cpp:154`：Ref::autorelease()：登记到当前 pool。
- `engine/cocos2d-x-3/cocos/base/CCAutoreleasePool.cpp:59`：AutoreleasePool::addObject()：记录对象。
- `engine/cocos2d-x-3/cocos/base/CCAutoreleasePool.cpp:64`：AutoreleasePool::clear()：逐个 release。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-3/` 镜像。Ref::autorelease() 将对象登记到当前 AutoreleasePool；样例保留 pool.clear() 释放一份引用的结果，省去 PoolManager 的池栈管理。

## 观察结果

retain 后引用数为 2；pool.clear() 后为 1；最后一次 release 打印销毁消息。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCRef.cpp src/cocos/base/CCAutoreleasePool.cpp -o /tmp/cocos2d-3x-s02
/tmp/cocos2d-3x-s02
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
