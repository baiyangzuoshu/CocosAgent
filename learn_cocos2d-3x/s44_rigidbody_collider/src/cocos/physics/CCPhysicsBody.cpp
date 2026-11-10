#include "cocos/physics/CCPhysicsBody.h"
#include "cocos/physics/CCPhysicsWorld.h"

#include <iostream>

namespace cocos2d {

PhysicsBody* PhysicsBody::createBox(Size size, PhysicsMaterial material) {
    PhysicsBody* body = new PhysicsBody();
    body->addShape(std::unique_ptr<PhysicsShapeBox>(new PhysicsShapeBox(size, material)));
    std::cout << "PhysicsBody::createBox -> PhysicsShapeBox::create\n";
    return body;
}

void PhysicsBody::addShape(std::unique_ptr<PhysicsShapeBox> shape) {
    _shapes.push_back(std::move(shape));
}

void PhysicsBody::setDynamic(bool value) {
    _dynamic = value;
    std::cout << "PhysicsBody::setDynamic(" << value << ") -> Chipmunk "
              << (value ? "DYNAMIC" : "KINEMATIC") << "\n";
}

void PhysicsBody::onAdd(Node* owner, PhysicsWorld* world) {
    _owner = owner;
    _world = world;
    std::cout << "PhysicsBody::onAdd：登记 owner node，再加入 PhysicsWorld\n";
    _world->addBody(this);
}

} // namespace cocos2d
