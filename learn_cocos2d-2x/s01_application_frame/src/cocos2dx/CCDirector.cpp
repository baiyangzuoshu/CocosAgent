#include "cocos2dx/CCDirector.h"
#include "cocos2dx/layers_scenes_transitions_nodes/CCScene.h"

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
    _scheduler.update(dt);
    std::cout << "CCDirector.drawScene frame=" << ++_frame << '\n';
    if (_runningScene) {
        _runningScene->visit();
    }
}

} // namespace cocos2d
