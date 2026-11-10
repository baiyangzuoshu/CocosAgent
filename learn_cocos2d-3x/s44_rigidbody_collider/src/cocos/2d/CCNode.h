#pragma once

namespace cocos2d {

class PhysicsBody;
class PhysicsWorld;

class Node {
public:
    Node(const char* name, PhysicsWorld* world) : _name(name), _world(world) {}
    void setPhysicsBody(PhysicsBody* body);

private:
    void addComponent(PhysicsBody* body);
    const char* _name;
    PhysicsWorld* _world;
    PhysicsBody* _physicsBody = nullptr;
};

} // namespace cocos2d
