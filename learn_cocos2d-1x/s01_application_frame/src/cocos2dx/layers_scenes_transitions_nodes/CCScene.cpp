#include "cocos2dx/include/CCScene.h"

#include <iostream>

namespace cocos2d {

void CCScene::visit() const {
    std::cout << "visit current scene\n";
}

} // namespace cocos2d
