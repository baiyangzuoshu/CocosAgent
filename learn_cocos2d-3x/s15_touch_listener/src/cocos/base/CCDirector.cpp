#include "cocos/base/CCDirector.h"
#include "../2d/CCScene.h"

namespace cocos2d {

Director* Director::getInstance() {
    static Director director;
    return &director;
}

void Director::drawScene() {
    _renderer.clear();
    if (_runningScene) _runningScene->visit(_renderer);
    _renderer.render();
}

} // namespace cocos2d
