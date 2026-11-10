#include "cocos/physics/CCPhysicsWorld.h"
#include "cocos/physics/CCPhysicsBody.h"
#include "cocos/physics/CCPhysicsShape.h"

#include <iostream>

namespace cocos2d {

void PhysicsWorld::addBody(PhysicsBody* body) {
    std::cout << "PhysicsWorld.addBody\n";
    for (const auto& shape : body->getShapes()) addShape(shape.get());
}

void PhysicsWorld::addShape(PhysicsShapeBox* shape) {
    std::cout << "  PhysicsWorld.addShape：" << shape->_size.width << "x"
              << shape->_size.height << "，density=" << shape->_material.density
              << ", restitution=" << shape->_material.restitution
              << ", friction=" << shape->_material.friction << "\n";
}

} // namespace cocos2d
