#include "cocos/2d/CCScene.h"

#include <iostream>

namespace cocos2d {

Scene* Scene::createWithPhysics() {
    std::cout << "Scene::createWithPhysics -> construct PhysicsWorld\n";
    return new Scene();
}

} // namespace cocos2d
