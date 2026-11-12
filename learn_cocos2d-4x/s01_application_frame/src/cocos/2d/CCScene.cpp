#include "cocos/2d/CCScene.h"

#include <iostream>

namespace cocos2d {

Scene* Scene::create() {
    return new Scene();
}

void Scene::visit() const {
    std::cout << "visit current scene\n";
}

} // namespace cocos2d
