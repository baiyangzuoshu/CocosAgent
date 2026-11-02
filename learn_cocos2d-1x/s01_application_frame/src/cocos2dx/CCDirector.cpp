#include "cocos2dx/CCDirector.h"
#include "cocos2dx/include/CCScene.h"

#include <iostream>

namespace cocos2d {

CCDirector::CCDirector()
: _runningScene(nullptr), _frame(0) {
}

void CCDirector::runWithScene(CCScene* scene) {
    _runningScene = scene;
}

void CCDirector::drawScene() {
    const float dt = 1.0f / 60.0f;
    _scheduler.tick(dt);
    std::cout << "CCDirector.drawScene frame=" << ++_frame << '\n';
    if (_runningScene) {
        _runningScene->visit();
    }
}

} // namespace cocos2d
