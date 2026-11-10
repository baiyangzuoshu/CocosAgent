# 第 44 课：PhysicsBody 把形状和 Node 接入 PhysicsWorld

**本课问题：** Cocos2d-x 4.x 怎样把刚体、盒形和材质接到节点？

## 观察结果

`PhysicsBody::createBox` 创建 body 并把 `PhysicsShapeBox` 加入 body；`Node::setPhysicsBody` 通过组件机制附加 body，`PhysicsBody::onAdd` 再把 body 和 shapes 注册到 Scene 的 PhysicsWorld。材质参数顺序是 density、restitution、friction。默认 body 是 dynamic；`setDynamic(false)` 在本地 Chipmunk 后端映射为 kinematic。

## 源码位置

- [PhysicsMaterial 字段与参数顺序](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsShape.h#L41)；[createBox 创建并添加 PhysicsShapeBox](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsBody.cpp#L192)；[Body::addShape 维护形状和质量](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsBody.cpp#L404)。
- [Node::setPhysicsBody 委托 addComponent](../../engine/cocos2d-x-4/cocos/2d/CCNode.h#L1936)；[PhysicsBody::onAdd 记录 owner 并进入世界](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsBody.cpp#L939)；[PhysicsWorld 添加 body 和 shapes](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsWorld.cpp#L534)。
- [setDynamic 的公开接口](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsBody.h#L380)；[false 映射为 Chipmunk kinematic](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsBody.cpp#L310)。后端实现见 [CCPhysicsBody.cpp](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsBody.cpp#L25)。
- [PhysicsWorld 遍历 Node 树，并在模拟前后同步 PhysicsBody 与 Node 变换](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsWorld.cpp#L1014)；[PhysicsBody.afterSimulation 写回 Node 位置和旋转](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsBody.cpp#L914)。

独立代码按源码职责拆分：[Scene](src/cocos/2d/CCScene.cpp)、[Node::setPhysicsBody](src/cocos/2d/CCNode.h)、[PhysicsBody](src/cocos/physics/CCPhysicsBody.cpp)、[PhysicsWorld](src/cocos/physics/CCPhysicsWorld.cpp)、[形状与材质](src/cocos/physics/CCPhysicsShape.h) 和 [入口](src/main.cpp)。

## 简化范围

替身只打印组件附加和 world 收录，不链接 Chipmunk，也不运行碰撞。Cocos2d-x 4.x 的 `setDynamic(false)` 是非动态/运动学映射，不应直接当作 Box2D 的静态 body。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCNode.cpp src/cocos/2d/CCScene.cpp src/cocos/physics/CCPhysicsBody.cpp src/cocos/physics/CCPhysicsWorld.cpp -o /tmp/cocos2d-4x-s44
/tmp/cocos2d-4x-s44
~~~
