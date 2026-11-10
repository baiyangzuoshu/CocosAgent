#include "cocos/2d/CCNode.h"
#include "cocos/physics/CCPhysicsBody.h"

#include <iostream>

namespace cocos2d {

void Node::setPhysicsBody(PhysicsBody* body) {
    std::cout << "Node::setPhysicsBody -> addComponent\n";
    addComponent(body);
}

void Node::addComponent(PhysicsBody* body) {
    _physicsBody = body;
    _physicsBody->onAdd(this, _world);
}

} // namespace cocos2d
