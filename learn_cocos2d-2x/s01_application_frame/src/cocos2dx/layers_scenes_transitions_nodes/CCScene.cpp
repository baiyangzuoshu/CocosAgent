#include "cocos2dx/layers_scenes_transitions_nodes/CCScene.h"

#include <iostream>

namespace cocos2d {

CCScene* CCScene::create() {
    return new CCScene();
}

void CCScene::visit() const {
    std::cout << "visit current scene\n";
}

} // namespace cocos2d
