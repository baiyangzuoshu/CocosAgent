# 第 45 课：碰撞掩码、接触通知与响应

**本课问题：** Cocos2d-x 3.x 如何把接触通知与物理碰撞响应分别过滤？

## 观察结果

3.x 的 `categoryBitmask` 标记形状类别。`contactTestBitmask` 决定是否通知监听器，`collisionBitmask` 决定是否计算碰撞响应，两者互不替代。相同非零正组优先允许响应，负组在 Chipmunk 过滤阶段阻止接触；`onContactPreSolve` 返回 `false` 可跳过当前步响应。

## 源码位置

- [三种位掩码和 group 的公开接口](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsShape.h#L278)；[group 写入 Chipmunk shape filter](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsShape.cpp#L951)。
- [PhysicsWorld 分别判断通知掩码和碰撞掩码，并处理 group 优先级](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsWorld.cpp#L300)；[PreSolve 回调返回值交给 Chipmunk](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsWorld.cpp#L360)。
- [事件监听器的 Begin/Pre/Post/Separate 回调](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsContact.h#L224)；[监听器返回值写回 PhysicsContact](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsContact.cpp#L196)。

独立代码按职责拆分：[PhysicsShape 掩码](src/cocos/physics/CCPhysicsShape.h)、[PhysicsContact 事件监听器](src/cocos/physics/CCPhysicsContact.h)、[PhysicsWorld 回调流程](src/cocos/physics/CCPhysicsWorld.cpp) 和 [入口](src/main.cpp)。

## 简化范围

样例保留 Chipmunk 前的掩码判断和事件返回值，不链接 Chipmunk，也不创建场景图、EventDispatcher 或真实碰撞形状。接触通知要求双方 contact-test 掩码互相匹配；未通知的接触仍可能有物理响应。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/physics/CCPhysicsWorld.cpp -o /tmp/cocos2d-3x-s45
/tmp/cocos2d-3x-s45
~~~
