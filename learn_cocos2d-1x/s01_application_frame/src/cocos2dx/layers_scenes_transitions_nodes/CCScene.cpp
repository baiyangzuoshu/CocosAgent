#include "cocos2dx/include/CCScene.h"

#include <iostream>

namespace cocos2d {

CCScene* CCScene::node() {
    return new CCScene();
}

void CCScene::visit() const {
    std::cout << "visit current scene\n";
}

} // namespace cocos2d
