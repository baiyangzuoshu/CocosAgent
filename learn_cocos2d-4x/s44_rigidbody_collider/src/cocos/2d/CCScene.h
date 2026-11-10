#pragma once

#include "cocos/physics/CCPhysicsWorld.h"

namespace cocos2d {

class Scene {
public:
    static Scene* createWithPhysics();
    PhysicsWorld* getPhysicsWorld() { return &_world; }

private:
    PhysicsWorld _world;
};

} // namespace cocos2d
