#include "cocos/2d/CCScene.h"

namespace cocos2d {

Scene* Scene::create() {
    auto* scene = new Scene();
    scene->autorelease();
    return scene;
}

} // namespace cocos2d
