#pragma once

#include "cocos/physics/CCPhysicsWorld.h"

namespace cocos2d {

class Scene {
public:
    static Scene* createWithPhysics();

    PhysicsWorld* getPhysicsWorld() { return &_physicsWorld; }
    void stepPhysicsAndNavigation(float deltaTime);

private:
    explicit Scene(bool withPhysics);

    bool _withPhysics;
    PhysicsWorld _physicsWorld;
};

}
