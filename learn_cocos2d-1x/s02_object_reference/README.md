# 第 2 课：对象引用与回收

**目标：** 观察 retain、autorelease 与池清理怎样共同决定对象何时销毁。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp:74`：CCObject::release()：引用减到零时销毁对象。
- `engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp:85`：CCObject::retain()：增加引用数。
- `engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp:92`：CCObject::autorelease()：登记到 PoolManager。
- `engine/cocos2d-x-1/cocos2dx/cocoa/CCAutoreleasePool.cpp:42`：CCAutoreleasePool::addObject()：池数组登记并调整引用。
- `engine/cocos2d-x-1/cocos2dx/cocoa/CCAutoreleasePool.cpp:56`：CCAutoreleasePool::clear()：清理池数组。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-1/` 镜像。本快照中 autorelease 由 PoolManager 转发，池数组和计数参与回收；样例折叠这些细节，保留清池释放一份引用的结果。

## 观察结果

retain 后引用数为 2；pool.clear() 后为 1；最后一次 release 打印销毁消息。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/cocoa/CCAutoreleasePool.cpp -o /tmp/cocos2d-1x-s02
/tmp/cocos2d-1x-s02
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
