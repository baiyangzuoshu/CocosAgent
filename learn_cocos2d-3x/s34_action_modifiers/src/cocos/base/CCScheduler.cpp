#include "cocos/base/CCScheduler.h"
#include "cocos/2d/CCActionManager.h"

namespace cocos2d {

void Scheduler::scheduleUpdateForTarget(ActionManager* target) {
    _target = target;
}

void Scheduler::update(float dt) {
    if (_target) _target->update(dt);
}

} // namespace cocos2d
