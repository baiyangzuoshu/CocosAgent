# 第 45 课：Box2D 碰撞过滤与接触监听

**本课问题：** Cocos2d-x 1.x 应用怎样配置碰撞分组、接收接触事件并控制本步响应？

## 观察结果

1.x 没有 Creator 式物理组件；应用直接设置 `b2Fixture` 的 `categoryBits`、`maskBits`、`groupIndex`，并通过 `b2World::SetContactListener` 安装监听器。相同非零组号优先于位掩码：正组强制允许，负组强制过滤。`PreSolve` 中 `SetEnabled(false)` 只影响当前时间步。

## 源码位置

- [b2Filter 字段与默认值](../../engine/cocos2d-x-1/Box2D/Dynamics/b2Fixture.h#L31)；[groupIndex 优先级及双向 mask 判断](../../engine/cocos2d-x-1/Box2D/Dynamics/b2WorldCallbacks.cpp#L24)。
- [b2ContactListener 的 Begin/End/Pre/Post 阶段](../../engine/cocos2d-x-1/Box2D/Dynamics/b2WorldCallbacks.h#L81)；[World 安装 ContactListener](../../engine/cocos2d-x-1/Box2D/Dynamics/b2World.h#L62)；[PreSolve 中临时禁用 contact](../../engine/cocos2d-x-1/Box2D/Dynamics/Contacts/b2Contact.h#L92)。

独立代码：[应用入口与 Box2D 接触过滤/监听流程](src/main.cpp)。

## 简化范围

样例以同名局部类型裁出 Box2D 的过滤和监听流程，不链接 Box2D 或运行几何碰撞。真实应用需使用本地 Box2D 类型，并保证 listener 在 World 使用期间存活；回调中不能创建或销毁 Box2D 实体。

## 运行

~~~sh
c++ -std=c++11 src/main.cpp -o /tmp/cocos2d-1x-s45
/tmp/cocos2d-1x-s45
~~~
