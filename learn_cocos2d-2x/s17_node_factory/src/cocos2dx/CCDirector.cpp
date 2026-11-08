#include "CCDirector.h"
#include "layers_scenes_transitions_nodes/CCScene.h"

namespace cocos2d {
CCDirector* CCDirector::sharedDirector() {
    static CCDirector director;
    return &director;
}

void CCDirector::drawScene() {
    if (_runningScene) _runningScene->visit();
}
} // namespace cocos2d
