#include "include/CCDirector.h"
#include "include/CCScene.h"

namespace cocos2d {
CCDirector& CCDirector::sharedDirector() {
    static CCDirector director;
    return director;
}

void CCDirector::drawScene() {
    if (_runningScene) _runningScene->visit();
}
} // namespace cocos2d
