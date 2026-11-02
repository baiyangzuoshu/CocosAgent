#include "cocos/base/CCDirector.h"
#include "cocos/2d/CCScene.h"

#include <iostream>

namespace cocos2d {

Director::Director()
: _runningScene(nullptr), _deltaTime(0.0f), _frame(0) {
}

void Director::runWithScene(Scene* scene) {
    _runningScene = scene;
}

void Director::mainLoop(float dt) {
    _deltaTime = dt;
    drawScene();
}

void Director::drawScene() {
    _scheduler.update(_deltaTime);
    std::cout << "Director.drawScene frame=" << ++_frame << '\n';
    if (_runningScene) {
        _runningScene->visit();
    }
}

} // namespace cocos2d
