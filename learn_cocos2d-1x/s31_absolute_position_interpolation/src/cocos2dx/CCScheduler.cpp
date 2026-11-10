#include "cocos2dx/CCScheduler.h"
#include "cocos2dx/actions/CCActionManager.h"

namespace cocos2d {

void CCScheduler::scheduleUpdateForTarget(CCActionManager* target) {
    _target = target;
}

void CCScheduler::tick(ccTime dt) {
    if (_target) _target->update(dt);
}

} // namespace cocos2d
