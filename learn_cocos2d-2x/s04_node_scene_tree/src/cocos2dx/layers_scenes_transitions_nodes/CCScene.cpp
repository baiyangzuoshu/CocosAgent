#include "cocos2dx/layers_scenes_transitions_nodes/CCScene.h"

namespace cocos2d {

CCScene* CCScene::create() {
    auto* scene = new CCScene();
    scene->autorelease();
    return scene;
}

} // namespace cocos2d
