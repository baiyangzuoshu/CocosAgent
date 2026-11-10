#pragma once

#include "cocos/physics/CCPhysicsShape.h"

#include <memory>
#include <vector>

namespace cocos2d {

class Node;
class PhysicsWorld;

class PhysicsBody {
public:
    static PhysicsBody* createBox(Size size, PhysicsMaterial material);
    void setDynamic(bool value);
    void onAdd(Node* owner, PhysicsWorld* world);
    const std::vector<std::unique_ptr<PhysicsShapeBox>>& getShapes() const { return _shapes; }

private:
    PhysicsBody() = default;
    void addShape(std::unique_ptr<PhysicsShapeBox> shape);
    bool _dynamic = true;
    Node* _owner = nullptr;
    PhysicsWorld* _world = nullptr;
    std::vector<std::unique_ptr<PhysicsShapeBox>> _shapes;
};

} // namespace cocos2d
