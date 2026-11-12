#include "cocos/base/CCDirector.h"

#include "cocos/2d/CCScene.h"

#include <iostream>

namespace cocos2d {

Director::Director()
: _frame(0) {
}

Director::~Director() = default;

Director* Director::getInstance() {
    static Director director;
    return &director;
}

void Director::runWithScene(Scene* scene) {
    if (_runningScene.get() != scene) {
        _runningScene.reset(scene);
    }
}

void Director::mainLoop() {
    drawScene();
}

void Director::drawScene() {
    _scheduler.update(1.0f / 60.0f);
    std::cout << "Director.drawScene frame=" << ++_frame << '\n';
    if (_runningScene) {
        _runningScene->visit();
    }
}

} // namespace cocos2d
