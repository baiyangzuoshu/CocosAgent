#include "cocos2dx/include/CCScene.h"

namespace cocos2d {

CCScene* CCScene::node() {
    auto* scene = new CCScene();
    scene->autorelease();
    return scene;
}

} // namespace cocos2d
