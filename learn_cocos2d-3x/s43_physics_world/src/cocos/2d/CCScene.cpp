#include "cocos/2d/CCScene.h"

#include <iostream>

namespace cocos2d {

Scene::Scene(bool withPhysics)
: _withPhysics(withPhysics) {
    std::cout << "Scene::initWithPhysics -> construct PhysicsWorld"
              << std::endl;
}

Scene* Scene::createWithPhysics() {
    return new Scene(true);
}

void Scene::stepPhysicsAndNavigation(float deltaTime) {
    if (_withPhysics && _physicsWorld.isAutoStep()) {
        _physicsWorld.update(deltaTime);
    }
}

}
