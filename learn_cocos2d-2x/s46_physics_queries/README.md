# 第 46 课：Box2D 世界查询与调试绘制

**本课问题：** Cocos2d-x 2.x 应用怎样直接查询 Box2D 世界并绘制调试形状？

## 观察结果

应用实现 `b2QueryCallback` 和 `b2RayCastCallback`，再把回调交给 `b2World::QueryAABB` 与 `RayCast`。RayCast 回调返回命中比例会裁短射线，只保留更近的命中。调试绘制由应用创建 `b2Draw` 实现、设置 flags，并让 World 调用 `DrawDebugData`。

## 源码位置

- [World 的 AABB 查询与射线入口](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2World.h#L110)；[查询回调和射线回调合同](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2WorldCallbacks.h#L123)。
- [RayCast 回调返回值控制过滤、停止或裁短](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2WorldCallbacks.h#L135)；[安装调试绘制器并调用 DrawDebugData](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2World.h#L64)。
- [b2Draw flags 与绘图接口](../../engine/cocos2d-x-2/external/Box2D/Common/b2Draw.h#L39)。

独立代码：[应用入口、查询回调、World 和调试绘制替身](src/main.cpp)。

## 简化范围

样例以预设命中比例和矩形替代 Box2D broadphase 与几何测试；调试绘制输出文本。实际项目使用仓库的 Box2D 类型，`b2Draw` 对象须在 World 使用期间保持存活。

## 运行

~~~sh
c++ -std=c++11 src/main.cpp -o /tmp/cocos2d-2x-s46
/tmp/cocos2d-2x-s46
~~~
