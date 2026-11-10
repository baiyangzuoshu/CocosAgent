#pragma once

namespace cocos2d {

class PhysicsBody;
class PhysicsShapeBox;

class PhysicsWorld {
public:
    void addBody(PhysicsBody* body);
    void addShape(PhysicsShapeBox* shape);
};

} // namespace cocos2d
