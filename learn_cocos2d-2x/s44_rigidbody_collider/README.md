# 第 44 课：应用层把 Box2D body 映射到节点

**本课问题：** Cocos2d-x 2.x 中，刚体和 fixture 如何与可见节点对应？

## 观察结果

应用为节点构造 `b2BodyDef`，按静态/动态类型创建 body，再用 `b2PolygonShape` 和 `b2FixtureDef` 描述盒形、密度、摩擦与弹性。应用自己保存 Node 到 `b2Body` 的关系，并负责像素/米单位换算；引擎没有内建 `PhysicsBody` 组件替你接线。

## 源码位置

- Box2D 定义 [静态、运动学和动态类型](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2Body.h#L35)、[b2BodyDef 默认静态](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2Body.h#L51)；[World::CreateBody](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2World.h#L72)。
- [b2FixtureDef 的密度、摩擦与弹性](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2Fixture.h#L56)；[Body::CreateFixture](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2Body.h#L136)。
- [PolygonShape::SetAsBox 使用半宽和半高](../../engine/cocos2d-x-2/external/Box2D/Collision/Shapes/b2PolygonShape.h#L44)。这些 Box2D 文件位于仓库附带的独立库；Cocos2d-x 2.x 核心没有 Creator 式刚体组件。

独立代码：[main.cpp](src/main.cpp)。代码使用 Box2D 名称的局部替身，以展示应用层构造和持有关系。

## 简化范围

替身只打印 body/fixture 参数，不链接 Box2D，不运行碰撞；Node 到 body 的指针映射是应用层代码，不是引擎提供的 API。

## 运行

~~~sh
c++ -std=c++11 src/main.cpp -o /tmp/cocos2d-2x-s44
/tmp/cocos2d-2x-s44
~~~
